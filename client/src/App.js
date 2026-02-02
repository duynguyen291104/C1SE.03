import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import ChooseRole from './pages/ChooseRole';
import StudentDashboard from './pages/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import AdminDashboard from './pages/AdminDashboard';

// Student pages
import StudentQuizzes from './pages/StudentQuizzes';
import StudentMaterials from './pages/StudentMaterials';
import StudentResults from './pages/StudentResults';
import StudentLiveClasses from './pages/StudentLiveClasses';
import VirtualTutor from './pages/VirtualTutor';

// Teacher pages
import CreateSlide from './pages/CreateSlide';
import CreateQuiz from './pages/CreateQuiz';
import CreateLive from './pages/CreateLive';
import TeacherStats from './pages/TeacherStats';
import LiveClassRoom from './pages/LiveClassRoom';
import JoinLiveClass from './pages/JoinLiveClass';
import TestVideoGrid from './pages/TestVideoGrid';

// Dashboard router based on roles
const DashboardRouter = () => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If user has no roles, redirect to choose role
  if (!user.roles || user.roles.length === 0) {
    return <Navigate to="/choose-role" replace />;
  }

  // Redirect based on primary role
  if (user.roles.includes('admin')) {
    return <Navigate to="/admin/dashboard" replace />;
  } else if (user.roles.includes('teacher')) {
    return <Navigate to="/teacher/dashboard" replace />;
  } else {
    return <Navigate to="/student/dashboard" replace />;
  }
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Navbar />
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected routes */}
          <Route
            path="/choose-role"
            element={
              <ProtectedRoute>
                <ChooseRole />
              </ProtectedRoute>
            }
          />

          {/* Student routes */}
          <Route
            path="/student/dashboard"
            element={
              <ProtectedRoute requiredRole="student">
                <StudentDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/quizzes"
            element={
              <ProtectedRoute requiredRole="student">
                <StudentQuizzes />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/materials"
            element={
              <ProtectedRoute requiredRole="student">
                <StudentMaterials />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/results"
            element={
              <ProtectedRoute requiredRole="student">
                <StudentResults />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/tutor"
            element={
              <ProtectedRoute requiredRole="student">
                <VirtualTutor />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/classes"
            element={
              <ProtectedRoute requiredRole="student">
                <StudentLiveClasses />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/live-classroom/:classId"
            element={
              <ProtectedRoute requiredRole="student">
                <LiveClassRoom />
              </ProtectedRoute>
            }
          />

          {/* Teacher routes */}
          <Route
            path="/teacher/dashboard"
            element={
              <ProtectedRoute requiredRole="teacher">
                <TeacherDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/create-slide"
            element={
              <ProtectedRoute requiredRole="teacher">
                <CreateSlide />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/create-quiz"
            element={
              <ProtectedRoute requiredRole="teacher">
                <CreateQuiz />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/stats"
            element={
              <ProtectedRoute requiredRole="teacher">
                <TeacherStats />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/create-live"
            element={
              <ProtectedRoute requiredRole="teacher">
                <CreateLive />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/live-room/:liveClassId"
            element={
              <ProtectedRoute requiredRole="teacher">
                <LiveClassRoom />
              </ProtectedRoute>
            }
          />

          {/* Live Room - accessible by all authenticated users */}
          <Route
            path="/live-room/:liveClassId"
            element={
              <ProtectedRoute>
                <LiveClassRoom />
              </ProtectedRoute>
            }
          />

          {/* Student can join live class */}
          <Route
            path="/join-live/:roomId"
            element={
              <ProtectedRoute>
                <JoinLiveClass />
              </ProtectedRoute>
            }
          />

          {/* Admin routes */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Dashboard router */}
          <Route path="/dashboard" element={<DashboardRouter />} />

          {/* Test page - public for demo */}
          <Route path="/test-video-grid" element={<TestVideoGrid />} />

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* 404 */}
          <Route path="*" element={<div className="container"><h1>404 - Page Not Found</h1></div>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
