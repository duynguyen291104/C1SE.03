const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');
const { initializeLiveClassSocket } = require('./socket/liveClassSocketV2');
const roomScheduler = require('./services/roomScheduler.service');

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Initialize live class socket handlers
initializeLiveClassSocket(io);

// Make io available to routes
app.set('io', io);

// Set Socket.IO instance cho roomScheduler
roomScheduler.setIO(io);

// Connect to MongoDB
connectDB();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply rate limiter to all API routes
app.use('/api', apiLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/documents', require('./routes/document.routes'));
app.use('/api/slides', require('./routes/slide.routes'));
app.use('/api/quizzes', require('./routes/quiz.routes'));
app.use('/api/student/quizzes', require('./routes/student.quiz.routes'));
app.use('/api/student/live-classes', require('./routes/student.liveClass.routes'));
app.use('/api/live-classes', require('./routes/liveClass.routes'));
app.use('/api/live-classes', require('./routes/liveClassApproval.routes')); // Approval API
app.use('/api/teacher/stats', require('./routes/teacher.stats.routes'));
app.use('/api/tutor', require('./routes/virtualTutor.routes'));

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔌 Socket.IO enabled on /live namespace`);
  
  // Restore room schedules khi server khởi động
  console.log('⏰ Restoring room schedules...');
  await roomScheduler.restoreSchedules();
});

module.exports = { app, server, io };
