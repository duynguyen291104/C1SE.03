import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import './Dashboard.css';

const AdminDashboard = () => {
  const { user } = useAuth();
  const [pendingTeachers, setPendingTeachers] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTeachers: 0,
    pendingTeachers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [teachersRes, usersRes] = await Promise.all([
        api.get('/admin/teachers/pending'),
        api.get('/admin/users'),
      ]);

      setPendingTeachers(teachersRes.data.teachers);
      
      const users = usersRes.data.users;
      setStats({
        totalUsers: usersRes.data.total,
        totalTeachers: users.filter(u => u.roles.includes('teacher')).length,
        pendingTeachers: teachersRes.data.count,
      });
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId) => {
    try {
      await api.patch(`/admin/teachers/${userId}/approve`);
      alert('Đã duyệt giáo viên thành công!');
      fetchData();
    } catch (error) {
      alert('Lỗi: ' + (error.response?.data?.error || 'Không thể duyệt'));
    }
  };

  const handleReject = async (userId) => {
    if (!window.confirm('Bạn có chắc muốn từ chối giáo viên này?')) return;
    
    try {
      await api.patch(`/admin/teachers/${userId}/reject`);
      alert('Đã từ chối yêu cầu!');
      fetchData();
    } catch (error) {
      alert('Lỗi: ' + (error.response?.data?.error || 'Không thể từ chối'));
    }
  };

  if (loading) {
    return <div className="loading">Đang tải...</div>;
  }

  return (
    <div className="dashboard-container">
      <h1>🛡️ Bảng điều khiển Quản trị viên</h1>
      <p className="welcome-text">Chào Admin, {user?.profile?.fullName || user?.email}!</p>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <h3>{stats.totalUsers}</h3>
          <p>Tổng người dùng</p>
        </div>
        <div className="stat-card">
          <h3>{stats.totalTeachers}</h3>
          <p>Giáo viên</p>
        </div>
        <div className="stat-card warning">
          <h3>{stats.pendingTeachers}</h3>
          <p>Chờ duyệt</p>
        </div>
      </div>

      {/* Pending Teachers */}
      <div className="section">
        <h2>👥 Giáo viên chờ duyệt</h2>
        
        {pendingTeachers.length === 0 ? (
          <p>Không có giáo viên nào chờ duyệt.</p>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Họ tên</th>
                  <th>Email</th>
                  <th>Ngày đăng ký</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {pendingTeachers.map(teacher => (
                  <tr key={teacher._id}>
                    <td>{teacher.profile.fullName || 'Chưa cập nhật'}</td>
                    <td>{teacher.email}</td>
                    <td>{new Date(teacher.createdAt).toLocaleDateString('vi-VN')}</td>
                    <td>
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => handleApprove(teacher._id)}
                      >
                        Duyệt
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleReject(teacher._id)}
                        style={{ marginLeft: '8px' }}
                      >
                        Từ chối
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="dashboard-grid">
        <div className="dashboard-card">
          <h3>👥 Quản lý người dùng</h3>
          <p>Xem và quản lý tất cả người dùng</p>
          <a href="/admin/users" className="btn btn-primary">
            Quản lý
          </a>
        </div>

        <div className="dashboard-card">
          <h3>🚫 Từ cấm</h3>
          <p>Quản lý danh sách từ ngữ bị cấm</p>
          <a href="/admin/banned-words" className="btn btn-primary">
            Quản lý
          </a>
        </div>

        <div className="dashboard-card">
          <h3>📊 Báo cáo</h3>
          <p>Xem báo cáo và thống kê hệ thống</p>
          <a href="/admin/reports" className="btn btn-primary">
            Xem báo cáo
          </a>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
