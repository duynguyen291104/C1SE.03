const LiveClass = require('../models/LiveClass');
const AuditLog = require('../models/AuditLog');
const crypto = require('crypto');

// Create new live class
exports.createLiveClass = async (req, res) => {
  try {
    const { 
      title, 
      description, 
      courseId,
      scheduledStart,
      scheduledEnd,
      maxParticipants,
      settings,
      materials,
      tags
    } = req.body;

    // Validate dates
    const start = new Date(scheduledStart);
    const end = new Date(scheduledEnd);
    
    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: 'End time must be after start time'
      });
    }

    if (start < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Start time must be in the future'
      });
    }

    // Generate room ID and password
    const roomId = crypto.randomBytes(16).toString('hex');
    const password = crypto.randomBytes(8).toString('hex');

    const liveClass = await LiveClass.create({
      teacherId: req.user._id,
      title,
      description,
      courseId,
      scheduledStart: start,
      scheduledEnd: end,
      maxParticipants: maxParticipants || 100,
      roomId,
      password,
      settings: settings || {},
      materials: materials || [],
      tags: tags || [],
      status: 'scheduled'
    });

    await AuditLog.log({
      userId: req.user._id,
      action: 'CREATE_LIVE_CLASS',
      metadata: { 
        liveClassId: liveClass._id, 
        title,
        scheduledStart 
      }
    });

    res.status(201).json({
      success: true,
      data: liveClass
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get all live classes by teacher
exports.getLiveClasses = async (req, res) => {
  try {
    const { status, courseId, page = 1, limit = 20 } = req.query;
    
    const query = { teacherId: req.user._id };
    if (status) query.status = status;
    if (courseId) query.courseId = courseId;

    const liveClasses = await LiveClass.find(query)
      .sort({ scheduledStart: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('courseId', 'title')
      .populate('participants.userId', 'profile.fullName email');

    const total = await LiveClass.countDocuments(query);

    res.json({
      success: true,
      data: liveClasses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get single live class by ID
exports.getLiveClassById = async (req, res) => {
  try {
    const liveClass = await LiveClass.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    })
    .populate('courseId', 'title')
    .populate('participants.userId', 'profile.fullName email')
    .populate('materials.slideId', 'title');

    if (!liveClass) {
      return res.status(404).json({
        success: false,
        message: 'Live class not found'
      });
    }

    res.json({
      success: true,
      data: liveClass
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update live class
exports.updateLiveClass = async (req, res) => {
  try {
    const liveClass = await LiveClass.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!liveClass) {
      return res.status(404).json({
        success: false,
        message: 'Live class not found'
      });
    }

    // Cannot update if class is live
    if (liveClass.status === 'live') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update class while live'
      });
    }

    const updateFields = [
      'title', 'description', 'scheduledStart', 'scheduledEnd',
      'maxParticipants', 'settings', 'materials', 'tags'
    ];

    updateFields.forEach(field => {
      if (req.body[field] !== undefined) {
        liveClass[field] = req.body[field];
      }
    });

    await liveClass.save();

    await AuditLog.log({
      userId: req.user._id,
      action: 'UPDATE_LIVE_CLASS',
      metadata: { 
        liveClassId: liveClass._id, 
        title: liveClass.title 
      }
    });

    res.json({
      success: true,
      data: liveClass
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Start live class
exports.startLiveClass = async (req, res) => {
  try {
    const liveClass = await LiveClass.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!liveClass) {
      return res.status(404).json({
        success: false,
        message: 'Live class not found'
      });
    }

    if (liveClass.status !== 'scheduled') {
      return res.status(400).json({
        success: false,
        message: 'Class cannot be started'
      });
    }

    liveClass.status = 'live';
    liveClass.actualStart = new Date();
    await liveClass.save();

    await AuditLog.log({
      userId: req.user._id,
      action: 'START_LIVE_CLASS',
      metadata: { 
        liveClassId: liveClass._id, 
        title: liveClass.title 
      }
    });

    res.json({
      success: true,
      data: liveClass
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// End live class
exports.endLiveClass = async (req, res) => {
  try {
    const liveClass = await LiveClass.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!liveClass) {
      return res.status(404).json({
        success: false,
        message: 'Live class not found'
      });
    }

    if (liveClass.status !== 'live') {
      return res.status(400).json({
        success: false,
        message: 'Class is not live'
      });
    }

    liveClass.status = 'ended';
    liveClass.actualEnd = new Date();
    await liveClass.save();

    await AuditLog.log({
      userId: req.user._id,
      action: 'END_LIVE_CLASS',
      metadata: { 
        liveClassId: liveClass._id, 
        title: liveClass.title 
      }
    });

    res.json({
      success: true,
      data: liveClass
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Cancel live class
exports.cancelLiveClass = async (req, res) => {
  try {
    const liveClass = await LiveClass.findOne({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!liveClass) {
      return res.status(404).json({
        success: false,
        message: 'Live class not found'
      });
    }

    if (liveClass.status === 'ended') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel ended class'
      });
    }

    liveClass.status = 'cancelled';
    await liveClass.save();

    await AuditLog.log({
      userId: req.user._id,
      action: 'CANCEL_LIVE_CLASS',
      metadata: { 
        liveClassId: liveClass._id, 
        title: liveClass.title 
      }
    });

    res.json({
      success: true,
      data: liveClass
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete live class
exports.deleteLiveClass = async (req, res) => {
  try {
    const liveClass = await LiveClass.findOneAndDelete({
      _id: req.params.id,
      teacherId: req.user._id
    });

    if (!liveClass) {
      return res.status(404).json({
        success: false,
        message: 'Live class not found'
      });
    }

    await AuditLog.log({
      userId: req.user._id,
      action: 'DELETE_LIVE_CLASS',
      metadata: { 
        liveClassId: liveClass._id, 
        title: liveClass.title 
      }
    });

    res.json({
      success: true,
      message: 'Live class deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
