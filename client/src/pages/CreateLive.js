import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './CreateLive.css';

const CreateLive = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    scheduledStart: '',
    scheduledEnd: '',
    maxParticipants: 100,
    settings: {
      allowChat: true,
      allowQuestions: true,
      recordSession: false,
      waitingRoom: false,
      muteOnEntry: true
    }
  });
  
  const [liveClasses, setLiveClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

  useEffect(() => {
    fetchLiveClasses();
  }, []);

  const fetchLiveClasses = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        setMessage({ text: 'Vui lòng đăng nhập để tạo lớp học trực tuyến', type: 'error' });
        setTimeout(() => navigate('/login'), 2000);
        return;
      }
      
      const response = await axios.get(`${API_URL}/live-classes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLiveClasses(response.data.data);
    } catch (error) {
      console.error('Error fetching live classes:', error);
      if (error.response?.status === 401) {
        setMessage({ text: 'Phiên đăng nhập đã hết hạn', type: 'error' });
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        setTimeout(() => navigate('/login'), 2000);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title || !formData.scheduledStart || !formData.scheduledEnd) {
      setMessage({ text: 'Vui lòng điền đầy đủ thông tin', type: 'error' });
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('accessToken');
      await axios.post(`${API_URL}/live-classes`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setMessage({ text: 'Tạo lớp học trực tuyến thành công!', type: 'success' });
      setFormData({
        title: '',
        description: '',
        scheduledStart: '',
        scheduledEnd: '',
        maxParticipants: 100,
        settings: {
          allowChat: true,
          allowQuestions: true,
          recordSession: false,
          waitingRoom: false,
          muteOnEntry: true
        }
      });
      fetchLiveClasses();
    } catch (error) {
      setMessage({ text: error.response?.data?.message || 'Lỗi khi tạo lớp học', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const startClass = async (id) => {
    try {
      const token = localStorage.getItem('accessToken');
      await axios.post(`${API_URL}/live-classes/${id}/start`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage({ text: 'Bắt đầu lớp học!', type: 'success' });
      fetchLiveClasses();
    } catch (error) {
      setMessage({ text: 'Lỗi khi bắt đầu lớp học', type: 'error' });
    }
  };

  const endClass = async (id) => {
    try {
      const token = localStorage.getItem('accessToken');
      await axios.post(`${API_URL}/live-classes/${id}/end`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage({ text: 'Kết thúc lớp học!', type: 'success' });
      fetchLiveClasses();
    } catch (error) {
      setMessage({ text: 'Lỗi khi kết thúc lớp học', type: 'error' });
    }
  };

  const deleteClass = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa lớp học này?')) return;

    try {
      const token = localStorage.getItem('accessToken');
      await axios.delete(`${API_URL}/live-classes/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage({ text: 'Xóa lớp học thành công!', type: 'success' });
      fetchLiveClasses();
    } catch (error) {
      setMessage({ text: 'Lỗi khi xóa lớp học', type: 'error' });
    }
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('vi-VN');
  };

  const getStatusBadge = (status) => {
    const badges = {
      scheduled: { emoji: '📅', text: 'Đã lên lịch', class: 'scheduled' },
      live: { emoji: '🔴', text: 'Đang Live', class: 'live' },
      ended: { emoji: '✅', text: 'Đã kết thúc', class: 'ended' },
      cancelled: { emoji: '❌', text: 'Đã hủy', class: 'cancelled' }
    };
    const badge = badges[status] || badges.scheduled;
    return { ...badge };
  };

  return (
    <div className="create-live-container">
      <div className="create-live-header">
        <h1>📹 Tạo Lớp Học Trực Tuyến</h1>
        <p>Lên lịch và quản lý các buổi học trực tuyến</p>
      </div>

      {message.text && (
        <div className={`message ${message.type}`}>{message.text}</div>
      )}

      <div className="live-editor">
        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <h2>Thông Tin Lớp Học</h2>
            
            <div className="form-group">
              <label>Tiêu đề <span className="required">*</span></label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="Ví dụ: Học Toán - Chương 1: Hàm số"
                required
              />
            </div>

            <div className="form-group">
              <label>Mô tả</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Mô tả nội dung buổi học"
                rows="3"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Thời gian bắt đầu <span className="required">*</span></label>
                <input
                  type="datetime-local"
                  value={formData.scheduledStart}
                  onChange={(e) => setFormData({...formData, scheduledStart: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label>Thời gian kết thúc <span className="required">*</span></label>
                <input
                  type="datetime-local"
                  value={formData.scheduledEnd}
                  onChange={(e) => setFormData({...formData, scheduledEnd: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Số người tham gia tối đa</label>
              <input
                type="number"
                value={formData.maxParticipants}
                onChange={(e) => setFormData({...formData, maxParticipants: parseInt(e.target.value)})}
                min="1"
                max="500"
              />
            </div>

            <div className="form-section">
              <h3>Cài Đặt</h3>
              
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.settings.allowChat}
                    onChange={(e) => setFormData({
                      ...formData,
                      settings: {...formData.settings, allowChat: e.target.checked}
                    })}
                  />
                  💬 Cho phép chat
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.settings.allowQuestions}
                    onChange={(e) => setFormData({
                      ...formData,
                      settings: {...formData.settings, allowQuestions: e.target.checked}
                    })}
                  />
                  ❓ Cho phép hỏi đáp
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.settings.recordSession}
                    onChange={(e) => setFormData({
                      ...formData,
                      settings: {...formData.settings, recordSession: e.target.checked}
                    })}
                  />
                  🎥 Ghi hình buổi học
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.settings.waitingRoom}
                    onChange={(e) => setFormData({
                      ...formData,
                      settings: {...formData.settings, waitingRoom: e.target.checked}
                    })}
                  />
                  🚪 Phòng chờ
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.settings.muteOnEntry}
                    onChange={(e) => setFormData({
                      ...formData,
                      settings: {...formData.settings, muteOnEntry: e.target.checked}
                    })}
                  />
                  🔇 Tắt micro khi vào
                </label>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Đang tạo...' : '📅 Tạo Lớp Học'}
            </button>
          </div>
        </form>
      </div>

      <div className="live-classes-section">
        <h2>Lớp Học Đã Tạo ({liveClasses.length})</h2>
        
        {liveClasses.length === 0 ? (
          <p className="empty-state">Chưa có lớp học nào.</p>
        ) : (
          <div className="live-classes-grid">
            {liveClasses.map((liveClass) => {
              const badge = getStatusBadge(liveClass.status);
              return (
                <div key={liveClass._id} className="live-card">
                  <div className="live-card-header">
                    <h3>{liveClass.title}</h3>
                    <span className={`status-badge ${badge.class}`}>
                      {badge.emoji} {badge.text}
                    </span>
                  </div>
                  
                  <p>{liveClass.description || 'Không có mô tả'}</p>
                  
                  <div className="live-meta">
                    <div>⏰ Bắt đầu: {formatDateTime(liveClass.scheduledStart)}</div>
                    <div>🏁 Kết thúc: {formatDateTime(liveClass.scheduledEnd)}</div>
                    <div>👥 Tối đa: {liveClass.maxParticipants} người</div>
                    <div>📊 Đã tham gia: {liveClass.participants?.length || 0} người</div>
                  </div>

                  {liveClass.roomId && (
                    <div className="room-info">
                      <small>🔑 Room ID: {liveClass.roomId}</small>
                    </div>
                  )}

                  <div className="live-card-actions">
                    {(liveClass.status === 'scheduled' || liveClass.status === 'active') && (
                      <button 
                        onClick={() => navigate(`/teacher/live-room/${liveClass._id}`)} 
                        className="btn-join"
                      >
                        🎥 Vào Phòng
                      </button>
                    )}
                    {liveClass.status === 'scheduled' && (
                      <button onClick={() => startClass(liveClass._id)} className="btn-start">
                        ▶️ Bắt đầu
                      </button>
                    )}
                    {liveClass.status === 'active' && (
                      <button onClick={() => endClass(liveClass._id)} className="btn-end">
                        ⏹️ Kết thúc
                      </button>
                    )}
                    <button onClick={() => deleteClass(liveClass._id)} className="btn-delete">
                      🗑️ Xóa
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateLive;
