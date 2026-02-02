import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

const StudentDashboard = () => {
  const { user } = useAuth();

  return (
    <div className="dashboard-container">
      <h1>🎓 Bảng điều khiển Học viên</h1>
      <p className="welcome-text">Chào mừng, {user?.profile?.fullName || user?.email}!</p>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <h3>📚 Lớp học của tôi</h3>
          <p>Tham gia và quản lý các lớp học bạn đã đăng ký</p>
          <Link to="/student/classes" className="btn btn-primary">
            Xem lớp học
          </Link>
        </div>

        <div className="dashboard-card">
          <h3>📝 Bài quiz</h3>
          <p>Làm bài quiz và kiểm tra kiến thức</p>
          <Link to="/student/quizzes" className="btn btn-primary">
            Làm quiz
          </Link>
        </div>

        <div className="dashboard-card">
          <h3>📄 Tài liệu học tập</h3>
          <p>Truy cập tài liệu và slides được chia sẻ</p>
          <Link to="/student/materials" className="btn btn-primary">
            Xem tài liệu
          </Link>
        </div>

        <div className="dashboard-card">
          <h3>📊 Kết quả học tập</h3>
          <p>Xem điểm số và tiến độ học tập</p>
          <Link to="/student/results" className="btn btn-primary">
            Xem kết quả
          </Link>
        </div>

        <div className="dashboard-card">
          <h3>🤖 Gia sư ảo</h3>
          <p>Hỏi đáp thông minh dựa trên tài liệu</p>
          <Link to="/student/tutor" className="btn btn-success">
            Hỏi gia sư
          </Link>
        </div>
      </div>

      <div className="info-section">
        <h3>Thông tin tài khoản</h3>
        <div className="info-grid">
          <div>
            <strong>Email:</strong> {user?.email}
          </div>
          <div>
            <strong>Vai trò:</strong>{' '}
            {user?.roles?.map(role => (
              <span key={role} className={`badge badge-${role}`}>{role}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
