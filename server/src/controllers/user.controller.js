const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

/**
 * Get current user profile
 */
exports.getMe = async (req, res) => {
  try {
    res.json({
      user: req.user.toSafeObject()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update user profile
 */
exports.updateProfile = async (req, res) => {
  try {
    const { fullName, avatarUrl, bio } = req.body;

    const user = await User.findById(req.user._id);

    if (fullName !== undefined) user.profile.fullName = fullName;
    if (avatarUrl !== undefined) user.profile.avatarUrl = avatarUrl;
    if (bio !== undefined) user.profile.bio = bio;

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: user.toSafeObject()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Assign role to current user
 * Student: can be self-assigned immediately
 * Teacher: requires admin approval (teacherStatus=pending)
 */
exports.assignRole = async (req, res) => {
  try {
    const { role } = req.body;

    // Validate role
    if (!['student', 'teacher'].includes(role)) {
      return res.status(400).json({ 
        error: 'Invalid role. Allowed roles: student, teacher' 
      });
    }

    const user = await User.findById(req.user._id);

    // Check if user already has this role
    if (user.roles.includes(role)) {
      return res.status(400).json({ error: `You already have ${role} role` });
    }

    // Add role
    user.roles.push(role);

    // If requesting teacher role, set status to pending
    if (role === 'teacher' && user.teacherStatus === 'none') {
      user.teacherStatus = 'pending';
    }

    await user.save();

    // Audit log
    await AuditLog.log({
      userId: req.user._id,
      action: 'ROLE_ASSIGNED',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: { role, teacherStatus: user.teacherStatus }
    });

    res.json({
      message: role === 'teacher' 
        ? 'Teacher role requested. Waiting for admin approval.'
        : 'Role assigned successfully',
      user: user.toSafeObject()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
