import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import axios from 'axios';
import './LiveClassRoom.css';

const LiveClassRoom = () => {
  const { liveClassId } = useParams();
  const navigate = useNavigate();
  const socketRef = useRef(null);
  
  const [liveClass, setLiveClass] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [answerText, setAnswerText] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  const [roomId, setRoomId] = useState('');
  
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
  const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5001';

  useEffect(() => {
    loadLiveClass();
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [liveClassId]);

  const loadLiveClass = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(`${API_URL}/live-classes/${liveClassId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = response.data.data;
      setLiveClass(data);
      setRoomId(data.roomId);
      
      // Check if current user is teacher
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        setIsTeacher(user._id === data.teacherId._id);
      }
      
      // Initialize messages and questions from database
      setMessages(data.chat || []);
      setQuestions(data.questions || []);
      
      // Connect to socket
      connectSocket(data.roomId, token);
    } catch (error) {
      console.error('Error loading live class:', error);
      alert('Failed to load live class');
      navigate('/teacher/create-live');
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
      
      // Show notification
      addSystemMessage(`${user.fullName} đã tham gia`);
    });

    socket.on('user-left', ({ userName, participantCount }) => {
      console.log(`${userName} left`);
      setParticipants(prev => prev.filter(p => p.fullName !== userName));
      
      // Show notification
      addSystemMessage(`${userName} đã rời phòng`);
    });

    socket.on('new-message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    socket.on('new-question', (question) => {
      setQuestions(prev => [...prev, question]);
    });

    socket.on('question-answered', ({ questionId, answer, answeredAt }) => {
      setQuestions(prev => prev.map(q => 
        q._id === questionId 
          ? { ...q, answer, isAnswered: true, answeredAt }
          : q
      ));
    });

    socket.on('hand-raised', ({ userId, userName }) => {
      addSystemMessage(`✋ ${userName} đã giơ tay`);
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

  const addSystemMessage = (text) => {
    setMessages(prev => [...prev, {
      _id: Date.now().toString(),
      userName: 'System',
      message: text,
      timestamp: new Date(),
      isSystem: true
    }]);
  };

  const sendMessage = () => {
    if (!currentMessage.trim() || !socketRef.current) return;
    
    socketRef.current.emit('send-message', {
      roomId,
      message: currentMessage
    });
    
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
    if (socketRef.current) {
      socketRef.current.emit('raise-hand', { roomId });
    }
  };

  const muteParticipant = (socketId) => {
    if (socketRef.current && isTeacher) {
      socketRef.current.emit('mute-participant', { roomId, socketId });
    }
  };

  const startClass = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      await axios.post(`${API_URL}/live-classes/${liveClassId}/start`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setLiveClass(prev => ({ ...prev, status: 'active' }));
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

  return (
    <div className="live-room-container">
      <div className="live-room-header">
        <div className="header-left">
          <h2>🎥 {liveClass.title}</h2>
          <span className={`status-badge ${liveClass.status}`}>
            {liveClass.status === 'active' ? '🔴 Live' : '⏸ Scheduled'}
          </span>
          <span className="participant-count">
            👥 {participants.length} người tham gia
          </span>
          {isConnected ? (
            <span className="connection-status connected">🟢 Đã kết nối</span>
          ) : (
            <span className="connection-status disconnected">🔴 Mất kết nối</span>
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
              {liveClass.status === 'active' && (
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
          <button onClick={() => navigate('/teacher/create-live')} className="btn-secondary">
            🚪 Rời Phòng
          </button>
        </div>
      </div>

      <div className="live-room-content">
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
            <div className="video-placeholder">
              <h3>📹 Khu vực video</h3>
              <p>Tính năng video call sẽ được tích hợp sau</p>
              <div className="room-info">
                <p><strong>Room ID:</strong> {roomId}</p>
                <p><strong>Password:</strong> {liveClass.password}</p>
              </div>
            </div>
          </div>

          {/* Chat Area */}
          {liveClass.settings.allowChat && (
            <div className="chat-area">
              <h3>💬 Chat</h3>
              <div className="messages-container">
                {messages.map((msg, index) => (
                  <div 
                    key={msg._id || index} 
                    className={`message ${msg.isSystem ? 'system-message' : ''} ${msg.userRole === 'teacher' ? 'teacher-message' : ''}`}
                  >
                    {!msg.isSystem && (
                      <div className="message-header">
                        <span className="message-author">{msg.userName}</span>
                        <span className="message-time">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
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
            <h3>❓ Câu Hỏi ({questions.length})</h3>
            <div className="questions-list">
              {questions.map((q, index) => (
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
