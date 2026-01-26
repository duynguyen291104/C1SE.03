import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  
  const [liveClass, setLiveClass] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [answerText, setAnswerText] = useState({});
  const [isHost, setIsHost] = useState(false);
  const [joinToken, setJoinToken] = useState('');
  
  // Sidebar panels state
  const [activePanel, setActivePanel] = useState(null); // 'participants', 'waiting', 'questions', 'chat'
  
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
  const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5001';

  // WebRTC Hook
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
    cleanup,
    // Approval from hook
    isWaitingApproval,
    waitingStudents,
    approveStudent,
    rejectStudent
  } = useWebRTC(joinToken);

  // ============ DEDUPLICATE PARTICIPANTS ============
  const uniqueParticipants = useMemo(() => {
    if (!webrtcRoomData?.members) return [];
    
    // Remove duplicates by userId
    const uniqueMap = new Map();
    webrtcRoomData.members.forEach(p => {
      if (p && p.userId) {
        uniqueMap.set(p.userId, p);
      }
    });
    
    return Array.from(uniqueMap.values());
  }, [webrtcRoomData?.members]);

  // Update participants from roomData
  useEffect(() => {
    if (webrtcRoomData) {
      setParticipants(uniqueParticipants);
      
      if (webrtcRoomData.isHost !== undefined) {
        setIsHost(webrtcRoomData.isHost);
      }
    }
  }, [uniqueParticipants, webrtcRoomData]);

  // ============ Load Live Class ============
  useEffect(() => {
    loadLiveClass();
    return () => {
      cleanup();
    };
  }, [liveClassId]); // eslint-disable-line

  // ============ Handle room:rejected navigation ============
  useEffect(() => {
    // Room:ended and room:rejected are handled in useWebRTC
    // We just need to navigate when isWaitingApproval becomes false due to rejection
    // This is already handled by the alert in useWebRTC hook
  }, []);

  const loadLiveClass = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      
      const navJoinToken = location.state?.joinToken;
      if (navJoinToken) {
        setJoinToken(navJoinToken);
      }
      
      let endpoint = '';
      
      if (user?.roles?.includes('teacher')) {
        endpoint = `${API_URL}/live-classes/${liveClassId}`;
        
        // Teacher auto-join their own class
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
      
      setLiveClass(response.data.data);
      
    } catch (error) {
      console.error('Error loading live class:', error);
      alert('Không thể tải thông tin lớp học');
      
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user.roles?.includes('teacher')) {
        navigate('/teacher/create-live');
      } else {
        navigate('/student/classes');
      }
    }
  };

  // ============ ROOM CONTROLS ============
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

  const sendMessage = () => {
    if (!currentMessage.trim()) return;
    sendWebRTCMessage(currentMessage);
    setCurrentMessage('');
  };

  const answerQuestion = (questionId) => {
    const answer = answerText[questionId];
    if (!answer || !answer.trim()) return;
    
    // Implement answer question via WebRTC
    setAnswerText(prev => ({ ...prev, [questionId]: '' }));
  };

  const togglePanel = (panelName) => {
    setActivePanel(prev => prev === panelName ? null : panelName);
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

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isTeacher = user.roles?.includes('teacher');

  return (
    <div className="live-room-container">
      {/* ============ HEADER ============ */}
      <div className="live-room-header">
        <div className="header-left">
          <h2>🎥 {liveClass.title}</h2>
          <span className={`status-badge ${liveClass.status}`}>
            {liveClass.status === 'live' ? '🔴 Live' : '⏸ Scheduled'}
          </span>
          {isHost && waitingStudents.length > 0 && (
            <span className="waiting-badge">
              ⏳ {waitingStudents.length} chờ duyệt
            </span>
          )}
          {webrtcConnected ? (
            <span className="connection-status connected">🟢 Connected</span>
          ) : (
            <span className="connection-status disconnected">🔴 Connecting...</span>
          )}
        </div>
        
        <div className="header-right">
          {isTeacher && (
            <>
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
          <button 
            onClick={() => {
              cleanup();
              navigate(isTeacher ? '/teacher/create-live' : '/student/classes');
            }} 
            className="btn-secondary"
          >
            🚪 Rời Phòng
          </button>
        </div>
      </div>

      {/* ============ MAIN CONTENT ============ */}
      <div className="live-room-content">
        {/* ============ VIDEO AREA (CENTER) ============ */}
        <div className="video-main-area">
          <div className="video-container">
            <VideoGrid
              localStream={localStream}
              remoteStreams={remoteStreams}
              participants={uniqueParticipants}
              currentUserId={webrtcRoomData?.user?.userId}
              localUserName={webrtcRoomData?.user?.fullName || 'You'}
              isCameraOn={isCameraOn}
              isMicOn={isMicOn}
              remoteMediaStatus={remoteMediaStatus}
              pinnedUserId={pinnedVideoUserId}
              onPinVideo={pinVideo}
            />
            
            {/* Video Controls Overlay */}
            <div className="video-controls-overlay">
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
                title="Chia sẻ màn hình"
              >
                🖥️
              </button>
              
              <div className="connection-indicator">
                {webrtcConnected ? '🟢 Connected' : '🔴 Connecting...'}
              </div>
            </div>
          </div>
        </div>

        {/* ============ BOTTOM TOOLBAR ============ */}
        <div className="bottom-toolbar">
          <div 
            className={`toolbar-item ${activePanel === 'participants' ? 'active' : ''}`}
            onClick={() => togglePanel('participants')}
          >
            <div className="toolbar-icon">👥</div>
            <div className="toolbar-label">Người tham gia ({uniqueParticipants.length})</div>
          </div>

          {isHost && (
            <div 
              className={`toolbar-item ${activePanel === 'waiting' ? 'active' : ''}`}
              onClick={() => togglePanel('waiting')}
            >
              <div className="toolbar-icon">⏳</div>
              <div className="toolbar-label">Chờ duyệt ({waitingStudents.length})</div>
              {waitingStudents.length > 0 && (
                <div className="toolbar-badge warning">{waitingStudents.length}</div>
              )}
            </div>
          )}

          <div 
            className={`toolbar-item ${activePanel === 'questions' ? 'active' : ''}`}
            onClick={() => togglePanel('questions')}
          >
            <div className="toolbar-icon">❓</div>
            <div className="toolbar-label">Câu hỏi ({webrtcQuestions.length})</div>
            {webrtcQuestions.filter(q => !q.isAnswered).length > 0 && (
              <div className="toolbar-badge">{webrtcQuestions.filter(q => !q.isAnswered).length}</div>
            )}
          </div>

          <div 
            className={`toolbar-item ${activePanel === 'chat' ? 'active' : ''}`}
            onClick={() => togglePanel('chat')}
          >
            <div className="toolbar-icon">💬</div>
            <div className="toolbar-label">Chat</div>
          </div>
        </div>
      </div>

      {/* ============ SIDEBAR PANELS ============ */}
      
      {/* Participants Panel */}
      <div className={`sidebar-panel ${activePanel === 'participants' ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h3>👥 Người tham gia ({uniqueParticipants.length})</h3>
          <button className="sidebar-close" onClick={() => setActivePanel(null)}>✕</button>
        </div>
        <div className="sidebar-content">
          {uniqueParticipants.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">👥</div>
              <div className="empty-state-text">Chưa có người tham gia</div>
            </div>
          ) : (
            uniqueParticipants.map((participant) => (
              <div key={participant.userId} className="participant-item">
                <div className="participant-info">
                  <span className={`role-badge ${participant.role}`}>
                    {participant.role === 'teacher' ? '👨‍🏫' : '👨‍🎓'}
                  </span>
                  <span className="participant-name">{participant.fullName}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Waiting Students Panel */}
      {isHost && (
        <div className={`sidebar-panel ${activePanel === 'waiting' ? 'open' : ''}`}>
          <div className="sidebar-header">
            <h3>⏳ Chờ duyệt ({waitingStudents.length})</h3>
            <button className="sidebar-close" onClick={() => setActivePanel(null)}>✕</button>
          </div>
          <div className="sidebar-content">
            {waitingStudents.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">⏳</div>
                <div className="empty-state-text">Không có học sinh chờ duyệt</div>
              </div>
            ) : (
              waitingStudents.map((student) => (
                <div key={student.userId?.toString() || student.email} className="waiting-item">
                  <div className="waiting-student-info">
                    <span className="student-avatar">👨‍🎓</span>
                    <div className="student-details">
                      <span className="student-name">{student.fullName}</span>
                      <span className="student-email">{student.email}</span>
                    </div>
                  </div>
                  <div className="waiting-actions">
                    <button 
                      onClick={() => approveStudent(student.userId?.toString())}
                      className="btn-approve"
                    >
                      ✅ Duyệt
                    </button>
                    <button 
                      onClick={() => rejectStudent(student.userId?.toString())}
                      className="btn-reject"
                    >
                      ❌ Từ chối
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Chat Panel */}
      <div className={`sidebar-panel ${activePanel === 'chat' ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h3>💬 Chat</h3>
          <button className="sidebar-close" onClick={() => setActivePanel(null)}>✕</button>
        </div>
        
        {/* Pinned Message Banner */}
        {webrtcMessages.find(m => m.isPinned) && (
          <div className="pinned-message-banner">
            <div className="pinned-header">
              <span>📌 Tin nhắn đã ghim</span>
              {isTeacher && (
                <button className="unpin-btn" onClick={() => unpinMessage()}>✖</button>
              )}
            </div>
            <div className="pinned-content">
              <strong>{webrtcMessages.find(m => m.isPinned)?.userName}:</strong>{' '}
              {webrtcMessages.find(m => m.isPinned)?.message}
            </div>
          </div>
        )}
        
        <div className="chat-messages">
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
                    <button className="pin-msg-btn" onClick={() => pinMessage(msg._id)}>
                      📌
                    </button>
                  )}
                </div>
              )}
              <div className="message-content">{msg.message}</div>
            </div>
          ))}
        </div>
        
        <div className="chat-input">
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

      {/* Questions Panel */}
      <div className={`sidebar-panel ${activePanel === 'questions' ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h3>❓ Câu hỏi ({webrtcQuestions.length})</h3>
          <button className="sidebar-close" onClick={() => setActivePanel(null)}>✕</button>
        </div>
        <div className="sidebar-content">
          {webrtcQuestions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">❓</div>
              <div className="empty-state-text">Chưa có câu hỏi nào</div>
            </div>
          ) : (
            webrtcQuestions.map((q, index) => (
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
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveClassRoom;
