import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../api/axios';
import './StudentLiveClasses.css';

const StudentLiveClasses = () => {
  const navigate = useNavigate();
  const [liveClasses, setLiveClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('live'); // 'live', 'upcoming', 'all'
  const [joining, setJoining] = useState(null);

  useEffect(() => {
    fetchLiveClasses();
  }, [filter]);

  const fetchLiveClasses = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/student/live-classes/available', {
        params: { status: filter }
      });
      
      if (response.data.success) {
        setLiveClasses(response.data.data);
      }
      setError('');
    } catch (err) {
      console.error('Error fetching live classes:', err);
      setError(err.response?.data?.message || 'Không thể tải danh sách lớp học');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinClass = async (classId) => {
    try {
      setJoining(classId);
      const response = await axios.post(`/student/live-classes/${classId}/join`);
      
      if (response.data.success) {
        const { joinToken } = response.data.data;
        // Navigate to live classroom with joinToken
        navigate(`/live-room/${classId}`, {
          state: { joinToken }
        });
      }
    } catch (err) {
      console.error('Error joining class:', err);
      alert(err.response?.data?.message || 'Không thể tham gia lớp học');
    } finally {
      setJoining(null);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const badges = {
      live: { text: '🔴 Đang phát', className: 'status-live' },
      scheduled: { text: '🕐 Sắp diễn ra', className: 'status-scheduled' },
      ended: { text: '✓ Đã kết thúc', className: 'status-ended' }
    };
    return badges[status] || { text: status, className: 'status-default' };
  };

  return (
    <div className="student-live-classes-container">
      <div className="page-header">
        <h1>📺 Lớp học trực tuyến</h1>
        <p>Tham gia các lớp học trực tiếp do giáo viên mở</p>
      </div>

      {/* Filter tabs */}
      <div className="filter-tabs">
        <button 
          className={`filter-tab ${filter === 'live' ? 'active' : ''}`}
          onClick={() => setFilter('live')}
        >
          🔴 Đang phát
        </button>
        <button 
          className={`filter-tab ${filter === 'upcoming' ? 'active' : ''}`}
          onClick={() => setFilter('upcoming')}
        >
          🕐 Sắp diễn ra
        </button>
        <button 
          className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          📋 Tất cả
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="error-message">
          <span>⚠️ {error}</span>
          <button onClick={fetchLiveClasses}>Thử lại</button>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Đang tải danh sách lớp học...</p>
        </div>
      ) : (
        <>
          {/* Live classes grid */}
          {liveClasses.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📺</div>
              <h3>Không có lớp học nào</h3>
              <p>
                {filter === 'live' && 'Hiện tại không có lớp học trực tiếp nào đang diễn ra'}
                {filter === 'upcoming' && 'Không có lớp học nào được lên lịch sắp tới'}
                {filter === 'all' && 'Chưa có lớp học nào được tạo'}
              </p>
            </div>
          ) : (
            <div className="live-classes-grid">
              {liveClasses.map((liveClass) => {
                const statusBadge = getStatusBadge(liveClass.status);
                const isLive = liveClass.status === 'live';
                const isFull = liveClass.participantCount >= liveClass.maxParticipants;
                const hasJoined = liveClass.hasJoined;

                return (
                  <div key={liveClass._id} className={`live-class-card ${isLive ? 'live-pulse' : ''}`}>
                    {/* Status badge */}
                    <div className={`status-badge ${statusBadge.className}`}>
                      {statusBadge.text}
                    </div>

                    {/* Card content */}
                    <div className="card-content">
                      <h3 className="class-title">{liveClass.title}</h3>
                      
                      {liveClass.description && (
                        <p className="class-description">{liveClass.description}</p>
                      )}

                      {/* Teacher info */}
                      <div className="teacher-info">
                        <span className="teacher-icon">👨‍🏫</span>
                        <span className="teacher-name">
                          {liveClass.teacherId?.profile?.fullName || liveClass.teacherId?.email}
                        </span>
                      </div>

                      {/* Class info */}
                      <div className="class-info">
                        <div className="info-item">
                          <span className="info-icon">🕐</span>
                          <span className="info-text">
                            {formatDate(liveClass.scheduledStart)}
                          </span>
                        </div>
                        
                        <div className="info-item" title={`Tổng lượt truy cập: ${liveClass.totalVisits || 0}`}>
                          <span className="info-icon">👥</span>
                          <span className="info-text">
                            {isLive 
                              ? `${liveClass.currentParticipants || 0} người đang online` 
                              : `${liveClass.participantCount || 0}/${liveClass.maxParticipants || '∞'} người`
                            }
                          </span>
                        </div>
                      </div>

                      {/* Course info if available */}
                      {liveClass.courseId && (
                        <div className="course-tag">
                          📚 {liveClass.courseId.title}
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="card-actions">
                      {isLive ? (
                        <>
                          {hasJoined ? (
                            <button 
                              className="btn btn-success"
                              onClick={() => handleJoinClass(liveClass._id)}
                            >
                              ✓ Vào lớp học
                            </button>
                          ) : isFull ? (
                            <button className="btn btn-disabled" disabled>
                              🚫 Đã đầy
                            </button>
                          ) : (
                            <button 
                              className="btn btn-primary"
                              onClick={() => handleJoinClass(liveClass._id)}
                              disabled={joining === liveClass._id}
                            >
                              {joining === liveClass._id ? '⏳ Đang tham gia...' : '🚀 Tham gia ngay'}
                            </button>
                          )}
                        </>
                      ) : (
                        <button className="btn btn-secondary" disabled>
                          ⏰ Chưa bắt đầu
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default StudentLiveClasses;
