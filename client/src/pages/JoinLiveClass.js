import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import axios from 'axios';
import './JoinLiveClass.css';

const JoinLiveClass = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const socketRef = useRef(null);
  
  const [liveClass, setLiveClass] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [password, setPassword] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [liveClassId, setLiveClassId] = useState('');
  const [error, setError] = useState('');
  
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
  const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const joinClass = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setError('Vui lòng đăng nhập trước');
        return;
      }

      // Find live class by roomId and password
      const response = await axios.get(`${API_URL}/live-classes`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { roomId, password }
      });

      const classes = response.data.data;
      const matchingClass = classes.find(c => c.roomId === roomId && c.password === password);

      if (!matchingClass) {
        setError('Room ID hoặc mật khẩu không đúng');
        return;
      }

      if (matchingClass.status !== 'active' && matchingClass.status !== 'scheduled') {
        setError('Lớp học này chưa bắt đầu hoặc đã kết thúc');
        return;
      }

      setLiveClass(matchingClass);
      setLiveClassId(matchingClass._id);
      setIsJoined(true);
      setError('');

      // Initialize messages and questions from database
      setMessages(matchingClass.chat || []);
      setQuestions(matchingClass.questions || []);

      // Connect to socket
      connectSocket(roomId, matchingClass._id, token);
    } catch (error) {
      console.error('Error joining class:', error);
      setError('Không thể tham gia lớp học. Vui lòng kiểm tra lại thông tin');
    }
  };

  const connectSocket = (roomId, liveClassId, token) => {
    const socket = io(`${SOCKET_URL}/live`, {
      auth: { token }
    });

    socket.on('connect', () => {
      console.log('Socket connected');
      setIsConnected(true);
      
      // Join room
      socket.emit('join-room', { roomId, liveClassId });
    });

    socket.on('joined-room', ({ liveClass: lc, participants: parts }) => {
      console.log('Joined room successfully');
      setParticipants(parts);
    });

    socket.on('user-joined', ({ user, participantCount }) => {
      console.log(`${user.fullName} joined`);
      setParticipants(prev => [...prev, user]);
      addSystemMessage(`${user.fullName} đã tham gia`);
    });

    socket.on('user-left', ({ userName, participantCount }) => {
      console.log(`${userName} left`);
      setParticipants(prev => prev.filter(p => p.fullName !== userName));
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

    socket.on('force-mute', () => {
      alert('Giáo viên đã tắt micro của bạn');
      // Here you would actually mute the microphone
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
    
    if (!liveClass.settings.allowChat) {
      alert('Chat đã bị tắt');
      return;
    }
    
    socketRef.current.emit('send-message', {
      roomId,
      message: currentMessage
    });
    
    setCurrentMessage('');
  };

  const askQuestion = () => {
    if (!currentQuestion.trim() || !socketRef.current) return;
    
    if (!liveClass.settings.allowQuestions) {
      alert('Câu hỏi đã bị tắt');
      return;
    }
    
    socketRef.current.emit('ask-question', {
      roomId,
      question: currentQuestion
    });
    
    setCurrentQuestion('');
    alert('Câu hỏi của bạn đã được gửi!');
  };

  const raiseHand = () => {
    if (socketRef.current) {
      socketRef.current.emit('raise-hand', { roomId });
      alert('Bạn đã giơ tay! Giáo viên sẽ thấy thông báo');
    }
  };

  const leaveClass = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    navigate('/');
  };

  if (!isJoined) {
    return (
      <div className="join-container">
        <div className="join-card">
          <h2>🎓 Tham Gia Lớp Học Trực Tuyến</h2>
          
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
          
          <div className="join-form">
            <div className="form-group">
              <label>Room ID</label>
              <input
                type="text"
                value={roomId}
                disabled
                className="form-control"
              />
              <small>Room ID từ link tham gia</small>
            </div>
            
            <div className="form-group">
              <label>Mật Khẩu Phòng</label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu do giáo viên cung cấp"
                className="form-control"
                onKeyPress={(e) => e.key === 'Enter' && joinClass()}
              />
              <small>Giáo viên sẽ cung cấp mật khẩu này</small>
            </div>
            
            <button onClick={joinClass} className="btn-join">
              Tham Gia Lớp Học
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="student-room-container">
      <div className="student-room-header">
        <div className="header-left">
          <h2>🎥 {liveClass.title}</h2>
          <span className={`status-badge ${liveClass.status}`}>
            {liveClass.status === 'active' ? '🔴 Live' : '⏸ Đang chờ'}
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
          <button onClick={raiseHand} className="btn-secondary">
            ✋ Giơ Tay
          </button>
          <button onClick={leaveClass} className="btn-danger">
            🚪 Rời Phòng
          </button>
        </div>
      </div>

      <div className="student-room-content">
        {/* Video Area */}
        <div className="video-section">
          <div className="main-video">
            <div className="video-placeholder">
              <h3>📹 Video của giáo viên</h3>
              <p>Tính năng video call sẽ được tích hợp sau</p>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="sidebar">
          {/* Participants */}
          <div className="sidebar-section">
            <h3>👥 Người Tham Gia ({participants.length})</h3>
            <div className="participants-list">
              {participants.map((participant, index) => (
                <div key={participant.socketId || index} className="participant-item">
                  <span className={`role-badge ${participant.role}`}>
                    {participant.role === 'teacher' ? '👨‍🏫' : '👨‍🎓'}
                  </span>
                  <span className="participant-name">{participant.fullName}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Chat */}
          {liveClass.settings.allowChat && (
            <div className="sidebar-section chat-section">
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

          {/* Questions */}
          {liveClass.settings.allowQuestions && (
            <div className="sidebar-section questions-section">
              <h3>❓ Đặt Câu Hỏi</h3>
              <div className="ask-question">
                <textarea
                  value={currentQuestion}
                  onChange={(e) => setCurrentQuestion(e.target.value)}
                  placeholder="Nhập câu hỏi của bạn..."
                  rows="3"
                />
                <button onClick={askQuestion}>Gửi Câu Hỏi</button>
              </div>
              
              <div className="questions-list">
                {questions.map((q, index) => (
                  <div key={q._id || index} className={`question-item ${q.isAnswered ? 'answered' : ''}`}>
                    <div className="question-header">
                      <strong>{q.userName}</strong>
                      {q.isAnswered && <span className="answered-badge">✓ Đã trả lời</span>}
                    </div>
                    <div className="question-text">{q.question}</div>
                    {q.isAnswered && (
                      <div className="answer-text">
                        <strong>Trả lời:</strong> {q.answer}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JoinLiveClass;
