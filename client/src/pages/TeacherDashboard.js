import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

const TeacherDashboard = () => {
  const { user, isApprovedTeacher } = useAuth();

  return (
    <div className="dashboard-container">
      <h1>👨‍🏫 Bảng điều khiển Giáo viên</h1>
      <p className="welcome-text">Chào mừng, {user?.profile?.fullName || user?.email}!</p>

      {user?.teacherStatus !== 'approved' && (
        <div className="alert alert-warning">
          <h3>⚠️ Trạng thái tài khoản giáo viên</h3>
          <p>
            Trạng thái hiện tại: <span className={`badge badge-${user?.teacherStatus}`}>
              {user?.teacherStatus === 'pending' ? 'Chờ duyệt' : user?.teacherStatus}
            </span>
          </p>
          {user?.teacherStatus === 'pending' && (
            <p>Tài khoản của bạn đang chờ quản trị viên phê duyệt. Một số tính năng bị giới hạn.</p>
          )}
          {user?.teacherStatus === 'rejected' && (
            <p>Yêu cầu làm giáo viên của bạn đã bị từ chối. Vui lòng liên hệ quản trị viên.</p>
          )}
        </div>
      )}

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <h3>📊 Thống kê & Phân tích</h3>
          <p>Xem thống kê câu hỏi sai và chủ đề yếu</p>
          <Link to="/teacher/stats" className="btn btn-primary">
            Xem thống kê
          </Link>
        </div>

        <div className="dashboard-card">
          <h3>📊 Tạo Slide từ tài liệu</h3>
          <p>Upload file và tự động tạo slide bài giảng</p>
          <Link to="/teacher/create-slide" className="btn btn-primary">
            Tạo slide
          </Link>
        </div>

        <div className="dashboard-card">
          <h3>📝 Tạo Quiz từ tài liệu</h3>
          <p>Tạo câu hỏi trắc nghiệm tự động từ file</p>
          <Link to="/teacher/create-quiz" className="btn btn-primary">
            Tạo quiz
          </Link>
        </div>

        <div className={`dashboard-card ${!isApprovedTeacher() ? 'disabled' : ''}`}>
          <h3>🎥 Tạo lớp học Live</h3>
          <p>Tổ chức buổi học trực tuyến với học viên</p>
          {isApprovedTeacher() ? (
            <Link to="/teacher/create-live" className="btn btn-success">
              Tạo lớp live
            </Link>
          ) : (
            <button className="btn btn-secondary" disabled>
              Cần phê duyệt
            </button>
          )}
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
          <div>
            <strong>Trạng thái giáo viên:</strong>{' '}
            <span className={`badge badge-${user?.teacherStatus}`}>
              {user?.teacherStatus}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;
