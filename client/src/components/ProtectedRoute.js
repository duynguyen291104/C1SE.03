import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, requiredRole, requireApprovedTeacher }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Đang tải...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check if user has required role
  if (requiredRole && !user.roles?.includes(requiredRole)) {
    return <Navigate to="/dashboard" replace />;
  }

  // Check if approved teacher is required
  if (requireApprovedTeacher) {
    const isApproved = user.roles?.includes('teacher') && user.teacherStatus === 'approved';
    if (!isApproved) {
      return (
        <div className="container">
          <div className="card">
            <h2>Truy cập bị từ chối</h2>
            <p>Bạn cần được duyệt làm giáo viên để truy cập tính năng này.</p>
            <p>Trạng thái hiện tại: <span className={`badge badge-${user.teacherStatus}`}>
              {user.teacherStatus}
            </span></p>
          </div>
        </div>
      );
    }
  }

  return children;
};

export default ProtectedRoute;
