const jwt = require('jsonwebtoken');
const LiveClass = require('../models/LiveClass');
const User = require('../models/User');

// Active rooms map: roomId -> { liveClass, teacher, participants: Map<socketId, user> }
const activeRooms = new Map();

// Socket authentication middleware
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return next(new Error('Authentication error'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return next(new Error('User not found'));
    }

    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
};

const initializeLiveClassSocket = (io) => {
  // Use namespace for live classes
  const liveNs = io.of('/live');
  
  // Apply authentication middleware
  liveNs.use(authenticateSocket);

  liveNs.on('connection', (socket) => {
    console.log(`User connected to live namespace: ${socket.user.fullName} (${socket.user.role})`);

    // Join a live class room
    socket.on('join-room', async ({ roomId, liveClassId }) => {
      try {
        const liveClass = await LiveClass.findById(liveClassId).populate('teacherId', 'fullName email');
        
        if (!liveClass) {
          return socket.emit('error', { message: 'Live class not found' });
        }

        // Verify room ID matches
        if (liveClass.roomId !== roomId) {
          return socket.emit('error', { message: 'Invalid room ID' });
        }

        // Check if class is active
        if (liveClass.status !== 'active' && liveClass.status !== 'scheduled') {
          return socket.emit('error', { message: 'This live class is not active' });
        }

        // Check max participants for students
        if (socket.user.role === 'student') {
          const currentParticipants = liveClass.participants.length;
          if (liveClass.maxParticipants && currentParticipants >= liveClass.maxParticipants) {
            return socket.emit('error', { message: 'Room is full' });
          }
        }

        // Join the socket room
        socket.join(roomId);
        socket.currentRoom = roomId;
        socket.liveClassId = liveClassId;

        // Initialize room if not exists
        if (!activeRooms.has(roomId)) {
          activeRooms.set(roomId, {
            liveClass,
            teacher: liveClass.teacherId,
            participants: new Map()
          });
        }

        const room = activeRooms.get(roomId);
        
        // Add participant to room
        room.participants.set(socket.id, {
          socketId: socket.id,
          userId: socket.user._id.toString(),
          fullName: socket.user.fullName,
          email: socket.user.email,
          role: socket.user.role,
          joinedAt: new Date()
        });

        // Add to database participants if student
        if (socket.user.role === 'student' && !liveClass.participants.find(p => p.userId.toString() === socket.user._id.toString())) {
          liveClass.participants.push({
            userId: socket.user._id,
            joinedAt: new Date(),
            status: 'joined'
          });
          await liveClass.save();
        }

        // Notify user they joined successfully
        socket.emit('joined-room', {
          roomId,
          liveClass: {
            _id: liveClass._id,
            title: liveClass.title,
            description: liveClass.description,
            teacherId: liveClass.teacherId,
            status: liveClass.status,
            settings: liveClass.settings
          },
          participants: Array.from(room.participants.values()),
          isTeacher: socket.user._id.toString() === liveClass.teacherId._id.toString()
        });

        // Notify all participants about new user
        socket.to(roomId).emit('user-joined', {
          user: {
            socketId: socket.id,
            userId: socket.user._id.toString(),
            fullName: socket.user.fullName,
            role: socket.user.role
          },
          participantCount: room.participants.size
        });

        console.log(`${socket.user.fullName} joined room ${roomId}`);
      } catch (error) {
        console.error('Error joining room:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // Send chat message
    socket.on('send-message', async ({ roomId, message }) => {
      try {
        if (socket.currentRoom !== roomId) {
          return socket.emit('error', { message: 'You are not in this room' });
        }

        const liveClass = await LiveClass.findById(socket.liveClassId);
        
        if (!liveClass.settings.allowChat && socket.user.role !== 'teacher') {
          return socket.emit('error', { message: 'Chat is disabled' });
        }

        const chatMessage = {
          _id: Date.now().toString(),
          userId: socket.user._id,
          userName: socket.user.fullName,
          userRole: socket.user.role,
          message: message.trim(),
          timestamp: new Date()
        };

        // Save to database
        liveClass.chat.push(chatMessage);
        await liveClass.save();

        // Broadcast to all in room
        liveNs.to(roomId).emit('new-message', chatMessage);
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Ask question
    socket.on('ask-question', async ({ roomId, question }) => {
      try {
        if (socket.currentRoom !== roomId) {
          return socket.emit('error', { message: 'You are not in this room' });
        }

        const liveClass = await LiveClass.findById(socket.liveClassId);
        
        if (!liveClass.settings.allowQuestions && socket.user.role !== 'teacher') {
          return socket.emit('error', { message: 'Questions are disabled' });
        }

        const newQuestion = {
          _id: Date.now().toString(),
          userId: socket.user._id,
          userName: socket.user.fullName,
          question: question.trim(),
          answer: '',
          isAnswered: false,
          timestamp: new Date()
        };

        // Save to database
        liveClass.questions.push(newQuestion);
        await liveClass.save();

        // Notify all participants
        liveNs.to(roomId).emit('new-question', newQuestion);
      } catch (error) {
        console.error('Error asking question:', error);
        socket.emit('error', { message: 'Failed to ask question' });
      }
    });

    // Answer question (teacher only)
    socket.on('answer-question', async ({ roomId, questionId, answer }) => {
      try {
        if (socket.currentRoom !== roomId) {
          return socket.emit('error', { message: 'You are not in this room' });
        }

        const liveClass = await LiveClass.findById(socket.liveClassId);
        
        // Only teacher can answer
        if (socket.user._id.toString() !== liveClass.teacherId.toString()) {
          return socket.emit('error', { message: 'Only teacher can answer questions' });
        }

        const question = liveClass.questions.id(questionId);
        if (question) {
          question.answer = answer.trim();
          question.isAnswered = true;
          question.answeredAt = new Date();
          await liveClass.save();

          // Notify all participants
          liveNs.to(roomId).emit('question-answered', {
            questionId,
            answer: answer.trim(),
            answeredAt: new Date()
          });
        }
      } catch (error) {
        console.error('Error answering question:', error);
        socket.emit('error', { message: 'Failed to answer question' });
      }
    });

    // Raise hand (student)
    socket.on('raise-hand', ({ roomId }) => {
      if (socket.currentRoom === roomId) {
        socket.to(roomId).emit('hand-raised', {
          userId: socket.user._id,
          userName: socket.user.fullName
        });
      }
    });

    // Mute/unmute participant (teacher only)
    socket.on('mute-participant', async ({ roomId, socketId }) => {
      try {
        if (socket.currentRoom !== roomId) {
          return socket.emit('error', { message: 'You are not in this room' });
        }

        const liveClass = await LiveClass.findById(socket.liveClassId);
        
        // Only teacher can mute
        if (socket.user._id.toString() !== liveClass.teacherId.toString()) {
          return socket.emit('error', { message: 'Only teacher can mute participants' });
        }

        // Send mute command to specific participant
        liveNs.to(socketId).emit('force-mute');
      } catch (error) {
        socket.emit('error', { message: 'Failed to mute participant' });
      }
    });

    // Leave room
    socket.on('leave-room', async () => {
      await handleUserLeave(socket, liveNs);
    });

    // Disconnect
    socket.on('disconnect', async () => {
      await handleUserLeave(socket, liveNs);
      console.log(`User disconnected: ${socket.user.fullName}`);
    });
  });

  return liveNs;
};

// Helper function to handle user leaving
async function handleUserLeave(socket, liveNs) {
  if (socket.currentRoom) {
    const roomId = socket.currentRoom;
    const room = activeRooms.get(roomId);

    if (room) {
      // Remove participant
      const participant = room.participants.get(socket.id);
      room.participants.delete(socket.id);

      // Notify others
      socket.to(roomId).emit('user-left', {
        userId: socket.user._id.toString(),
        userName: socket.user.fullName,
        participantCount: room.participants.size
      });

      // Clean up empty room
      if (room.participants.size === 0) {
        activeRooms.delete(roomId);
        console.log(`Room ${roomId} cleaned up - no participants`);
      }

      // Update database if student
      if (socket.user.role === 'student' && socket.liveClassId) {
        try {
          const liveClass = await LiveClass.findById(socket.liveClassId);
          if (liveClass) {
            const participant = liveClass.participants.find(p => p.userId.toString() === socket.user._id.toString());
            if (participant) {
              participant.leftAt = new Date();
              participant.status = 'left';
              await liveClass.save();
            }
          }
        } catch (error) {
          console.error('Error updating participant leave time:', error);
        }
      }
    }

    socket.leave(roomId);
    socket.currentRoom = null;
    socket.liveClassId = null;
  }
}

// Get active rooms info
function getActiveRooms() {
  const rooms = [];
  activeRooms.forEach((room, roomId) => {
    rooms.push({
      roomId,
      liveClassId: room.liveClass._id,
      title: room.liveClass.title,
      teacher: room.teacher.fullName,
      participantCount: room.participants.size,
      participants: Array.from(room.participants.values())
    });
  });
  return rooms;
}

module.exports = {
  initializeLiveClassSocket,
  getActiveRooms
};
