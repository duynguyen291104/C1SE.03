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
  
  // Remote media states - Track camera/mic status of other users
  const [remoteMediaStatus, setRemoteMediaStatus] = useState(new Map());
  
  // Communication states
  const [messages, setMessages] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [pinnedVideoUserId, setPinnedVideoUserId] = useState(null);
  
  // Approval states
  const [isWaitingApproval, setIsWaitingApproval] = useState(false);
  const [waitingStudents, setWaitingStudents] = useState([]);
  
  // Store peer connections: userId -> RTCPeerConnection
  const peerConnections = useRef(new Map());
  const socketRef = useRef(null);
  const roomIdRef = useRef(null);
  
  // Approval locks to prevent duplicate requests
  const approvingRef = useRef(new Set());
  const rejectingRef = useRef(new Set());

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
      console.log('👥 Members in room:', data.members?.length || 0, data.members);
      setRoomData(data);
      roomIdRef.current = data.roomId;
      console.log('✅ roomIdRef set to:', roomIdRef.current);
      
      // Sync waiting students if host
      if (data.waitingStudents) {
        // Deduplicate by userId
        const uniqueMap = new Map();
        data.waitingStudents.forEach(s => {
          if (s && (s.userId || s.email)) {
            const key = s.userId?.toString() || s.email;
            uniqueMap.set(key, s);
          }
        });
        setWaitingStudents(Array.from(uniqueMap.values()));
      }
      
      // Initialize peer connections for existing members
      data.members.forEach(member => {
        if (member.userId !== data.user?.userId) {
          createPeerConnection(member.userId, member.fullName, true);
        }
      });
    });

    newSocket.on('room:user-joined', ({ user, memberCount }) => {
      console.log('👋 User joined:', user.fullName, 'userId:', user.userId);
      console.log('   Total members now:', memberCount);
      
      // Update roomData to include new member
      setRoomData(prev => {
        if (!prev) return prev;
        
        // Check if user already in members (avoid duplicates)
        const existingMember = prev.members?.find(m => m.userId === user.userId);
        if (existingMember) {
          console.log('   User already in members list');
          return prev;
        }
        
        // Add new member to the list
        const updatedMembers = [
          ...(prev.members || []),
          {
            userId: user.userId,
            fullName: user.fullName,
            role: user.role,
            avatar: user.avatar,
            joinedAt: new Date()
          }
        ];
        
        console.log('   Updated members list:', updatedMembers.map(m => m.fullName));
        
        return {
          ...prev,
          members: updatedMembers
        };
      });
      
      // Create peer connection - it will automatically add localStream tracks if available
      const pc = createPeerConnection(user.userId, user.fullName, true);
      console.log('✅ Peer connection created for:', user.fullName, 'will create offer:', !!localStream);
    });

    newSocket.on('room:user-left', ({ userId, userName }) => {
      console.log('👋 User left:', userName);
      
      // Update roomData to remove member
      setRoomData(prev => {
        if (!prev) return prev;
        
        return {
          ...prev,
          members: prev.members?.filter(m => m.userId !== userId) || []
        };
      });
      
      closePeerConnection(userId);
    });

    // ============ APPROVAL EVENTS ============
    newSocket.on('room:waiting-approval', ({ message }) => {
      console.log('⏳ Waiting for approval:', message);
      setIsWaitingApproval(true);
    });

    newSocket.on('room:approved', ({ message, roomId }) => {
      console.log('✅ Approved by teacher:', message);
      setIsWaitingApproval(false);
      // DO NOT call joinRoom again - server already called joinRoomDirectly
      // Just wait for room:joined event which will come automatically
    });

    newSocket.on('room:rejected', ({ message }) => {
      console.log('❌ Rejected by teacher:', message);
      alert(message || 'Giáo viên đã từ chối yêu cầu tham gia của bạn');
      cleanup();
    });

    newSocket.on('room:student-waiting', ({ student, waitingList }) => {
      console.log('👨‍🎓 Student waiting:', student?.fullName);
      // Deduplicate by userId
      const uniqueMap = new Map();
      (waitingList || []).forEach(s => {
        if (s && (s.userId || s.email)) {
          const key = s.userId?.toString() || s.email;
          uniqueMap.set(key, s);
        }
      });
      setWaitingStudents(Array.from(uniqueMap.values()));
    });

    newSocket.on('room:waiting-updated', ({ waitingStudents: updated }) => {
      console.log('📝 Waiting list updated:', updated?.length || 0);
      // Deduplicate by userId
      const uniqueMap = new Map();
      (updated || []).forEach(s => {
        if (s && (s.userId || s.email)) {
          const key = s.userId?.toString() || s.email;
          uniqueMap.set(key, s);
        }
      });
      setWaitingStudents(Array.from(uniqueMap.values()));
    });

    // ============ PARTICIPANTS SYNC EVENT ============
    newSocket.on('room:participants-updated', ({ members, participantCount }) => {
      console.log('👥 Participants updated:', participantCount, 'members');
      console.log('   Members list:', members.map(m => `${m.fullName} (${m.userId})`));
      
      // Replace entire members list to ensure sync
      setRoomData(prev => {
        if (!prev) return prev;
        
        return {
          ...prev,
          members: members || []
        };
      });
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
      console.log('💬 New message received:', {
        message,
        currentMessagesCount: messages.length,
        messageContent: message.message,
        userName: message.userName,
        timestamp: message.timestamp
      });
      setMessages(prev => {
        const updated = [...prev, message];
        console.log('💬 Messages state updated. New count:', updated.length);
        return updated;
      });
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

    // Media status synchronization - Receive remote user's camera/mic status
    newSocket.on('media:user-camera-toggled', ({ userId, enabled }) => {
      console.log(`📷 User ${userId} camera: ${enabled ? 'ON' : 'OFF'}`);
      setRemoteMediaStatus(prev => {
        const updated = new Map(prev);
        const current = updated.get(userId) || {};
        updated.set(userId, { ...current, camera: enabled });
        return updated;
      });
    });

    newSocket.on('media:user-mic-toggled', ({ userId, enabled }) => {
      console.log(`🎤 User ${userId} mic: ${enabled ? 'ON' : 'OFF'}`);
      setRemoteMediaStatus(prev => {
        const updated = new Map(prev);
        const current = updated.get(userId) || {};
        updated.set(userId, { ...current, mic: enabled });
        return updated;
      });
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Disconnected from signaling server');
      setIsConnected(false);
    });

    // ============ Room Warning Event (30s trước khi kết thúc) ============
    newSocket.on('room:warning', ({ message, secondsRemaining }) => {
      console.log('⚠️ Room warning:', message);
      // Component sử dụng hook sẽ nhận được event này qua roomData hoặc callback
      // Tạm thời log ra, component có thể handle sau
    });

    // ============ Room Ended Event ============
    newSocket.on('room:ended', ({ message, endedAt }) => {
      console.log('🚪 Room ended:', message);
      alert(message || 'Phòng học đã kết thúc');
      
      // Cleanup và redirect sẽ được xử lý bởi component sử dụng hook này
      // Component nên lắng nghe event này và thực hiện cleanup + redirect
      cleanup();
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
      // ⚠️ CHANGED: Don't auto-request media - let user enable manually
      // This prevents permission errors on page load
      // Users can click mic/camera buttons to enable when ready
      console.log('🎥 Room joined. Camera/mic disabled by default. Click buttons to enable.');
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

      // Add tracks to all existing peer connections and create offers
      peerConnections.current.forEach((pc, userId) => {
        stream.getTracks().forEach(track => {
          // Check if track already added
          const existingSender = pc.getSenders().find(s => s.track === track);
          if (!existingSender) {
            pc.addTrack(track, stream);
            console.log('➕ Added initial track to peer userId:', userId, 'kind:', track.kind);
          }
        });
        
        // Create offer if we haven't sent one yet
        if (pc.signalingState === 'stable' && pc.iceConnectionState === 'new') {
          console.log('📤 Creating initial offer to userId:', userId);
          createOffer(userId, pc);
        }
      });

      // ✅ Emit initial media state to server
      socketRef.current?.emit('media:toggle-mic', { enabled: audioEnabled });
      socketRef.current?.emit('media:toggle-camera', { enabled: videoEnabled });
      
      console.log(`🎥 Local stream started (mic: ${audioEnabled}, camera: ${videoEnabled})`);
      return stream;
    } catch (err) {
      console.error('Error accessing media devices:', err);
      
      // Better error messages based on error type
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        const errorMsg = '🚫 Quyền truy cập bị từ chối!\n\n' +
          '📌 Cách sửa:\n' +
          '1. Click biểu tượng 🔒 bên cạnh URL\n' +
          '2. Cho phép Camera và Microphone\n' +
          '3. Tải lại trang (F5)';
        setError(errorMsg);
        alert(errorMsg);
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        const errorMsg = '📷 Không tìm thấy camera/microphone!\n\nVui lòng kiểm tra thiết bị.';
        setError(errorMsg);
        alert(errorMsg);
      } else {
        setError('Could not access camera/microphone');
      }
      
      throw err;
    }
  }, []);

  // ============ Peer Connection Management ============
  const createPeerConnection = useCallback((userId, userName, shouldCreateOffer) => {
    if (peerConnections.current.has(userId)) {
      return peerConnections.current.get(userId);
    }

    const pc = new RTCPeerConnection(rtcConfig);

    // ✅ CRITICAL: Capture userId và userName vào scope riêng để tránh closure bug
    const capturedUserId = userId;
    const capturedUserName = userName;

    // Add local stream tracks if available (check if not already added)
    if (localStream) {
      localStream.getTracks().forEach(track => {
        // Check if this track is already added
        const existingSender = pc.getSenders().find(s => s.track === track);
        if (!existingSender) {
          pc.addTrack(track, localStream);
          console.log('➕ Added track to peer:', capturedUserName, 'kind:', track.kind);
        }
      });
    }

    // ✅ Handle incoming tracks - GẮN CHO MỌI PEER
    pc.ontrack = (event) => {
      const stream = event.streams[0];
      const track = event.track;
      
      console.log('🎯 ontrack fired:', {
        userId: capturedUserId,
        userName: capturedUserName,
        kind: track.kind,
        streamId: stream?.id,
        hasStream: !!stream
      });
      
      if (!stream) {
        console.log('⚠️ ontrack fired but no stream');
        return;
      }
      
      setRemoteStreams(prev => {
        const next = new Map(prev);
        const existing = next.get(capturedUserId);
        
        if (existing) {
          // Stream đã tồn tại → update lại (có thể có track mới)
          console.log('🔄 Updating existing stream for:', capturedUserName);
          next.set(capturedUserId, {
            ...existing,
            stream: stream
          });
        } else {
          // Tạo mới
          console.log('➕ Creating new stream entry for:', capturedUserName);
          next.set(capturedUserId, {
            userId: capturedUserId,
            userName: capturedUserName,
            stream: stream,
            cameraEnabled: true,
            micEnabled: true
          });
        }
        
        console.log('✅ Updated remoteStreams Map:', {
          userId: capturedUserId,
          userName: capturedUserName,
          totalRemoteUsers: next.size,
          allKeys: Array.from(next.keys())
        });
        
        return next;
      });
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        // Serialize candidate to avoid circular reference
        socketRef.current.emit('webrtc:ice-candidate', {
          toUserId: capturedUserId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state with ${capturedUserName}:`, pc.iceConnectionState);
      
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        closePeerConnection(capturedUserId);
      }
    };

    peerConnections.current.set(capturedUserId, pc);

    // If we should create offer (we joined after them)
    if (shouldCreateOffer && localStream) {
      createOffer(capturedUserId, pc);
    }

    return pc;
  }, [localStream, rtcConfig]);

  const createOffer = async (userId, pc) => {
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      socketRef.current?.emit('webrtc:offer', {
        toUserId: userId,
        sdp: {
          type: offer.type,
          sdp: offer.sdp
        },
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
        sdp: {
          type: answer.type,
          sdp: answer.sdp
        },
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
      
      if (!localStream) {
        if (newState) {
          console.log('🎥 Starting stream with microphone...');
          await startLocalStream(true, isCameraOn);
          setIsMicOn(true);
        }
        return newState;
      }

      const audioTracks = localStream.getAudioTracks();
      
      if (audioTracks.length > 0) {
        // Đã có audio track, chỉ enable/disable
        audioTracks.forEach(track => {
          track.enabled = newState;
        });
        setIsMicOn(newState);
        
        // ✅ Emit to server to broadcast to all users (simple boolean only)
        if (socketRef.current?.connected) {
          socketRef.current.emit('media:toggle-mic', { enabled: newState });
        }
        
        console.log(`🎤 Microphone ${newState ? 'ON' : 'OFF'}`);
      } else if (newState) {
        // Thêm audio track mới
        console.log('🎤 Adding microphone track...');
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioTrack = audioStream.getAudioTracks()[0];
        
        // Ensure track is enabled
        audioTrack.enabled = true;
        
        localStream.addTrack(audioTrack);
        
        // Add/Replace track to peer connections + renegotiate
        for (const [peerUserId, pc] of peerConnections.current.entries()) {
          const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
          
          if (sender) {
            await sender.replaceTrack(audioTrack);
            console.log('🔄 Replaced audio track for peer:', peerUserId);
          } else {
            pc.addTrack(audioTrack, localStream);
            console.log('➡️ Added audio track for peer:', peerUserId);
            
            // 🚨 BẮT BUỘC: renegotiate khi add track mới
            console.log('🔁 Renegotiating for new audio track:', peerUserId);
            await createOffer(peerUserId, pc);
          }
        }
        
        setIsMicOn(true);
        
        // ✅ Emit to server to broadcast to all users (simple boolean only)
        if (socketRef.current?.connected) {
          socketRef.current.emit('media:toggle-mic', { enabled: true });
        }
        
        console.log('🎤 Microphone ON - track enabled:', audioTrack.enabled);
      }
      
      return newState;
    } catch (err) {
      console.error('Error toggling microphone:', err);
      
      // Better error handling for permissions
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert('🚫 Không có quyền truy cập microphone!\n\n' +
              '📌 Cách sửa:\n' +
              '1. Click biểu tượng 🔒 bên cạnh URL\n' +
              '2. Cho phép "Microphone"\n' +
              '3. Thử lại');
      } else {
        setError('Could not access microphone');
      }
      return false;
    }
  }, [localStream, isMicOn, isCameraOn, startLocalStream]);

  const toggleCamera = useCallback(async (enabled) => {
    try {
      const newState = enabled !== undefined ? enabled : !isCameraOn;
      
      if (!localStream) {
        if (newState) {
          console.log('🎥 Starting stream with camera...');
          await startLocalStream(isMicOn, true);
          setIsCameraOn(true);
        }
        return newState;
      }

      const videoTracks = localStream.getVideoTracks();
      
      if (videoTracks.length > 0) {
        // Đã có video track, chỉ enable/disable
        videoTracks.forEach(track => {
          track.enabled = newState;
        });
        setIsCameraOn(newState);
        
        // ✅ Emit to server to broadcast to all users (simple boolean only)
        if (socketRef.current?.connected) {
          socketRef.current.emit('media:toggle-camera', { enabled: newState });
        }
        
        console.log(`📷 Camera ${newState ? 'ON' : 'OFF'}`);
      } else if (newState) {
        // Thêm video track mới
        console.log('📷 Adding camera track...');
        const videoStream = await navigator.mediaDevices.getUserMedia({ 
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          }
        });
        const videoTrack = videoStream.getVideoTracks()[0];
        
        // Ensure track is enabled
        videoTrack.enabled = true;
        
        localStream.addTrack(videoTrack);
        
        // Add/Replace track to peer connections + renegotiate
        for (const [peerUserId, pc] of peerConnections.current.entries()) {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          
          if (sender) {
            await sender.replaceTrack(videoTrack);
            console.log('🔄 Replaced video track for peer:', peerUserId);
          } else {
            pc.addTrack(videoTrack, localStream);
            console.log('➡️ Added video track for peer:', peerUserId);
            
            // 🚨 BẮT BUỘC: renegotiate khi add track mới
            console.log('🔁 Renegotiating for new video track:', peerUserId);
            await createOffer(peerUserId, pc);
          }
        }
        
        setIsCameraOn(true);
        
        // ✅ Emit to server to broadcast to all users (simple boolean only)
        if (socketRef.current?.connected) {
          socketRef.current.emit('media:toggle-camera', { enabled: true });
        }
        
        console.log('📷 Camera ON - track enabled:', videoTrack.enabled, 'ready state:', videoTrack.readyState);
      }
      
      return newState;
    } catch (err) {
      console.error('Error toggling camera:', err);
      
      // Better error handling for permissions
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert('🚫 Không có quyền truy cập camera!\n\n' +
              '📌 Cách sửa:\n' +
              '1. Click biểu tượng 🔒 bên cạnh URL\n' +
              '2. Cho phép "Camera"\n' +
              '3. Thử lại');
      } else {
        setError('Could not access camera');
      }
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
      socketConnected: socketRef.current?.connected,
      socketId: socketRef.current?.id
    });
    
    if (!roomIdRef.current) {
      console.error('❌ No roomId!');
      alert('Không thể gửi tin nhắn: Chưa join room');
      return;
    }
    
    if (!socketRef.current) {
      console.error('❌ No socket!');
      alert('Không thể gửi tin nhắn: Không có kết nối socket');
      return;
    }
    
    if (!socketRef.current.connected) {
      console.error('❌ Socket not connected!');
      alert('Không thể gửi tin nhắn: Socket chưa kết nối');
      return;
    }
    
    // Test: Emit cả event khác để xem server có nhận không
    console.log('🧪 Testing server responsiveness...');
    socketRef.current.emit('test:ping', { timestamp: Date.now() });
    
    console.log('✅ Emitting chat:send event with message:', message);
    socketRef.current.emit('chat:send', { message });
    console.log('✅ Event emitted! Waiting for chat:message response...');
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

  // ============ APPROVAL FUNCTIONS ============
  const approveStudent = useCallback((studentUserId) => {
    if (!socketRef.current || !roomIdRef.current) return;
    
    // Check if already processing this student
    if (approvingRef.current.has(studentUserId)) {
      console.log('⚠️ Already approving this student (ref lock), ignoring:', studentUserId);
      return;
    }
    
    // Add to processing set
    approvingRef.current.add(studentUserId);
    console.log('✅ Approving student:', studentUserId);
    
    // Optimistic update: remove from waiting list immediately
    setWaitingStudents(prev => {
      const filtered = prev.filter(s => {
        const key = s.userId?.toString() || s.email;
        return key !== studentUserId;
      });
      console.log('  Optimistic: removed from waiting, new count:', filtered.length);
      return filtered;
    });
    
    // Emit with ACK callback (Socket.IO v4 syntax)
    console.log('📤 Emitting room:approve-student with studentUserId:', studentUserId);
    socketRef.current.emit(
      'room:approve-student',
      { studentUserId },
      (response) => {
        console.log('📥 ACK received from server:', response);
        if (response?.error) {
          console.error('❌ Approve failed:', response.error);
          setError(response.error);
          // Rollback: fetch waiting list again on next update
        } else {
          console.log('✅ Approve acknowledged by server');
        }
      }
    );
    
    // Clear lock after 3 seconds
    setTimeout(() => {
      approvingRef.current.delete(studentUserId);
    }, 3000);
  }, []);

  const rejectStudent = useCallback((studentUserId) => {
    if (!socketRef.current || !roomIdRef.current) return;
    
    // Check if already processing this student
    if (rejectingRef.current.has(studentUserId)) {
      console.log('⚠️ Already rejecting this student (ref lock), ignoring:', studentUserId);
      return;
    }
    
    // Add to processing set
    rejectingRef.current.add(studentUserId);
    console.log('❌ Rejecting student:', studentUserId);
    
    // Optimistic update: remove from waiting list immediately
    setWaitingStudents(prev => {
      const filtered = prev.filter(s => {
        const key = s.userId?.toString() || s.email;
        return key !== studentUserId;
      });
      console.log('  Optimistic: removed from waiting, new count:', filtered.length);
      return filtered;
    });
    
    // Emit with ACK callback (Socket.IO v4 syntax)
    console.log('📤 Emitting room:reject-student with studentUserId:', studentUserId);
    socketRef.current.emit(
      'room:reject-student',
      { studentUserId },
      (response) => {
        console.log('📥 ACK received from server:', response);
        if (response?.error) {
          console.error('❌ Reject failed:', response.error);
          setError(response.error);
        } else {
          console.log('✅ Reject acknowledged by server');
        }
      }
    );
    
    // Clear lock after 3 seconds
    setTimeout(() => {
      rejectingRef.current.delete(studentUserId);
    }, 3000);
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
    
    // Approval
    isWaitingApproval,
    waitingStudents,
    approveStudent,
    rejectStudent,
    
    // Streams
    localStream,
    remoteStreams,
    
    // Media states
    isMicOn,
    isCameraOn,
    isScreenSharing,
    remoteMediaStatus, // Map of userId -> { camera: boolean, mic: boolean }
    
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
