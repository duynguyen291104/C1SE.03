const User = require('../models/User');
const BannedWord = require('../models/BannedWord');
const AuditLog = require('../models/AuditLog');

/**
 * Get all pending teacher requests
 */
exports.getPendingTeachers = async (req, res) => {
  try {
    const pendingTeachers = await User.find({
      teacherStatus: 'pending'
    }).select('-passwordHash');

    res.json({
      count: pendingTeachers.length,
      teachers: pendingTeachers
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Approve teacher
 */
exports.approveTeacher = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.hasRole('teacher')) {
      return res.status(400).json({ error: 'User is not a teacher' });
    }

    if (user.teacherStatus === 'approved') {
      return res.status(400).json({ error: 'Teacher already approved' });
    }

    user.teacherStatus = 'approved';
    await user.save();

    // Audit log
    await AuditLog.log({
      userId: req.user._id,
      action: 'TEACHER_APPROVED',
      targetUserId: user._id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: { teacherEmail: user.email }
    });

    res.json({
      message: 'Teacher approved successfully',
      user: user.toSafeObject()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Reject teacher
 */
exports.rejectTeacher = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.teacherStatus = 'rejected';
    await user.save();

    // Audit log
    await AuditLog.log({
      userId: req.user._id,
      action: 'TEACHER_REJECTED',
      targetUserId: user._id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: { teacherEmail: user.email, reason }
    });

    res.json({
      message: 'Teacher rejected',
      user: user.toSafeObject()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get all users
 */
exports.getAllUsers = async (req, res) => {
  try {
    const { role, status, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (role) filter.roles = role;
    if (status) filter.teacherStatus = status;

    const users = await User.find(filter)
      .select('-passwordHash')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const count = await User.countDocuments(filter);

    res.json({
      users,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Deactivate user
 */
exports.deactivateUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.hasRole('admin')) {
      return res.status(403).json({ error: 'Cannot deactivate admin user' });
    }

    user.isActive = false;
    await user.save();

    res.json({
      message: 'User deactivated successfully',
      user: user.toSafeObject()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== Banned Words Management ====================

/**
 * Get all banned words
 */
exports.getBannedWords = async (req, res) => {
  try {
    const { enabled } = req.query;
    
    const filter = {};
    if (enabled !== undefined) filter.enabled = enabled === 'true';

    const words = await BannedWord.find(filter)
      .populate('createdBy', 'email profile.fullName')
      .sort({ createdAt: -1 });

    res.json({
      count: words.length,
      words
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Add banned word
 */
exports.addBannedWord = async (req, res) => {
  try {
    const { word, severity, category } = req.body;

    if (!word) {
      return res.status(400).json({ error: 'Word is required' });
    }

    const bannedWord = await BannedWord.create({
      word: word.toLowerCase().trim(),
      createdBy: req.user._id,
      severity: severity || 'medium',
      category: category || 'other',
      enabled: true
    });

    // Audit log
    await AuditLog.log({
      userId: req.user._id,
      action: 'BANNED_WORD_ADDED',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: { word: bannedWord.word }
    });

    res.status(201).json({
      message: 'Banned word added successfully',
      word: bannedWord
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Word already exists in banned list' });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update banned word
 */
exports.updateBannedWord = async (req, res) => {
  try {
    const { wordId } = req.params;
    const { enabled, severity, category } = req.body;

    const word = await BannedWord.findById(wordId);

    if (!word) {
      return res.status(404).json({ error: 'Banned word not found' });
    }

    if (enabled !== undefined) word.enabled = enabled;
    if (severity !== undefined) word.severity = severity;
    if (category !== undefined) word.category = category;

    await word.save();

    res.json({
      message: 'Banned word updated successfully',
      word
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Delete banned word
 */
exports.deleteBannedWord = async (req, res) => {
  try {
    const { wordId } = req.params;

    const word = await BannedWord.findByIdAndDelete(wordId);

    if (!word) {
      return res.status(404).json({ error: 'Banned word not found' });
    }

    res.json({
      message: 'Banned word deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
