import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

const ChooseRole = () => {
  const [selectedRole, setSelectedRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { assignRole, user } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedRole) {
      setError('Vui lòng chọn vai trò');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await assignRole(selectedRole);
      
      if (selectedRole === 'teacher') {
        alert(response.message);
        navigate('/dashboard');
      } else {
        navigate('/student/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Gán vai trò thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Chọn vai trò của bạn</h2>
        <p className="auth-subtitle">
          Xin chào {user?.profile?.fullName || user?.email}
        </p>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="role-options">
            <div
              className={`role-card ${selectedRole === 'student' ? 'selected' : ''}`}
              onClick={() => setSelectedRole('student')}
            >
              <h3>🎓 Học viên</h3>
              <p>Tham gia lớp học, làm bài quiz, học tập</p>
              <div className="role-features">
                <div>✓ Tham gia lớp học trực tuyến</div>
                <div>✓ Làm bài quiz và đánh giá</div>
                <div>✓ Xem tài liệu học tập</div>
              </div>
            </div>

            <div
              className={`role-card ${selectedRole === 'teacher' ? 'selected' : ''}`}
              onClick={() => setSelectedRole('teacher')}
            >
              <h3>👨‍🏫 Giáo viên</h3>
              <p>Tạo nội dung, tổ chức lớp học (cần duyệt)</p>
              <div className="role-features">
                <div>✓ Tạo slide từ tài liệu</div>
                <div>✓ Tạo quiz tự động</div>
                <div>✓ Tổ chức lớp học live (sau khi được duyệt)</div>
              </div>
              <div className="role-note">
                ⚠️ Vai trò giáo viên cần quản trị viên phê duyệt
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary btn-block" 
            disabled={loading || !selectedRole}
          >
            {loading ? 'Đang xử lý...' : 'Xác nhận'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChooseRole;
