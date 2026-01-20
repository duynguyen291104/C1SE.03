import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const { user, logout, isAuthenticated } = useAuth();

  const handleLogout = async () => {
    if (window.confirm('Bạn có chắc muốn đăng xuất?')) {
      await logout();
      window.location.href = '/login';
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/dashboard" className="navbar-brand">
          🎓 Edu Ecosystem
        </Link>

        <div className="navbar-menu">
          <div className="navbar-user">
            <span className="user-name">{user?.profile?.fullName || user?.email}</span>
            <div className="user-roles">
              {user?.roles?.map(role => (
                <span key={role} className={`badge badge-${role}`}>
                  {role}
                </span>
              ))}
            </div>
          </div>

          <button onClick={handleLogout} className="btn btn-secondary btn-sm">
            Đăng xuất
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
