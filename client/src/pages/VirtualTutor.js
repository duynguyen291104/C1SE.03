import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './VirtualTutor.css';

const VirtualTutor = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [selectedDocs, setSelectedDocs] = useState([]);
  const messagesEndRef = useRef(null);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

  useEffect(() => {
    fetchDocuments();
    // Add welcome message
    setMessages([{
      type: 'bot',
      content: 'Xin chào! Tôi là gia sư ảo của bạn. Tôi chỉ trả lời các câu hỏi dựa trên tài liệu bạn đã upload. Hãy chọn tài liệu và đặt câu hỏi!',
      timestamp: new Date()
    }]);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchDocuments = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(`${API_URL}/tutor/documents`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDocuments(response.data.data);
      // Auto-select all documents
      setSelectedDocs(response.data.data.map(d => d._id));
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!input.trim()) return;

    if (selectedDocs.length === 0) {
      alert('Vui lòng chọn ít nhất một tài liệu!');
      return;
    }

    const userMessage = {
      type: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.post(
        `${API_URL}/tutor/ask`,
        {
          question: input,
          documentIds: selectedDocs
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const botMessage = {
        type: 'bot',
        content: response.data.data.answer,
        sources: response.data.data.sources,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      const errorMessage = {
        type: 'bot',
        content: error.response?.data?.message || 'Xin lỗi, đã có lỗi xảy ra. Vui lòng thử lại.',
        error: true,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const toggleDocument = (docId) => {
    setSelectedDocs(prev => {
      if (prev.includes(docId)) {
        return prev.filter(id => id !== docId);
      } else {
        return [...prev, docId];
      }
    });
  };

  return (
    <div className="virtual-tutor-container">
      <div className="tutor-header">
        <h1>🤖 Gia sư ảo</h1>
        <p className="tutor-subtitle">Hỏi đáp dựa trên tài liệu của bạn</p>
      </div>

      <div className="tutor-main">
        {/* Documents Sidebar */}
        <div className="documents-sidebar">
          <h3>📚 Tài liệu</h3>
          <div className="documents-list">
            {documents.length === 0 ? (
              <p className="no-docs">Chưa có tài liệu nào. Hãy upload tài liệu trước!</p>
            ) : (
              documents.map(doc => (
                <div
                  key={doc._id}
                  className={`document-item ${selectedDocs.includes(doc._id) ? 'selected' : ''}`}
                  onClick={() => toggleDocument(doc._id)}
                >
                  <div className="doc-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedDocs.includes(doc._id)}
                      onChange={() => {}}
                    />
                  </div>
                  <div className="doc-info">
                    <div className="doc-name">{doc.originalName}</div>
                    <div className="doc-size">
                      {(doc.sizeBytes / 1024).toFixed(1)} KB
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="chat-area">
          <div className="messages-container">
            {messages.map((msg, index) => (
              <div key={index} className={`message ${msg.type}`}>
                <div className="message-avatar">
                  {msg.type === 'bot' ? '🤖' : '👤'}
                </div>
                <div className="message-content">
                  <div className="message-text">{msg.content}</div>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="message-sources">
                      <strong>Nguồn tham khảo:</strong>
                      {msg.sources.map((source, idx) => (
                        <div key={idx} className="source-item">
                          📄 {source.documentName} - Trang {source.pageNumber}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="message-time">
                    {msg.timestamp.toLocaleTimeString('vi-VN', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="message bot">
                <div className="message-avatar">🤖</div>
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <form className="chat-input-form" onSubmit={handleSubmit}>
            <input
              type="text"
              className="chat-input"
              placeholder="Đặt câu hỏi về tài liệu..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading || documents.length === 0}
            />
            <button
              type="submit"
              className="chat-submit"
              disabled={loading || !input.trim() || documents.length === 0}
            >
              {loading ? '⏳' : '📤'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default VirtualTutor;
