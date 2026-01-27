const jwt = require('jsonwebtoken');
const LiveClass = require('../models/LiveClass');
const User = require('../models/User');
const { getPresenceManager } = require('../services/redisPresence');

// Active rooms map (in-memory backup, primary data in Redis)
const activeRooms = new Map();

// Helper function: Join room directly (cho teacher hoặc approved student)
const joinRoomDirectly = async (socket, liveClass, roomId, liveClassId, presenceManager, isHost) => {
  // 1) Join socket.io room first (always succeeds, doesn't depend on Redis)
  socket.join(roomId);
  socket.currentRoom = roomId;
  socket.isApproved = true; // Mark as approved so handlers will work

  // 2) Initialize in-memory room + add participant FIRST (so UI always has members)
  if (!activeRooms.has(roomId)) {
    activeRooms.set(roomId, {
      liveClass,
      teacher: liveClass.teacherId,
      participants: new Map() // Key = userId (NOT socketId to avoid duplicates)
    });
  }

  const room = activeRooms.get(roomId);
  const userKey = socket.user._id.toString();
  
  // ⚠️ CRITICAL: Use userId as key to prevent duplicate entries on reconnect!
  const existing = room.participants.get(userKey);
  room.participants.set(userKey, {
    ...socket.user,
    userId: userKey,
    socketId: socket.id,
    joinedAt: existing?.joinedAt || new Date()
  });

  // 3) Get current members from in-memory (stable, doesn't depend on Redis)
  const members = Array.from(room.participants.values()).map(p => ({
    userId: p.userId,  // ✅ Always use userId (set above as userKey)
    socketId: p.socketId,
    fullName: p.fullName,
    email: p.email,
    role: p.role,
    avatar: p.avatar,
    joinedAt: p.joinedAt
  }));

  console.log(`📊 Room ${roomId} members after adding ${socket.user.fullName}:`, members.length);
  console.log(`   Members:`, members.map(m => `${m.fullName} (${m.userId})`).join(', '));

  // 4) Presence/Redis operations: best-effort (won't block if Redis fails)
  let mediaStates = {};
  try {
    await presenceManager.addUserToRoom(roomId, userKey, {
      userId: userKey,
      socketId: socket.id,
      fullName: socket.user.fullName,
      email: socket.user.email,
      role: socket.user.role,
      avatar: socket.user.avatar,
      joinedAt: new Date().toISOString()
    });

    await presenceManager.setUserSocket(roomId, userKey, socket.id);

    await presenceManager.setUserMediaState(roomId, userKey, {
      microphone: socket.user.role === 'teacher', // Teacher unmuted by default
      camera: false,
      screenShare: false
    });

    mediaStates = await presenceManager.getRoomMediaStates(roomId);
  } catch (redisError) {
    console.warn('⚠️ Redis/Presence operations failed, fallback to in-memory:', redisError.message);
    // Continue anyway - UI will still work with in-memory data
  }

  // 5) Emit state to joining user (this MUST succeed for UI to work)
  socket.emit('room:joined', {
    roomId,
    liveClass: {
      _id: liveClass._id,
      title: liveClass.title,
      description: liveClass.description,
      teacherId: liveClass.teacherId ? {
        _id: liveClass.teacherId._id,
        fullName: liveClass.teacherId.profile?.fullName || liveClass.teacherId.email
      } : null,
      status: liveClass.status,
      settings: liveClass.settings
    },
    user: {
      userId: userKey,
      fullName: socket.user.fullName,
      email: socket.user.email,
      role: socket.user.role,
      avatar: socket.user.avatar
    },
    members: members.map(m => ({
      userId: m.userId,
      fullName: m.fullName,
      role: m.role,
      avatar: m.avatar,
      joinedAt: m.joinedAt
    })),
    isHost,
    isTeacher: socket.user.role === 'teacher',
    mediaStates,
    waitingStudents: isHost ? liveClass.waitingStudents : [] // Chỉ host mới thấy waiting list
  });

  // 6) Broadcast to other participants (critical for UI sync)
  socket.to(roomId).emit('room:user-joined', {
    user: {
      userId: userKey,
      socketId: socket.id,
      fullName: socket.user.fullName,
      role: socket.user.role,
      avatar: socket.user.avatar
    },
    memberCount: members.length // User already included in members array
  });

  // 7) Broadcast full participants list to ensure everyone has the same state
  // This is critical for UI sync after approval
  const io = socket.server;
  const liveNs = io.of('/live');
  liveNs.to(roomId).emit('room:participants-updated', {
    members,
    participantCount: members.length
  });

  console.log(`✅ ${socket.user.fullName} joined room ${roomId} (${members.length} members)`);
};

// Socket authentication middleware - VERIFY JWT joinToken
const authenticateSocket = async (socket, next) => {
  try {
    // Lấy token từ auth hoặc query (để hỗ trợ nhiều client)
    const token = socket.handshake.auth.token || 
                  socket.handshake.query.token ||
                  socket.handshake.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    // Verify JWT joinToken
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Token phải có roomId và user info
    if (!decoded.roomId || !decoded.sub) {
      return next(new Error('Invalid token format'));
    }

    // Kiểm tra user tồn tại
    const user = await User.findById(decoded.sub).select('-password');
    if (!user) {
      return next(new Error('User not found'));
    }

    // Attach user data vào socket
    socket.user = {
      _id: user._id.toString(),
      email: user.email,
      fullName: decoded.name || user.profile?.fullName || user.email,
      role: decoded.role || user.roles[0] || 'student',
      avatar: user.profile?.avatar
    };
    
    socket.roomId = decoded.roomId;
    socket.liveClassId = decoded.liveClassId;

    console.log(`✅ Socket authenticated: ${socket.user.fullName} (${socket.user.role})`);
    next();
  } catch (error) {
    console.error('Socket authentication error:', error.message);
    if (error.name === 'TokenExpiredError') {
      return next(new Error('Token expired. Please rejoin the class.'));
    }
    next(new Error('Authentication failed'));
  }
};

const initializeLiveClassSocket = (io) => {
  const presenceManager = getPresenceManager();
  
  // Use namespace for live classes
  const liveNs = io.of('/live');
  
  // Apply authentication middleware
  liveNs.use(authenticateSocket);

  liveNs.on('connection', async (socket) => {
    console.log(`🎥 User connected: ${socket.user.fullName} (${socket.user.role}) to room ${socket.roomId}`);

    try {
      // Auto-join room khi connect (vì đã có roomId từ token)
      const roomId = socket.roomId;
      const liveClassId = socket.liveClassId;

      // Verify live class exists and is live
      const liveClass = await LiveClass.findById(liveClassId)
        .populate('teacherId', 'profile.fullName email profile.avatar');
      
      if (!liveClass) {
        socket.emit('error', { message: 'Live class not found' });
        return socket.disconnect();
      }

      if (liveClass.status !== 'live' && liveClass.status !== 'scheduled') {
        socket.emit('error', { message: 'This live class is not active' });
        return socket.disconnect();
      }

      // ============ LOGIC DUYỆT HỌC SINH ============
      const isHost = socket.user._id === liveClass.teacherId._id.toString();
      const isTeacher = socket.user.role === 'teacher';
      const isStudent = socket.user.role === 'student';

      console.log(`🔍 Join check: ${socket.user.fullName}`);
      console.log(`   - User ID: ${socket.user._id}`);
      console.log(`   - Host ID: ${liveClass.teacherId._id.toString()}`);
      console.log(`   - Is Host: ${isHost}`);
      console.log(`   - User Role: ${socket.user.role}`);
      console.log(`   - Is Teacher: ${isTeacher}`);
      console.log(`   - Is Student: ${isStudent}`);

      // ✅ Giáo viên (host hoặc giáo viên khác) → vào thẳng
      if (isTeacher) {
        console.log(`👨‍🏫 Teacher ${socket.user.fullName} auto-approved`);
        await joinRoomDirectly(socket, liveClass, roomId, liveClassId, presenceManager, isHost);
        return;
      }

      // 🎓 Học sinh → kiểm tra approval
      if (isStudent) {
        // Check nếu đã là participant (đã join trước đó)
        const isParticipant = liveClass.participants.some(
          p => p.userId.toString() === socket.user._id
        );
        
        // Check nếu đã được approve trước đó
        const isApproved = liveClass.approvedStudents.some(
          id => id.toString() === socket.user._id
        );

        if (isParticipant || isApproved) {
          console.log(`🎓 Student ${socket.user.fullName} already participant (DB check)`);
          console.log(`   isParticipant: ${isParticipant}, isApproved: ${isApproved}`);
          await joinRoomDirectly(socket, liveClass, roomId, liveClassId, presenceManager, isHost);
          return;
        }

        // Check nếu đã trong waiting list
        const isWaiting = liveClass.waitingStudents.some(
          s => s.userId.toString() === socket.user._id
        );

        if (!isWaiting) {
          // Thêm vào waiting list
          liveClass.waitingStudents.push({
            userId: socket.user._id,
            fullName: socket.user.fullName,
            email: socket.user.email,
            requestedAt: new Date()
          });
          liveClass.markModified('waitingStudents'); // ✅ CRITICAL: Mongoose must know to save
          await liveClass.save();
          console.log(`⏳ Student ${socket.user.fullName} added to waiting list`);
        } else {
          console.log(`⏳ Student ${socket.user.fullName} already in waiting list`);
        }

        // Mark socket as NOT approved yet (so handlers will reject actions)
        socket.isApproved = false;
        socket.currentRoom = null; // Don't set room yet
        
        // Gửi thông báo chờ duyệt cho học sinh
        socket.emit('room:waiting-approval', {
          message: 'Đang chờ giáo viên duyệt vào lớp...',
          roomId,
          liveClassId
        });

        // Thông báo cho host có học sinh chờ
        const hostSockets = await liveNs.in(roomId).fetchSockets();
        for (const hostSocket of hostSockets) {
          if (hostSocket.user._id === liveClass.teacherId._id.toString()) {
            hostSocket.emit('room:student-waiting', {
              student: {
                userId: socket.user._id,
                socketId: socket.id,
                fullName: socket.user.fullName,
                email: socket.user.email,
                avatar: socket.user.avatar,
                requestedAt: new Date()
              },
              waitingList: liveClass.waitingStudents
            });
          }
        }

        console.log(`⏳ Student ${socket.user.fullName} waiting for approval from host`);
        // DON'T return - let socket register handlers below
        // They will check socket.isApproved before executing
      }

    } catch (error) {
      console.error('Error on connection:', error);
      socket.emit('error', { message: 'Failed to join room' });
      socket.disconnect();
    }

    // ==================== WebRTC SIGNALING ====================

    // WebRTC Offer (P2P mesh)
    socket.on('webrtc:offer', async ({ toUserId, sdp, type }) => {
      // Check if socket is approved and in a room
      if (!socket.currentRoom || socket.isApproved === false) {
        console.log(`⚠️ Ignoring offer from unapproved user: ${socket.user.fullName}`);
        return;
      }
      try {
        const targetSocketId = await presenceManager.getUserSocket(socket.currentRoom, toUserId);
        if (targetSocketId) {
          liveNs.to(targetSocketId).emit('webrtc:offer', {
            fromUserId: socket.user._id,
            fromUserName: socket.user.fullName,
            sdp,
            type
          });
          console.log(`📞 Offer from ${socket.user._id} to ${toUserId}`);
        }
      } catch (error) {
        console.error('Error forwarding offer:', error);
      }
    });

    // WebRTC Answer
    socket.on('webrtc:answer', async ({ toUserId, sdp }) => {
      if (!socket.currentRoom || socket.isApproved === false) {
        console.log(`⚠️ Ignoring answer from unapproved user: ${socket.user.fullName}`);
        return;
      }
      try {
        const targetSocketId = await presenceManager.getUserSocket(socket.currentRoom, toUserId);
        if (targetSocketId) {
          liveNs.to(targetSocketId).emit('webrtc:answer', {
            fromUserId: socket.user._id,
            fromUserName: socket.user.fullName,
            sdp
          });
          console.log(`✅ Answer from ${socket.user._id} to ${toUserId}`);
        }
      } catch (error) {
        console.error('Error forwarding answer:', error);
      }
    });

    // WebRTC ICE Candidate
    socket.on('webrtc:ice-candidate', async ({ toUserId, candidate }) => {
      if (!socket.currentRoom || socket.isApproved === false) return;
      try {
        const targetSocketId = await presenceManager.getUserSocket(socket.currentRoom, toUserId);
        if (targetSocketId) {
          liveNs.to(targetSocketId).emit('webrtc:ice-candidate', {
            fromUserId: socket.user._id,
            candidate
          });
        }
      } catch (error) {
        console.error('Error forwarding ICE candidate:', error);
      }
    });

    // ==================== MEDIA CONTROLS ====================

    // Toggle microphone
    socket.on('media:toggle-mic', async ({ enabled }) => {
      if (!socket.currentRoom || socket.isApproved === false) return;
      try {
        await presenceManager.setUserMediaState(socket.currentRoom, socket.user._id, {
          ...(await presenceManager.getUserMediaState(socket.currentRoom, socket.user._id)),
          microphone: enabled
        });

        // ✅ Broadcast to ALL users in room using liveNs namespace
        liveNs.to(socket.currentRoom).emit('media:user-mic-toggled', {
          userId: socket.user._id.toString(),
          enabled
        });
        
        console.log(`🎤 ${socket.user.fullName} mic: ${enabled ? 'ON' : 'OFF'}`);
      } catch (error) {
        console.error('Error toggling mic:', error);
      }
    });

    // Toggle camera
    socket.on('media:toggle-camera', async ({ enabled }) => {
      if (!socket.currentRoom || socket.isApproved === false) return;
      try {
        await presenceManager.setUserMediaState(socket.currentRoom, socket.user._id, {
          ...(await presenceManager.getUserMediaState(socket.currentRoom, socket.user._id)),
          camera: enabled
        });

        // ✅ Broadcast to ALL users in room using liveNs namespace
        liveNs.to(socket.currentRoom).emit('media:user-camera-toggled', {
          userId: socket.user._id.toString(),
          enabled
        });
        
        console.log(`📷 ${socket.user.fullName} camera: ${enabled ? 'ON' : 'OFF'}`);
      } catch (error) {
        console.error('Error toggling camera:', error);
      }
    });

    // Start screen share
    socket.on('media:start-screenshare', async () => {
      if (!socket.currentRoom || socket.isApproved === false) return;
      try {
        await presenceManager.setUserMediaState(socket.currentRoom, socket.user._id, {
          ...(await presenceManager.getUserMediaState(socket.currentRoom, socket.user._id)),
          screenShare: true
        });

        socket.to(socket.currentRoom).emit('media:user-screenshare-started', {
          userId: socket.user._id,
          userName: socket.user.fullName
        });
      } catch (error) {
        console.error('Error starting screenshare:', error);
      }
    });

    // Stop screen share
    socket.on('media:stop-screenshare', async () => {
      try {
        await presenceManager.setUserMediaState(socket.currentRoom, socket.user._id, {
          ...(await presenceManager.getUserMediaState(socket.currentRoom, socket.user._id)),
          screenShare: false
        });

        socket.to(socket.currentRoom).emit('media:user-screenshare-stopped', {
          userId: socket.user._id
        });
      } catch (error) {
        console.error('Error stopping screenshare:', error);
      }
    });

    // ==================== CHAT ====================

    socket.on('chat:send', async ({ message }) => {
      if (!socket.currentRoom || socket.isApproved === false) return;
      try {
        if (!socket.currentRoom) {
          console.log('❌ No currentRoom');
          return;
        }

        if (!message || !message.trim()) {
          console.log('❌ Empty message');
          return;
        }

        console.log('📩 Chat received:', message);
        console.log('🧪 liveClassId:', socket.liveClassId);
        console.log('🧪 currentRoom:', socket.currentRoom);

        const liveClass = await LiveClass.findById(socket.liveClassId);
        if (!liveClass) {
          console.log('❌ LiveClass not found');
          return socket.emit('error', { message: 'LiveClass not found' });
        }

        console.log('⚙️ settings:', liveClass.settings);

        // Safe check for allowChat - default to true if not set
        const allowChat = liveClass.settings?.allowChat ?? true;
        if (!allowChat && socket.user.role !== 'teacher') {
          console.log('❌ Chat disabled for students');
          return socket.emit('error', { message: 'Chat is disabled' });
        }

        const chatMessage = {
          userId: socket.user._id,
          message: message.trim(),
          timestamp: new Date()
        };

        // Save to database (MongoDB will auto-generate _id)
        liveClass.chat.push(chatMessage);
        await liveClass.save();

        // Get the saved message with auto-generated _id for broadcasting
        const savedMessage = liveClass.chat[liveClass.chat.length - 1];
        const broadcastMessage = {
          _id: savedMessage._id.toString(),
          userId: socket.user._id,
          userName: socket.user.fullName,
          userRole: socket.user.role,
          userAvatar: socket.user.avatar,
          message: message.trim(),
          timestamp: savedMessage.timestamp
        };

        console.log('✅ Broadcasting chat message to room:', socket.currentRoom);

        // Broadcast to ALL in room (including sender)
        liveNs.to(socket.currentRoom).emit('chat:message', broadcastMessage);
      } catch (err) {
        console.error('❌ Chat error:', err);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // ==================== Q&A ====================

    socket.on('qa:ask', async ({ question }) => {
      if (!socket.currentRoom || socket.isApproved === false) return;
      try {
        if (!socket.currentRoom) return;

        const liveClass = await LiveClass.findById(socket.liveClassId);
        
        if (!liveClass.settings.allowQuestions && socket.user.role !== 'teacher') {
          return socket.emit('error', { message: 'Questions are disabled' });
        }

        const newQuestion = {
          userId: socket.user._id,
          question: question.trim(),
          answer: '',
          isAnswered: false,
          timestamp: new Date()
        };

        liveClass.questions.push(newQuestion);
        await liveClass.save();

        // Get saved question with auto-generated _id
        const savedQuestion = liveClass.questions[liveClass.questions.length - 1];
        const broadcastQuestion = {
          _id: savedQuestion._id.toString(),
          userId: socket.user._id,
          userName: socket.user.fullName,
          userAvatar: socket.user.avatar,
          question: question.trim(),
          answer: '',
          isAnswered: false,
          timestamp: savedQuestion.timestamp
        };

        liveNs.to(socket.currentRoom).emit('qa:new-question', broadcastQuestion);
      } catch (error) {
        console.error('Error asking question:', error);
      }
    });

    // ==================== PIN MESSAGE ====================

    socket.on('chat:pin-message', async ({ messageId }) => {
      if (!socket.currentRoom || socket.isApproved === false) return;
      try {
        if (!socket.currentRoom) return;

        const liveClass = await LiveClass.findById(socket.liveClassId);
        
        // Only teacher can pin messages
        if (socket.user._id.toString() !== liveClass.teacherId.toString()) {
          return socket.emit('error', { message: 'Only teacher can pin messages' });
        }

        // Set pinned message
        liveClass.pinnedMessageId = messageId;
        await liveClass.save();

        liveNs.to(socket.currentRoom).emit('chat:message-pinned', { messageId });
        console.log('📌 Message pinned:', messageId);
      } catch (error) {
        console.error('Error pinning message:', error);
      }
    });

    socket.on('chat:unpin-message', async () => {
      if (!socket.currentRoom || socket.isApproved === false) return;
      try {
        if (!socket.currentRoom) return;

        const liveClass = await LiveClass.findById(socket.liveClassId);
        
        // Only teacher can unpin
        if (socket.user._id.toString() !== liveClass.teacherId.toString()) {
          return socket.emit('error', { message: 'Only teacher can unpin messages' });
        }

        liveClass.pinnedMessageId = null;
        await liveClass.save();

        liveNs.to(socket.currentRoom).emit('chat:message-unpinned');
        console.log('📌 Message unpinned');
      } catch (error) {
        console.error('Error unpinning message:', error);
      }
    });

    // ==================== PIN VIDEO ====================

    socket.on('video:pin', ({ userId }) => {
      try {
        if (!socket.currentRoom) return;
        
        // Broadcast to all users in room (including sender for confirmation)
        liveNs.to(socket.currentRoom).emit('video:pinned', { 
          userId,
          pinnedBy: socket.user._id 
        });
        
        console.log(`📌 Video pinned: ${userId} by ${socket.user.fullName}`);
      } catch (error) {
        console.error('Error pinning video:', error);
      }
    });

    socket.on('video:unpin', () => {
      try {
        if (!socket.currentRoom) return;
        
        // Broadcast to all users in room
        liveNs.to(socket.currentRoom).emit('video:unpinned', {
          unpinnedBy: socket.user._id
        });
        
        console.log(`📌 Video unpinned by ${socket.user.fullName}`);
      } catch (error) {
        console.error('Error unpinning video:', error);
      }
    });

    // ==================== TEACHER CONTROLS ====================

    socket.on('moderation:mute-participant', async ({ targetUserId }) => {
      if (!socket.currentRoom || socket.isApproved === false) return;
      try {
        const liveClass = await LiveClass.findById(socket.liveClassId);
        
        // Only teacher can mute
        if (socket.user._id !== liveClass.teacherId.toString()) {
          return socket.emit('error', { message: 'Only teacher can mute participants' });
        }

        const targetSocketId = await presenceManager.getUserSocket(socket.currentRoom, targetUserId);
        if (targetSocketId) {
          liveNs.to(targetSocketId).emit('moderation:force-mute');
          
          await presenceManager.setUserMediaState(socket.currentRoom, targetUserId, {
            ...(await presenceManager.getUserMediaState(socket.currentRoom, targetUserId)),
            microphone: false
          });
        }
      } catch (error) {
        console.error('Error muting participant:', error);
      }
    });

    socket.on('moderation:kick-participant', async ({ targetUserId }) => {
      if (!socket.currentRoom || socket.isApproved === false) return;
      try {
        const liveClass = await LiveClass.findById(socket.liveClassId);
        
        if (socket.user._id !== liveClass.teacherId.toString()) {
          return socket.emit('error', { message: 'Only teacher can kick participants' });
        }

        const targetSocketId = await presenceManager.getUserSocket(socket.currentRoom, targetUserId);
        if (targetSocketId) {
          liveNs.to(targetSocketId).emit('moderation:kicked', {
            reason: 'Removed by teacher'
          });
          
          const targetSocket = liveNs.sockets.get(targetSocketId);
          if (targetSocket) {
            targetSocket.disconnect(true);
          }
        }
      } catch (error) {
        console.error('Error kicking participant:', error);
      }
    });

    // ==================== RAISE HAND ====================

    socket.on('hand:raise', () => {
      if (!socket.currentRoom || socket.isApproved === false) return;
      if (socket.currentRoom) {
        socket.to(socket.currentRoom).emit('hand:raised', {
          userId: socket.user._id,
          userName: socket.user.fullName
        });
      }
    });

    socket.on('hand:lower', () => {
      if (!socket.currentRoom || socket.isApproved === false) return;
      if (socket.currentRoom) {
        socket.to(socket.currentRoom).emit('hand:lowered', {
          userId: socket.user._id
        });
      }
    });

    // ==================== APPROVAL SYSTEM ====================

    // Host duyệt học sinh vào phòng
    socket.on('room:approve-student', async ({ studentUserId }, callback) => {
      console.log(`🔥 RECEIVED room:approve-student event for student: ${studentUserId}`);
      console.log(`   From socket: ${socket.id}, User: ${socket.user.fullName}`);
      console.log(`   LiveClassId: ${socket.liveClassId}`);
      
      try {
        const liveClass = await LiveClass.findById(socket.liveClassId)
          .populate('teacherId', 'profile.fullName email profile.avatar');
        
        if (!liveClass) {
          console.log('❌ Live class not found');
          const error = { error: 'Live class not found' };
          socket.emit('error', { message: error.error });
          if (callback) callback(error);
          return;
        }

        // Chỉ host mới được duyệt
        const isHost = socket.user._id === liveClass.teacherId._id.toString();
        console.log(`   Is host: ${isHost}, Teacher ID: ${liveClass.teacherId._id}`);
        
        if (!isHost) {
          console.log('❌ User is not host');
          const error = { error: 'Only host can approve students' };
          socket.emit('error', { message: error.error });
          if (callback) callback(error);
          return;
        }

        // Xóa khỏi waiting list
        const waitingStudent = liveClass.waitingStudents.find(
          s => s.userId.toString() === studentUserId.toString()
        );

        if (!waitingStudent) {
          console.log('❌ Student not found in waiting list');
          const error = { error: 'Student not in waiting list' };
          socket.emit('error', { message: error.error });
          if (callback) callback(error);
          return;
        }

        liveClass.waitingStudents = liveClass.waitingStudents.filter(
          s => s.userId.toString() !== studentUserId.toString()
        );
        
        console.log(`   After filter: ${liveClass.waitingStudents.length} students waiting`);

        // Thêm vào approved list
        const studentObjectId = studentUserId.toString();
        if (!liveClass.approvedStudents.some(id => id.toString() === studentObjectId)) {
          liveClass.approvedStudents.push(studentUserId);
          console.log(`   Added to approvedStudents`);
        }

        // Thêm vào participants list nếu chưa có
        if (!liveClass.participants.some(p => p.userId.toString() === studentObjectId)) {
          liveClass.participants.push({
            userId: studentUserId,
            joinedAt: new Date()
          });
          console.log(`   Added to participants`);
        }

        // 🔥 CRITICAL: Mark modified để Mongoose save sub-documents
        liveClass.markModified('waitingStudents');
        liveClass.markModified('approvedStudents');
        liveClass.markModified('participants');
        
        const saveResult = await liveClass.save();
        console.log(`✅ DB saved successfully`);
        console.log(`   Waiting students in DB: ${saveResult.waitingStudents.length}`);
        console.log(`   Participants in DB: ${saveResult.participants.length}`);
        console.log(`   Approved students in DB: ${saveResult.approvedStudents.length}`);

        console.log(`✅ Host approved student ${waitingStudent?.fullName}`);
        console.log(`   Student added to participants and approved list`);

        // Tìm socket của student và cho vào phòng
        const studentSockets = await liveNs.fetchSockets();
        console.log(`   Searching for student socket among ${studentSockets.length} connected sockets`);
        
        let studentFound = false;
        for (const studentSocket of studentSockets) {
          console.log(`   Checking socket: ${studentSocket.user.fullName} (${studentSocket.user._id})`);
          if (studentSocket.user._id.toString() === studentUserId.toString()) {
            console.log(`   ✅ Found student socket!`);
            studentFound = true;
            
            // Join student vào phòng
            await joinRoomDirectly(
              studentSocket, 
              liveClass, 
              socket.currentRoom, 
              socket.liveClassId, 
              presenceManager, 
              false
            );

            // Thông báo cho student
            studentSocket.emit('room:approved', {
              message: 'Bạn đã được duyệt vào lớp học!',
              roomId: socket.currentRoom
            });
            
            console.log(`   ✅ Student ${waitingStudent.fullName} joined room successfully`);
            break;
          }
        }

        if (!studentFound) {
          console.log(`   ⚠️ Student socket not found. Student may have disconnected.`);
        }

        // Update waiting list cho host
        socket.emit('room:waiting-updated', {
          waitingStudents: liveClass.waitingStudents
        });

        // Broadcast to all in room that waiting list changed
        socket.to(socket.currentRoom).emit('room:waiting-updated', {
          waitingStudents: liveClass.waitingStudents
        });

        console.log(`📝 Waiting list updated for host and all participants`);
        
        // ✅ Send ACK to client
        if (callback) callback({ ok: true });

      } catch (error) {
        console.error('Error approving student:', error);
        const errorMsg = { error: 'Failed to approve student' };
        socket.emit('error', { message: errorMsg.error });
        if (callback) callback(errorMsg);
      }
    });

    // Host từ chối học sinh
    socket.on('room:reject-student', async ({ studentUserId }, callback) => {
      console.log(`🔥 RECEIVED room:reject-student event for student: ${studentUserId}`);
      
      try {
        const liveClass = await LiveClass.findById(socket.liveClassId)
          .populate('teacherId', 'profile.fullName email profile.avatar');
        
        if (!liveClass) {
          const error = { error: 'Live class not found' };
          socket.emit('error', { message: error.error });
          if (callback) callback(error);
          return;
        }

        // Chỉ host mới được reject
        const isHost = socket.user._id === liveClass.teacherId._id.toString();
        if (!isHost) {
          const error = { error: 'Only host can reject students' };
          socket.emit('error', { message: error.error });
          if (callback) callback(error);
          return;
        }

        // Xóa khỏi waiting list
        const waitingStudent = liveClass.waitingStudents.find(
          s => s.userId.toString() === studentUserId.toString()
        );

        if (!waitingStudent) {
          console.log('❌ Student not found in waiting list');
          const error = { error: 'Student not in waiting list' };
          socket.emit('error', { message: error.error });
          if (callback) callback(error);
          return;
        }

        liveClass.waitingStudents = liveClass.waitingStudents.filter(
          s => s.userId.toString() !== studentUserId.toString()
        );

        await liveClass.save();

        console.log(`❌ Host rejected student ${waitingStudent?.fullName}`);

        // Thông báo cho student
        const studentSockets = await liveNs.fetchSockets();
        for (const studentSocket of studentSockets) {
          if (studentSocket.user._id.toString() === studentUserId.toString()) {
            studentSocket.emit('room:rejected', {
              message: 'Giáo viên đã từ chối yêu cầu tham gia của bạn'
            });
            studentSocket.disconnect();
            break;
          }
        }

        // Update waiting list cho host
        socket.emit('room:waiting-updated', {
          waitingStudents: liveClass.waitingStudents
        });

        // Broadcast to all in room
        socket.to(socket.currentRoom).emit('room:waiting-updated', {
          waitingStudents: liveClass.waitingStudents
        });

        console.log(`📝 Waiting list updated after rejection`);
        
        // ✅ Send ACK to client
        if (callback) callback({ ok: true });

      } catch (error) {
        console.error('Error rejecting student:', error);
        const errorMsg = { error: 'Failed to reject student' };
        socket.emit('error', { message: errorMsg.error });
        if (callback) callback(errorMsg);
      }
    });

    // ==================== DISCONNECT ====================

    socket.on('disconnect', async () => {
      await handleUserLeave(socket, liveNs, presenceManager);
      console.log(`❌ User disconnected: ${socket.user.fullName}`);
    });

    socket.on('room:leave', async () => {
      await handleUserLeave(socket, liveNs, presenceManager);
    });
  });

  return liveNs;
};

// Helper function to handle user leaving
async function handleUserLeave(socket, liveNs, presenceManager) {
  if (socket.currentRoom) {
    const roomId = socket.currentRoom;
    const room = activeRooms.get(roomId);

    if (room) {
      // ⚠️ CRITICAL: Delete by userId (not socketId) to match join logic
      const userId = socket.user._id.toString();
      room.participants.delete(userId);

      console.log(`👋 ${socket.user.fullName} left room. Remaining: ${room.participants.size}`);

      // Notify others
      socket.to(roomId).emit('room:user-left', {
        userId: socket.user._id,
        userName: socket.user.fullName,
        memberCount: room.participants.size
      });

      // ⚠️ CRITICAL: Clean up empty room - Delete from DB if no one left
      if (room.participants.size === 0) {
        activeRooms.delete(roomId);
        await presenceManager.cleanupRoom(roomId);
        
        // Delete LiveClass from database when last person leaves
        try {
          const LiveClass = require('../models/LiveClass');
          await LiveClass.findByIdAndUpdate(socket.liveClassId, {
            status: 'ended',
            endTime: new Date()
          });
          console.log(`🚪 Room ${roomId} auto-ended - last participant left`);
        } catch (err) {
          console.error('Error auto-ending room:', err);
        }
        
        console.log(`🧹 Room ${roomId} cleaned up - no participants`);
      }
    }

    // Remove from Redis
    await presenceManager.removeUserFromRoom(roomId, socket.user._id);
    await presenceManager.removeSocket(socket.id);

    // Update database if student
    if (socket.user.role === 'student' && socket.liveClassId) {
      try {
        const liveClass = await LiveClass.findById(socket.liveClassId);
        if (liveClass) {
          const participant = liveClass.participants.find(
            p => p.userId.toString() === socket.user._id && !p.leftAt
          );
          if (participant) {
            participant.leftAt = new Date();
            participant.duration = Math.floor((participant.leftAt - participant.joinedAt) / 1000);
            await liveClass.save();
          }
        }
      } catch (error) {
        console.error('Error updating participant leave time:', error);
      }
    }

    socket.leave(roomId);
    socket.currentRoom = null;
    socket.liveClassId = null;
  }
}

module.exports = {
  initializeLiveClassSocket
};
