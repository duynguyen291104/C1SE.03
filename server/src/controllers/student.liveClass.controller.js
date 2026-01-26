const LiveClass = require('../models/LiveClass');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const jwt = require('jsonwebtoken');
const { getPresenceManager } = require('../services/redisPresence');

// Get all available (live/scheduled) live classes for students
exports.getAvailableLiveClasses = async (req, res) => {
  try {
    const { status = 'live', page = 1, limit = 20 } = req.query;
    
    // Build query - show live and upcoming scheduled classes
    const query = {};
    
    if (status === 'live') {
      query.status = 'live';
    } else if (status === 'upcoming') {
      query.status = 'scheduled';
      query.scheduledStart = { $gte: new Date() };
    } else if (status === 'all') {
      query.$or = [
        { status: 'live' },
        { 
          status: 'scheduled',
          scheduledStart: { $gte: new Date() }
        }
      ];
    }

    const liveClasses = await LiveClass.find(query)
      .sort({ scheduledStart: 1 }) // Soonest first
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('teacherId', 'profile.fullName email profile.avatar')
      .populate('courseId', 'title description')
      .select('-password -participants.leftAt -participants.duration'); // Don't send password

    const total = await LiveClass.countDocuments(query);

    // Add participant count and check if current user joined
    const presenceManager = getPresenceManager();
    const enrichedClasses = await Promise.all(liveClasses.map(async (liveClass) => {
      const classObj = liveClass.toObject();
      
      // Get current online participants from Redis (for live classes)
      if (liveClass.status === 'live' && liveClass.roomId) {
        const onlineMembers = await presenceManager.getRoomMembers(liveClass.roomId);
        classObj.currentParticipants = onlineMembers.length; // Số người đang online hiện tại
      } else {
        classObj.currentParticipants = 0;
      }
      
      // Total visits count (số lượt truy cập)
      classObj.totalVisits = liveClass.participants.length;
      
      // For backward compatibility
      classObj.participantCount = classObj.currentParticipants;
      
      classObj.hasJoined = liveClass.participants.some(
        p => p.userId.toString() === req.user._id.toString() && !p.leftAt
      );
      
      // Remove detailed participant info for privacy
      delete classObj.participants;
      
      return classObj;
    }));

    res.json({
      success: true,
      data: enrichedClasses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching available live classes:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get details of a specific live class
exports.getLiveClassDetails = async (req, res) => {
  try {
    const liveClass = await LiveClass.findById(req.params.id)
      .populate('teacherId', 'profile.fullName email profile.avatar profile.bio')
      .populate('courseId', 'title description')
      .populate('materials.slideId', 'title')
      .select('-password'); // Don't send password to students before joining

    if (!liveClass) {
      return res.status(404).json({
        success: false,
        message: 'Live class not found'
      });
    }

    const classObj = liveClass.toObject();
    
    // Get current online participants from Redis (for live classes)
    const presenceManager = getPresenceManager();
    if (liveClass.status === 'live' && liveClass.roomId) {
      const onlineMembers = await presenceManager.getRoomMembers(liveClass.roomId);
      classObj.currentParticipants = onlineMembers.length; // Số người đang online hiện tại
    } else {
      classObj.currentParticipants = 0;
    }
    
    // Total visits count
    classObj.totalVisits = liveClass.participants.length;
    classObj.participantCount = classObj.currentParticipants; // For backward compatibility
    
    classObj.hasJoined = liveClass.participants.some(
      p => p.userId.toString() === req.user._id.toString() && !p.leftAt
    );
    
    // If student has joined, include room access details
    if (classObj.hasJoined && liveClass.status === 'live') {
      classObj.roomId = liveClass.roomId;
      classObj.roomPassword = liveClass.password;
    } else {
      delete classObj.roomId;
      delete classObj.roomPassword;
    }

    // Don't expose detailed participant info
    classObj.participants = undefined;

    res.json({
      success: true,
      data: classObj
    });
  } catch (error) {
    console.error('Error fetching live class details:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Join a live class - CHUẨN GOOGLE MEET với joinToken
exports.joinLiveClass = async (req, res) => {
  try {
    const presenceManager = getPresenceManager();
    const liveClass = await LiveClass.findById(req.params.id).populate('teacherId', 'profile.fullName email');

    if (!liveClass) {
      return res.status(404).json({
        success: false,
        message: 'Live class not found'
      });
    }

    // Rate limiting - chống brute force
    const clientIp = req.ip || req.connection.remoteAddress;
    const rateLimit = await presenceManager.checkJoinRateLimit(clientIp, liveClass.roomId, 10, 60);
    
    if (rateLimit.limited) {
      return res.status(429).json({
        success: false,
        message: 'Too many join attempts. Please try again later.',
        retryAfter: 60
      });
    }

    // Check if class is live
    if (liveClass.status !== 'live') {
      return res.status(400).json({
        success: false,
        message: 'This class is not currently live'
      });
    }

    // Check if already joined and still in the class
    const existingParticipant = liveClass.participants.find(
      p => p.userId.toString() === req.user._id.toString() && !p.leftAt
    );

    // Check max participants (check Redis realtime count)
    const currentOnlineCount = await presenceManager.getRoomMemberCount(liveClass.roomId);
    if (liveClass.maxParticipants && currentOnlineCount >= liveClass.maxParticipants && !existingParticipant) {
      return res.status(400).json({
        success: false,
        message: 'This class has reached maximum capacity',
        currentCount: currentOnlineCount,
        maxParticipants: liveClass.maxParticipants
      });
    }

    // Add student to participants DB if not exists
    if (!existingParticipant) {
      liveClass.participants.push({
        userId: req.user._id,
        joinedAt: new Date()
      });
      await liveClass.save();
    }

    // Generate short-lived JWT joinToken (5-15 minutes)
    const joinToken = jwt.sign(
      {
        sub: req.user._id.toString(),
        roomId: liveClass.roomId,
        liveClassId: liveClass._id.toString(),
        role: req.user.roles[0] || 'student', // Use actual user role, not hardcoded 'student'
        name: req.user.profile?.fullName || req.user.email,
        email: req.user.email
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' } // Token hết hạn sau 15 phút
    );

    // Log the action
    await AuditLog.log({
      userId: req.user._id,
      action: 'JOIN_LIVE_CLASS',
      metadata: { 
        liveClassId: liveClass._id,
        title: liveClass.title,
        ip: clientIp
      }
    });

    res.json({
      success: true,
      message: existingParticipant ? 'Rejoining the live class' : 'Successfully joined the live class',
      data: {
        joinToken, // JWT token để kết nối WebSocket
        roomId: liveClass.roomId,
        liveClass: {
          _id: liveClass._id,
          title: liveClass.title,
          description: liveClass.description,
          status: liveClass.status,
          settings: liveClass.settings,
          teacher: {
            _id: liveClass.teacherId._id,
            name: liveClass.teacherId.profile?.fullName || liveClass.teacherId.email
          }
        },
        // STUN/TURN servers config cho WebRTC
        iceServers: [
          { urls: ['stun:stun.l.google.com:19302'] },
          { urls: ['stun:stun1.l.google.com:19302'] },
          // TODO: Thêm TURN server của bạn ở đây cho production
          // {
          //   urls: ['turn:turn.yourdomain.com:3478'],
          //   username: 'turnuser',
          //   credential: 'turnpass'
          // }
        ]
      }
    });
  } catch (error) {
    console.error('Error joining live class:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Leave a live class
exports.leaveLiveClass = async (req, res) => {
  try {
    const liveClass = await LiveClass.findById(req.params.id);

    if (!liveClass) {
      return res.status(404).json({
        success: false,
        message: 'Live class not found'
      });
    }

    // Find participant
    const participant = liveClass.participants.find(
      p => p.userId.toString() === req.user._id.toString() && !p.leftAt
    );

    if (!participant) {
      return res.status(400).json({
        success: false,
        message: 'You are not in this class'
      });
    }

    // Update participant leave time and calculate duration
    participant.leftAt = new Date();
    participant.duration = Math.floor((participant.leftAt - participant.joinedAt) / 1000); // in seconds

    await liveClass.save();

    // Log the action
    await AuditLog.log({
      userId: req.user._id,
      action: 'LEAVE_LIVE_CLASS',
      metadata: { 
        liveClassId: liveClass._id,
        title: liveClass.title,
        duration: participant.duration
      }
    });

    res.json({
      success: true,
      message: 'Successfully left the live class',
      data: {
        duration: participant.duration
      }
    });
  } catch (error) {
    console.error('Error leaving live class:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Check if student has access to a live class
exports.checkAccess = async (req, res) => {
  try {
    const liveClass = await LiveClass.findById(req.params.id)
      .select('status participants maxParticipants');

    if (!liveClass) {
      return res.status(404).json({
        success: false,
        message: 'Live class not found'
      });
    }

    const hasJoined = liveClass.participants.some(
      p => p.userId.toString() === req.user._id.toString() && !p.leftAt
    );

    const activeParticipants = liveClass.participants.filter(p => !p.leftAt).length;
    const isFull = liveClass.maxParticipants && activeParticipants >= liveClass.maxParticipants;

    res.json({
      success: true,
      data: {
        canAccess: liveClass.status === 'live' && (hasJoined || !isFull),
        hasJoined,
        isLive: liveClass.status === 'live',
        isFull,
        participantCount: activeParticipants,
        maxParticipants: liveClass.maxParticipants
      }
    });
  } catch (error) {
    console.error('Error checking access:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
