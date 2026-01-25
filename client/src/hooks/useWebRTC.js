import { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';

/**
 * Custom Hook cho WebRTC P2P Mesh
 * Sử dụng cho Live Class với <= 6 người
 * 
 * @param {string} joinToken - JWT token từ API join
 * @param {Array} iceServers - STUN/TURN servers config
 */
const useWebRTC = (joinToken, iceServers = []) => {
  const [socket, setSocket] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [roomData, setRoomData] = useState(null);
  const [error, setError] = useState(null);
  
  // Media states - Mặc định OFF cho cả mic và camera
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
  // Communication states
  const [messages, setMessages] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [pinnedVideoUserId, setPinnedVideoUserId] = useState(null);
  
  // Store peer connections: userId -> RTCPeerConnection
  const peerConnections = useRef(new Map());
  const socketRef = useRef(null);
  const roomIdRef = useRef(null);

  // ICE configuration
  const rtcConfig = {
    iceServers: iceServers.length > 0 ? iceServers : [
      { urls: ['stun:stun.l.google.com:19302'] },
      { urls: ['stun:stun1.l.google.com:19302'] },
    ],
  };

  // ============ Initialize Socket Connection ============
  useEffect(() => {
    if (!joinToken) return;

    const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5001';
    
    const newSocket = io(`${SOCKET_URL}/live`, {
      auth: { token: joinToken },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      console.log('✅ Connected to signaling server');
      setIsConnected(true);
    });

    newSocket.on('room:joined', (data) => {
      console.log('🎉 Joined room:', data);
      console.log('🔑 Setting roomId:', data.roomId);
      setRoomData(data);
      roomIdRef.current = data.roomId;
      console.log('✅ roomIdRef set to:', roomIdRef.current);
      
      // Initialize peer connections for existing members
      data.members.forEach(member => {
        if (member.userId !== data.user?.userId) {
          createPeerConnection(member.userId, member.fullName, true);
        }
      });
    });

    newSocket.on('room:user-joined', ({ user }) => {
      console.log('👋 User joined:', user.fullName);
      // New user joined, they will send us an offer
      createPeerConnection(user.userId, user.fullName, false);
    });

    newSocket.on('room:user-left', ({ userId, userName }) => {
      console.log('👋 User left:', userName);
      closePeerConnection(userId);
    });

    // WebRTC signaling events
    newSocket.on('webrtc:offer', async ({ fromUserId, fromUserName, sdp }) => {
      console.log('📩 Received offer from:', fromUserName);
      await handleOffer(fromUserId, fromUserName, sdp);
    });

    newSocket.on('webrtc:answer', async ({ fromUserId, fromUserName, sdp }) => {
      console.log('✅ Received answer from:', fromUserName);
      await handleAnswer(fromUserId, sdp);
    });

    newSocket.on('webrtc:ice-candidate', async ({ fromUserId, candidate }) => {
      await handleIceCandidate(fromUserId, candidate);
    });

    // Media state changes from other users
    newSocket.on('media:user-camera-changed', ({ userId, enabled }) => {
      console.log(`📷 ${userId} camera: ${enabled ? 'ON' : 'OFF'}`);
      setRemoteStreams(prev => {
        const newMap = new Map(prev);
        const user = newMap.get(userId);
        if (user) {
          // Only copy necessary fields to avoid circular reference with MediaStream
          newMap.set(userId, {
            stream: user.stream,
            userName: user.userName,
            userId: user.userId,
            cameraEnabled: enabled,
            micEnabled: user.micEnabled
          });
        }
        return newMap;
      });
    });

    newSocket.on('media:user-mic-changed', ({ userId, enabled }) => {
      console.log(`🎤 ${userId} mic: ${enabled ? 'ON' : 'OFF'}`);
      setRemoteStreams(prev => {
        const newMap = new Map(prev);
        const user = newMap.get(userId);
        if (user) {
          // Only copy necessary fields to avoid circular reference with MediaStream
          newMap.set(userId, {
            stream: user.stream,
            userName: user.userName,
            userId: user.userId,
            cameraEnabled: user.cameraEnabled,
            micEnabled: enabled
          });
        }
        return newMap;
      });
    });

    // Chat & Q&A events
    newSocket.on('chat:message', (message) => {
      console.log('💬 New message:', message);
      setMessages(prev => [...prev, message]);
    });

    newSocket.on('qa:new-question', (question) => {
      console.log('❓ New question:', question);
      setQuestions(prev => [...prev, question]);
    });

    newSocket.on('qa:question-answered', ({ questionId, answer, answeredAt }) => {
      console.log('✅ Question answered:', questionId);
      setQuestions(prev => prev.map(q => 
        q._id === questionId 
          ? { ...q, answer, isAnswered: true, answeredAt }
          : q
      ));
    });
    
    // Pinned message event
    newSocket.on('chat:message-pinned', ({ messageId }) => {
      console.log('📌 Message pinned:', messageId);
      setMessages(prev => prev.map(m => ({
        ...m,
        isPinned: m._id === messageId
      })));
    });

    newSocket.on('chat:message-unpinned', () => {
      console.log('📌 Message unpinned');
      setMessages(prev => prev.map(m => ({
        ...m,
        isPinned: false
      })));
    });

    // Pinned video events
    newSocket.on('video:pinned', ({ userId }) => {
      console.log('📌 Video pinned:', userId);
      setPinnedVideoUserId(userId);
    });

    newSocket.on('video:unpinned', () => {
      console.log('📌 Video unpinned');
      setPinnedVideoUserId(null);
    });

    newSocket.on('hand:raised', ({ userId, userName }) => {
      console.log('✋ Hand raised by:', userName);
      // Could add to messages or separate notification
      setMessages(prev => [...prev, {
        _id: Date.now().toString(),
        userName: 'System',
        message: `✋ ${userName} raised hand`,
        timestamp: new Date(),
        isSystem: true
      }]);
    });

    newSocket.on('moderation:kicked', ({ reason }) => {
      alert(`You have been removed from the class: ${reason}`);
      cleanup();
    });

    newSocket.on('moderation:force-mute', () => {
      toggleMicrophone(false);
      alert('Your microphone has been muted by the teacher');
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Disconnected from signaling server');
      setIsConnected(false);
    });

    newSocket.on('error', ({ message }) => {
      console.error('Socket error:', message);
      setError(message);
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    return () => {
      cleanup();
      newSocket.disconnect();
    };
  }, [joinToken]);

  // ============ Auto-start Local Stream ============
  useEffect(() => {
    if (isConnected && !localStream && roomData) {
      // Start with camera OFF by default
      // Teacher can enable it manually, students too
      startLocalStream(true, false).catch(err => {
        console.error('Failed to start local stream:', err);
        setError('Could not access camera/microphone. Please check permissions.');
      });
    }
  }, [isConnected, localStream, roomData]);

  // ============ Get Local Media ============
  const startLocalStream = useCallback(async (audioEnabled = false, videoEnabled = false) => {
    try {
      const constraints = {
        audio: audioEnabled,
        video: videoEnabled ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      
      // Set states theo constraints
      setIsMicOn(audioEnabled);
      setIsCameraOn(videoEnabled);

      // Add tracks to all existing peer connections
      peerConnections.current.forEach((pc) => {
        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
        });
      });

      console.log(`🎥 Local stream started (mic: ${audioEnabled}, camera: ${videoEnabled})`);
      return stream;
    } catch (err) {
      console.error('Error accessing media devices:', err);
      setError('Could not access camera/microphone');
      throw err;
    }
  }, []);

  // ============ Peer Connection Management ============
  const createPeerConnection = useCallback((userId, userName, shouldCreateOffer) => {
    if (peerConnections.current.has(userId)) {
      return peerConnections.current.get(userId);
    }

    const pc = new RTCPeerConnection(rtcConfig);

    // Add local stream tracks if available
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    // Handle incoming tracks
    pc.ontrack = (event) => {
      console.log('📺 Received remote track from:', userName);
      const [remoteStream] = event.streams;
      
      setRemoteStreams(prev => {
        const newMap = new Map(prev);
        newMap.set(userId, {
          stream: remoteStream,
          userName: userName,
          userId: userId,
          cameraEnabled: true,  // Default to enabled
          micEnabled: true      // Default to enabled
        });
        return newMap;
      });
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('webrtc:ice-candidate', {
          toUserId: userId,
          candidate: event.candidate,
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state with ${userName}:`, pc.iceConnectionState);
      
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        closePeerConnection(userId);
      }
    };

    peerConnections.current.set(userId, pc);

    // If we should create offer (we joined after them)
    if (shouldCreateOffer && localStream) {
      createOffer(userId, pc);
    }

    return pc;
  }, [localStream, rtcConfig]);

  const createOffer = async (userId, pc) => {
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      socketRef.current?.emit('webrtc:offer', {
        toUserId: userId,
        sdp: offer,
      });
      
      console.log('📤 Sent offer to:', userId);
    } catch (err) {
      console.error('Error creating offer:', err);
    }
  };

  const handleOffer = async (userId, userName, sdp) => {
    try {
      const pc = createPeerConnection(userId, userName, false);
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      socketRef.current?.emit('webrtc:answer', {
        toUserId: userId,
        sdp: answer,
      });
      
      console.log('📤 Sent answer to:', userName);
    } catch (err) {
      console.error('Error handling offer:', err);
    }
  };

  const handleAnswer = async (userId, sdp) => {
    try {
      const pc = peerConnections.current.get(userId);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      }
    } catch (err) {
      console.error('Error handling answer:', err);
    }
  };

  const handleIceCandidate = async (userId, candidate) => {
    try {
      const pc = peerConnections.current.get(userId);
      if (pc && candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (err) {
      console.error('Error handling ICE candidate:', err);
    }
  };

  const closePeerConnection = (userId) => {
    const pc = peerConnections.current.get(userId);
    if (pc) {
      pc.close();
      peerConnections.current.delete(userId);
    }

    setRemoteStreams(prev => {
      const newMap = new Map(prev);
      newMap.delete(userId);
      return newMap;
    });
  };

  // ============ Media Controls ============
  const toggleMicrophone = useCallback(async (enabled) => {
    try {
      const newState = enabled !== undefined ? enabled : !isMicOn;
      
      if (localStream) {
        const audioTracks = localStream.getAudioTracks();
        
        if (audioTracks.length > 0) {
          // Đã có audio track, chỉ cần enable/disable
          audioTracks.forEach(track => {
            track.enabled = newState;
          });
          setIsMicOn(newState);
          // CHỈ emit boolean, KHÔNG emit object phức tạp
          if (socketRef.current?.connected) {
            socketRef.current.emit('media:toggle-mic', { enabled: newState });
          }
          console.log(`🎤 Microphone ${newState ? 'ON' : 'OFF'}`);
        } else if (newState) {
          // Có stream nhưng chưa có audio track, cần thêm audio track
          console.log('🎤 Adding microphone track to existing stream...');
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const audioTrack = audioStream.getAudioTracks()[0];
          
          // Tạo stream mới với track mới
          const newStream = new MediaStream([...localStream.getTracks(), audioTrack]);
          setLocalStream(newStream);
          
          // Add audio track to all peer connections
          peerConnections.current.forEach((pc) => {
            pc.addTrack(audioTrack, newStream);
          });
          
          setIsMicOn(true);
          if (socketRef.current?.connected) {
            socketRef.current.emit('media:toggle-mic', { enabled: true });
          }
          console.log('🎤 Microphone ON');
        }
        return newState;
      } else if (newState) {
        // Chưa có stream và muốn bật mic -> khởi tạo stream
        console.log('🎥 Starting stream with microphone...');
        await startLocalStream(true, isCameraOn);
        setIsMicOn(true);
        if (socketRef.current?.connected) {
          socketRef.current.emit('media:toggle-mic', { enabled: true });
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error toggling microphone:', err);
      setError('Could not access microphone');
      return false;
    }
  }, [localStream, isMicOn, isCameraOn, startLocalStream]);

  const toggleCamera = useCallback(async (enabled) => {
    try {
      const newState = enabled !== undefined ? enabled : !isCameraOn;
      
      if (localStream) {
        const videoTracks = localStream.getVideoTracks();
        
        if (videoTracks.length > 0) {
          // Đã có video track, chỉ cần enable/disable
          videoTracks.forEach(track => {
            track.enabled = newState;
          });
          setIsCameraOn(newState);
          // CHỈ emit boolean, KHÔNG emit object phức tạp
          if (socketRef.current?.connected) {
            socketRef.current.emit('media:toggle-camera', { enabled: newState });
          }
          console.log(`📷 Camera ${newState ? 'ON' : 'OFF'}`);
        } else if (newState) {
          // Có stream nhưng chưa có video track, cần thêm video track
          console.log('📷 Adding camera track to existing stream...');
          const videoStream = await navigator.mediaDevices.getUserMedia({ 
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: 'user',
            }
          });
          const videoTrack = videoStream.getVideoTracks()[0];
          
          // Tạo stream mới với track mới để tránh mutation
          const newStream = new MediaStream([...localStream.getTracks(), videoTrack]);
          setLocalStream(newStream);
          
          // Add video track to all peer connections
          peerConnections.current.forEach((pc) => {
            pc.addTrack(videoTrack, newStream);
          });
          
          setIsCameraOn(true);
          if (socketRef.current?.connected) {
            socketRef.current.emit('media:toggle-camera', { enabled: true });
          }
          console.log('📷 Camera ON');
        }
        return newState;
      } else if (newState) {
        // Chưa có stream và muốn bật camera -> khởi tạo stream
        console.log('🎥 Starting stream with camera...');
        await startLocalStream(isMicOn, true);
        setIsCameraOn(true);
        if (socketRef.current?.connected) {
          socketRef.current.emit('media:toggle-camera', { enabled: true });
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error toggling camera:', err);
      setError('Could not access camera');
      return false;
    }
  }, [localStream, isCameraOn, isMicOn, startLocalStream]);

  const startScreenShare = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      // Replace video track in all peer connections
      const videoTrack = screenStream.getVideoTracks()[0];
      
      peerConnections.current.forEach((pc) => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      });

      socketRef.current?.emit('media:start-screenshare');

      // Handle screen share stop
      videoTrack.onended = () => {
        stopScreenShare();
      };

      return screenStream;
    } catch (err) {
      console.error('Error starting screen share:', err);
      throw err;
    }
  }, []);

  const stopScreenShare = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      
      peerConnections.current.forEach((pc) => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender && videoTrack) {
          sender.replaceTrack(videoTrack);
        }
      });

      socketRef.current?.emit('media:stop-screenshare');
    }
  }, [localStream]);

  // ============ Chat & Q&A ============
  const sendMessage = useCallback((message) => {
    console.log('📤 sendMessage called:', { 
      message, 
      roomId: roomIdRef.current, 
      hasSocket: !!socketRef.current,
      socketConnected: socketRef.current?.connected
    });
    
    if (!roomIdRef.current) {
      console.error('❌ No roomId!');
      return;
    }
    
    if (!socketRef.current) {
      console.error('❌ No socket!');
      return;
    }
    
    if (!socketRef.current.connected) {
      console.error('❌ Socket not connected!');
      return;
    }
    
    console.log('✅ Emitting chat:send event...');
    socketRef.current.emit('chat:send', { message });
    console.log('✅ Event emitted!');
  }, []);

  const askQuestion = useCallback((question) => {
    if (!roomIdRef.current) return;
    socketRef.current?.emit('qa:ask', { question });
  }, []);

  const raiseHand = useCallback(() => {
    socketRef.current?.emit('hand:raise');
  }, []);

  const lowerHand = useCallback(() => {
    socketRef.current?.emit('hand:lower');
  }, []);

  const pinMessage = useCallback((messageId) => {
    socketRef.current?.emit('chat:pin-message', { messageId });
  }, []);

  const unpinMessage = useCallback(() => {
    socketRef.current?.emit('chat:unpin-message');
  }, []);

  const pinVideo = useCallback((userId) => {
    if (userId) {
      socketRef.current?.emit('video:pin', { userId });
    } else {
      socketRef.current?.emit('video:unpin');
    }
  }, []);

  // ============ Cleanup ============
  const cleanup = useCallback(() => {
    // Stop all tracks
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }

    // Close all peer connections
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();

    setLocalStream(null);
    setRemoteStreams(new Map());
  }, [localStream]);

  return {
    // Connection
    socket,
    isConnected,
    roomData,
    error,
    
    // Streams
    localStream,
    remoteStreams,
    
    // Room data
    roomData,
    
    // Media states
    isMicOn,
    isCameraOn,
    isScreenSharing,
    
    // Communication states
    messages,
    questions,
    pinnedVideoUserId,
    
    // Media controls
    startLocalStream,
    toggleMicrophone,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    
    // Communication
    sendMessage,
    askQuestion,
    raiseHand,
    lowerHand,
    pinMessage,
    unpinMessage,
    pinVideo,
    
    // Cleanup
    cleanup,
  };
};

export default useWebRTC;
