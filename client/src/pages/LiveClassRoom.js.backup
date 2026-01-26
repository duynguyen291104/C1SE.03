import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import io from 'socket.io-client';
import axios from 'axios';
import useWebRTC from '../hooks/useWebRTC';
import VideoGrid from '../components/VideoGrid';
import './LiveClassRoom.css';

const LiveClassRoom = () => {
  const { liveClassId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const socketRef = useRef(null);
  
  const [liveClass, setLiveClass] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [answerText, setAnswerText] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [joinToken, setJoinToken] = useState('');
  const [isWaitingApproval, setIsWaitingApproval] = useState(false);
  const [waitingStudents, setWaitingStudents] = useState([]);
  const [approvalSocket, setApprovalSocket] = useState(null);
  
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
  const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5001';

  // WebRTC Hook - chỉ cần joinToken, hook tự tìm SOCKET_URL
  const {
    localStream,
    remoteStreams,
    isConnected: webrtcConnected,
    isMicOn,
    isCameraOn,
    isScreenSharing,
    remoteMediaStatus,
    toggleMicrophone,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    sendMessage: sendWebRTCMessage,
    askQuestion: askWebRTCQuestion,
    raiseHand: raiseWebRTCHand,
    messages: webrtcMessages,
    questions: webrtcQuestions,
    roomData: webrtcRoomData,
    pinnedVideoUserId,
    pinMessage,
    unpinMessage,
    pinVideo,
    cleanup
  } = useWebRTC(joinToken);

  // Update participants and host status from roomData
  useEffect(() => {
    if (webrtcRoomData) {
      if (webrtcRoomData.members) {
        setParticipants(webrtcRoomData.members);
        console.log('👥 Participants updated:', webrtcRoomData.members.length, webrtcRoomData.members);
      }
      
      // Set isHost flag
      if (webrtcRoomData.isHost !== undefined) {
        setIsHost(webrtcRoomData.isHost);
        console.log('🎯 Is Host:', webrtcRoomData.isHost);
      }

      // Set waiting students if host
      if (webrtcRoomData.waitingStudents) {
        setWaitingStudents(webrtcRoomData.waitingStudents);
        console.log('⏳ Waiting students:', webrtcRoomData.waitingStudents.length);
      }
    }
  }, [webrtcRoomData]);

  // Debug: Log messages when they change
  useEffect(() => {
    console.log('💬 Messages updated:', webrtcMessages.length, webrtcMessages);
  }, [webrtcMessages]);

  // ============ Handle Room Warning & Ended Events ============
  useEffect(() => {
    if (!joinToken) return;

    const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5001';
    const socket = io(`${SOCKET_URL}/live`, {
      auth: { token: joinToken }
    });

    setApprovalSocket(socket);

    // Get current user to check role
    const userStr = localStorage.getItem('user');
    const currentUser = userStr ? JSON.parse(userStr) : null;
    const userRole = currentUser?.roles?.[0] || 'student';

    // ⏳ Waiting for approval (ONLY for students)
    socket.on('room:waiting-approval', ({ message }) => {
      console.log('⏳ Waiting for approval event received. User role:', userRole);
      
      // CHỈ student mới hiện waiting screen
      if (userRole === 'student') {
        console.log('⏳ Setting waiting approval to true');
        setIsWaitingApproval(true);
      } else {
        console.log('⚠️ Teacher received waiting-approval event - ignoring');
      }
    });

    // ✅ Approved by host
    socket.on('room:approved', ({ message }) => {
      console.log('✅ Approved:', message);
      setIsWaitingApproval(false);
      alert(message);
      // Socket sẽ tự động join room sau khi được approve
    });

    // ❌ Rejected by host
    socket.on('room:rejected', ({ message }) => {
      console.log('❌ Rejected:', message);
      alert(message || 'Giáo viên đã từ chối yêu cầu tham gia của bạn');
      cleanup();
      socket.disconnect();
      navigate('/student/classes');
    });

    // 👥 Student waiting (for host)
    socket.on('room:student-waiting', ({ student, waitingList }) => {
      console.log('👥 Student waiting:', student);
      setWaitingStudents(waitingList);
    });

    // 📝 Waiting list updated (for host)
    socket.on('room:waiting-updated', ({ waitingStudents: updated }) => {
      console.log('📝 Waiting list updated:', updated);
      setWaitingStudents(updated);
    });

    // ⚠️ Cảnh báo 30 giây trước khi kết thúc
    socket.on('room:warning', ({ message, secondsRemaining }) => {
      console.log('⚠️ Room warning event received:', message);
      
      // Hiển thị cảnh báo nổi bật
      alert(`⚠️ ${message}`);
      
      // Có thể thêm toast notification hoặc countdown timer UI
      // toast.warning(message, { autoClose: 30000 });
    });

    // 🚪 Phòng kết thúc
    socket.on('room:ended', ({ message }) => {
      console.log('🚪 Room ended event received:', message);
      
      // Hiển thị thông báo
      alert(message || 'Phòng học đã kết thúc');
      
      // Cleanup
      cleanup();
      socket.disconnect();
      
      // Redirect về trang phù hợp
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      
      if (user && user.roles && user.roles.includes('teacher')) {
        navigate('/teacher/dashboard');
      } else {
        navigate('/student/dashboard');
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [joinToken, navigate, cleanup]);

  useEffect(() => {
    loadLiveClass();
    return () => {
      cleanup(); // Cleanup WebRTC
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [liveClassId]);

  const loadLiveClass = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      
      // Check for joinToken from navigation state (student joining)
      const navJoinToken = location.state?.joinToken;
      if (navJoinToken) {
        setJoinToken(navJoinToken);
      }
      
      // Determine which endpoint to use based on user role
      let endpoint = '';
      let isTeacherUser = false;
      
      if (user && user.roles && user.roles.includes('teacher')) {
        endpoint = `${API_URL}/live-classes/${liveClassId}`;
        isTeacherUser = true;
        
        // Teacher needs to join their own class to get joinToken
        try {
          const joinResponse = await axios.post(
            `${API_URL}/student/live-classes/${liveClassId}/join`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setJoinToken(joinResponse.data.data.joinToken);
        } catch (err) {
          console.error('Teacher join error:', err);
        }
      } else {
        endpoint = `${API_URL}/student/live-classes/${liveClassId}`;
        isTeacherUser = false;
        
        // If student doesn't have joinToken from navigation, try to join
        if (!navJoinToken) {
          try {
            const joinResponse = await axios.post(
              `${API_URL}/student/live-classes/${liveClassId}/join`,
              {},
              { headers: { Authorization: `Bearer ${token}` } }
            );
            setJoinToken(joinResponse.data.data.joinToken);
          } catch (err) {
            alert('Không thể tham gia lớp học. Vui lòng thử lại.');
            navigate('/student/classes');
            return;
          }
        }
      }
      
      const response = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = response.data.data;
      setLiveClass(data);
      
      // Set roomId if available (for students who have joined)
      if (data.roomId) {
        setRoomId(data.roomId);
      }
      
      // Check if current user is teacher
      if (user && data.teacherId) {
        setIsTeacher(user._id === data.teacherId._id || user._id === data.teacherId);
      }
      
    } catch (error) {
      console.error('Error loading live class:', error);
      alert('Không thể tải thông tin lớp học');
      
      // Navigate back based on user role
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      if (user && user.roles && user.roles.includes('teacher')) {
        navigate('/teacher/create-live');
      } else {
        navigate('/student/classes');
      }
    }
  };

  const connectSocket = (roomId, token) => {
    // Connect to /live namespace
    const socket = io(`${SOCKET_URL}/live`, {
      auth: { token }
    });

    socket.on('connect', () => {
      console.log('Socket connected');
      setIsConnected(true);
      
      // Join room
      socket.emit('join-room', { roomId, liveClassId });
    });

    socket.on('joined-room', ({ liveClass: lc, participants: parts, isTeacher: teacher }) => {
      console.log('Joined room successfully');
      setParticipants(parts);
      setIsTeacher(teacher);
    });

    socket.on('user-joined', ({ user, participantCount }) => {
      console.log(`${user.fullName} joined`);
      setParticipants(prev => [...prev, user]);
    });

    socket.on('user-left', ({ userName, participantCount }) => {
      console.log(`${userName} left`);
      setParticipants(prev => prev.filter(p => p.fullName !== userName));
    });

    socket.on('hand-raised', ({ userId, userName }) => {
      console.log(`✋ ${userName} raised hand`);
    });

    socket.on('force-mute', () => {
      alert('Giáo viên đã tắt micro của bạn');
    });

    socket.on('error', ({ message }) => {
      alert(message);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    socketRef.current = socket;
  };



  const sendMessage = () => {
    if (!currentMessage.trim()) return;
    
    console.log('🚀 Sending message:', currentMessage);
    // Use WebRTC send message
    sendWebRTCMessage(currentMessage);
    
    setCurrentMessage('');
  };

  const answerQuestion = (questionId) => {
    const answer = answerText[questionId];
    if (!answer || !answer.trim() || !socketRef.current) return;
    
    socketRef.current.emit('answer-question', {
      roomId,
      questionId,
      answer
    });
    
    setAnswerText(prev => ({ ...prev, [questionId]: '' }));
  };

  const raiseHand = () => {
    raiseWebRTCHand();
  };

  const muteParticipant = (socketId) => {
    if (socketRef.current && isTeacher) {
      socketRef.current.emit('mute-participant', { roomId, socketId });
    }
  };

  // ============ APPROVAL FUNCTIONS ============
  const approveStudent = (studentUserId) => {
    if (approvalSocket && isHost) {
      console.log('✅ Approving student:', studentUserId);
      approvalSocket.emit('room:approve-student', { studentUserId });
    }
  };

  const rejectStudent = (studentUserId) => {
    if (approvalSocket && isHost) {
      console.log('❌ Rejecting student:', studentUserId);
      approvalSocket.emit('room:reject-student', { studentUserId });
    }
  };

  const startClass = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      await axios.post(`${API_URL}/live-classes/${liveClassId}/start`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setLiveClass(prev => ({ ...prev, status: 'live' }));
      alert('Lớp học đã bắt đầu!');
    } catch (error) {
      alert('Không thể bắt đầu lớp học');
    }
  };

  const endClass = async () => {
    if (!window.confirm('Bạn có chắc muốn kết thúc lớp học?')) return;
    
    try {
      const token = localStorage.getItem('accessToken');
      await axios.post(`${API_URL}/live-classes/${liveClassId}/end`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert('Lớp học đã kết thúc!');
      navigate('/teacher/create-live');
    } catch (error) {
      alert('Không thể kết thúc lớp học');
    }
  };

  const copyJoinLink = () => {
    const link = `${window.location.origin}/join-live/${roomId}`;
    navigator.clipboard.writeText(link);
    alert('Đã copy link tham gia!');
  };

  if (!liveClass) {
    return <div className="live-room-loading">Đang tải...</div>;
  }

  // ============ WAITING SCREEN (Student) ============
  if (isWaitingApproval) {
    return (
      <div className="live-room-container">
        <div className="waiting-approval-screen">
          <div className="waiting-content">
            <div className="waiting-icon">⏳</div>
            <h2>Đang chờ giáo viên duyệt</h2>
            <p>Bạn đã gửi yêu cầu tham gia lớp học</p>
            <p className="waiting-subtitle">Vui lòng đợi giáo viên phê duyệt...</p>
            <div className="loading-spinner"></div>
            <button 
              className="btn-secondary"
              onClick={() => {
                cleanup();
                if (approvalSocket) approvalSocket.disconnect();
                navigate('/student/classes');
              }}
            >
              ← Quay lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="live-room-container">
      <div className="live-room-header">
        <div className="header-left">
          <h2>🎥 {liveClass.title}</h2>
          <span className={`status-badge ${liveClass.status}`}>
            {liveClass.status === 'live' ? '🔴 Live' : '⏸ Scheduled'}
          </span>
          <span className="participant-count">
            👥 {participants.length} người tham gia
          </span>
          {isHost && waitingStudents.length > 0 && (
            <span className="waiting-badge">
              ⏳ {waitingStudents.length} chờ duyệt
            </span>
          )}
          {webrtcConnected ? (
            <span className="connection-status connected">🟢 Đã kết nối</span>
          ) : (
            <span className="connection-status disconnected">🔴 Đang kết nối...</span>
          )}
        </div>
        
        <div className="header-right">
          {isTeacher && (
            <>
              <button onClick={copyJoinLink} className="btn-secondary">
                📋 Copy Link
              </button>
              {liveClass.status === 'scheduled' && (
                <button onClick={startClass} className="btn-success">
                  ▶️ Bắt Đầu
                </button>
              )}
              {liveClass.status === 'live' && (
                <button onClick={endClass} className="btn-danger">
                  ⏹ Kết Thúc
                </button>
              )}
            </>
          )}
          {!isTeacher && (
            <button onClick={raiseHand} className="btn-secondary">
              ✋ Giơ Tay
            </button>
          )}
          <button 
            onClick={() => {
              const userStr = localStorage.getItem('user');
              const user = userStr ? JSON.parse(userStr) : null;
              if (user && user.roles && user.roles.includes('teacher')) {
                navigate('/teacher/create-live');
              } else {
                navigate('/student/classes');
              }
            }} 
            className="btn-secondary"
          >
            🚪 Rời Phòng
          </button>
        </div>
      </div>

      <div className="live-room-content">        {/* Waiting Approval Panel (Host only) */}
        {isHost && waitingStudents.length > 0 && (
          <div className="waiting-panel">
            <h3>⏳ Học sinh chờ duyệt ({waitingStudents.length})</h3>
            <div className="waiting-list">
              {waitingStudents.map((student) => (
                <div key={student.userId.toString()} className="waiting-item">
                  <div className="waiting-student-info">
                    <span className="student-avatar">👨‍🎓</span>
                    <div className="student-details">
                      <span className="student-name">{student.fullName}</span>
                      <span className="student-email">{student.email}</span>
                    </div>
                  </div>
                  <div className="waiting-actions">
                    <button 
                      onClick={() => approveStudent(student.userId.toString())}
                      className="btn-approve"
                      title="Chấp nhận"
                    >
                      ✅ Duyệt
                    </button>
                    <button 
                      onClick={() => rejectStudent(student.userId.toString())}
                      className="btn-reject"
                      title="Từ chối"
                    >
                      ❌ Từ chối
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Participants Panel */}
        <div className="participants-panel">
          <h3>👥 Người Tham Gia ({participants.length})</h3>
          <div className="participants-list">
            {participants.map((participant, index) => (
              <div key={participant.socketId || index} className="participant-item">
                <div className="participant-info">
                  <span className={`role-badge ${participant.role}`}>
                    {participant.role === 'teacher' ? '👨‍🏫' : '👨‍🎓'}
                  </span>
                  <span className="participant-name">{participant.fullName}</span>
                </div>
                {isTeacher && participant.role !== 'teacher' && (
                  <button 
                    onClick={() => muteParticipant(participant.socketId)}
                    className="btn-mute"
                    title="Tắt micro"
                  >
                    🔇
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="main-content">
          {/* Video/Content Area */}
          <div className="video-area">
            <VideoGrid
              localStream={localStream}
              remoteStreams={remoteStreams}
              participants={participants}
              currentUserId={webrtcRoomData?.user?.userId}
              localUserName={webrtcRoomData?.user?.fullName || 'You'}
              isCameraOn={isCameraOn}
              isMicOn={isMicOn}
              remoteMediaStatus={remoteMediaStatus}
              pinnedUserId={pinnedVideoUserId}
              onPinVideo={pinVideo}
            />
            
            {/* Video Controls */}
            <div className="video-controls">
              <button 
                onClick={toggleMicrophone}
                className={`control-btn ${isMicOn ? 'active' : 'inactive'}`}
                title={isMicOn ? 'Tắt micro' : 'Bật micro'}
              >
                {isMicOn ? '🎤' : '🔇'}
              </button>
              
              <button 
                onClick={toggleCamera}
                className={`control-btn ${isCameraOn ? 'active' : 'inactive'}`}
                title={isCameraOn ? 'Tắt camera' : 'Bật camera'}
              >
                {isCameraOn ? '📹' : '📷'}
              </button>
              
              <button 
                onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                className={`control-btn ${isScreenSharing ? 'active' : ''}`}
                title={isScreenSharing ? 'Dừng chia sẻ màn hình' : 'Chia sẻ màn hình'}
              >
                🖥️
              </button>
              
              <div className="connection-indicator">
                {webrtcConnected ? '🟢 Đã kết nối' : '🔴 Đang kết nối...'}
              </div>
            </div>
          </div>

          {/* Chat Area */}
          {liveClass.settings.allowChat && (
            <div className="chat-area">
              <h3>💬 Chat</h3>
              
              {/* Pinned Message Banner */}
              {webrtcMessages.find(m => m.isPinned) && (
                <div className="pinned-message-banner">
                  <div className="pinned-header">
                    <span>📌 Tin nhắn đã ghim</span>
                    {isTeacher && (
                      <button 
                        className="unpin-btn"
                        onClick={() => unpinMessage()}
                        title="Bỏ ghim"
                      >
                        ✖
                      </button>
                    )}
                  </div>
                  <div className="pinned-content">
                    <strong>{webrtcMessages.find(m => m.isPinned)?.userName}:</strong>{' '}
                    {webrtcMessages.find(m => m.isPinned)?.message}
                  </div>
                </div>
              )}
              
              <div className="messages-container">
                {webrtcMessages.map((msg, index) => (
                  <div 
                    key={msg._id || index} 
                    className={`message ${msg.isSystem ? 'system-message' : ''} ${msg.userRole === 'teacher' ? 'teacher-message' : ''} ${msg.isPinned ? 'pinned-msg' : ''}`}
                  >
                    {!msg.isSystem && (
                      <div className="message-header">
                        <span className="message-author">{msg.userName}</span>
                        <span className="message-time">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                        {isTeacher && !msg.isPinned && (
                          <button 
                            className="pin-msg-btn"
                            onClick={() => pinMessage(msg._id)}
                            title="Ghim tin nhắn"
                          >
                            📌
                          </button>
                        )}
                      </div>
                    )}
                    <div className="message-content">{msg.message}</div>
                  </div>
                ))}
              </div>
              <div className="message-input">
                <input
                  type="text"
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Nhập tin nhắn..."
                />
                <button onClick={sendMessage}>Gửi</button>
              </div>
            </div>
          )}
        </div>

        {/* Questions Panel */}
        {liveClass.settings.allowQuestions && (
          <div className="questions-panel">
            <h3>❓ Câu Hỏi ({webrtcQuestions.length})</h3>
            <div className="questions-list">
              {webrtcQuestions.map((q, index) => (
                <div key={q._id || index} className={`question-item ${q.isAnswered ? 'answered' : ''}`}>
                  <div className="question-header">
                    <strong>{q.userName}</strong>
                    <span>{new Date(q.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="question-text">{q.question}</div>
                  
                  {q.isAnswered ? (
                    <div className="answer-text">
                      <strong>Trả lời:</strong> {q.answer}
                    </div>
                  ) : (
                    isTeacher && (
                      <div className="answer-input">
                        <input
                          type="text"
                          placeholder="Nhập câu trả lời..."
                          value={answerText[q._id] || ''}
                          onChange={(e) => setAnswerText(prev => ({ 
                            ...prev, 
                            [q._id]: e.target.value 
                          }))}
                        />
                        <button onClick={() => answerQuestion(q._id)}>
                          Trả lời
                        </button>
                      </div>
                    )
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveClassRoom;
