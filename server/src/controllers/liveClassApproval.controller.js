const LiveRoomWaiting = require('../models/LiveRoomWaiting');
const LiveRoomParticipants = require('../models/LiveRoomParticipants');
const LiveClass = require('../models/LiveClass');

/**
 * @route   GET /api/live-classes/:liveClassId/waiting
 * @desc    Lấy danh sách học sinh đang chờ duyệt
 * @access  Teacher only
 */
exports.getWaitingStudents = async (req, res) => {
  try {
    const { liveClassId } = req.params;

    // Verify teacher owns this class
    const liveClass = await LiveClass.findById(liveClassId);
    if (!liveClass) {
      return res.status(404).json({ message: 'Live class not found' });
    }

    if (liveClass.teacherId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const waitingList = await LiveRoomWaiting.find({
      liveClassId,
      status: 'waiting'
    })
      .populate('studentId', 'profile.fullName email profile.avatar')
      .sort({ requestedAt: 1 });

    res.json({
      count: waitingList.length,
      students: waitingList.map(w => ({
        _id: w._id,
        userId: w.studentId._id,
        fullName: w.fullName,
        email: w.email,
        avatar: w.avatar,
        requestedAt: w.requestedAt
      }))
    });
  } catch (error) {
    console.error('Error getting waiting students:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @route   GET /api/live-classes/:liveClassId/participants
 * @desc    Lấy danh sách học sinh đã tham gia (approved)
 * @access  Teacher only
 */
exports.getParticipants = async (req, res) => {
  try {
    const { liveClassId } = req.params;

    // Verify teacher owns this class
    const liveClass = await LiveClass.findById(liveClassId);
    if (!liveClass) {
      return res.status(404).json({ message: 'Live class not found' });
    }

    if (liveClass.teacherId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const participants = await LiveRoomParticipants.find({
      liveClassId
    })
      .populate('studentId', 'profile.fullName email profile.avatar')
      .populate('approvedBy', 'profile.fullName')
      .sort({ approvedAt: -1 });

    res.json({
      total: participants.length,
      online: participants.filter(p => p.isOnline).length,
      participants: participants.map(p => ({
        _id: p._id,
        userId: p.studentId._id,
        fullName: p.fullName,
        email: p.email,
        avatar: p.avatar,
        isOnline: p.isOnline,
        approvedBy: p.approvedBy?.profile?.fullName,
        approvedAt: p.approvedAt,
        joinedAt: p.joinedAt,
        leftAt: p.leftAt,
        duration: p.duration,
        stats: p.stats
      }))
    });
  } catch (error) {
    console.error('Error getting participants:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @route   GET /api/live-classes/:liveClassId/approval-stats
 * @desc    Thống kê tổng quan về approval
 * @access  Teacher only
 */
exports.getApprovalStats = async (req, res) => {
  try {
    const { liveClassId } = req.params;

    // Verify teacher owns this class
    const liveClass = await LiveClass.findById(liveClassId);
    if (!liveClass) {
      return res.status(404).json({ message: 'Live class not found' });
    }

    if (liveClass.teacherId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const roomId = liveClass.roomId;

    // Parallel queries
    const [waitingCount, approvedCount, onlineCount, rejectedCount] = await Promise.all([
      LiveRoomWaiting.countDocuments({ roomId, status: 'waiting' }),
      LiveRoomParticipants.countDocuments({ roomId }),
      LiveRoomParticipants.countDocuments({ roomId, isOnline: true }),
      LiveRoomWaiting.countDocuments({ roomId, status: 'rejected' })
    ]);

    res.json({
      waiting: waitingCount,
      approved: approvedCount,
      online: onlineCount,
      rejected: rejectedCount,
      total: waitingCount + approvedCount
    });
  } catch (error) {
    console.error('Error getting approval stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @route   DELETE /api/live-classes/:liveClassId/waiting/:waitingId
 * @desc    Xóa học sinh khỏi waiting list (manual cleanup)
 * @access  Teacher only
 */
exports.removeFromWaiting = async (req, res) => {
  try {
    const { liveClassId, waitingId } = req.params;

    const liveClass = await LiveClass.findById(liveClassId);
    if (!liveClass) {
      return res.status(404).json({ message: 'Live class not found' });
    }

    if (liveClass.teacherId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const deleted = await LiveRoomWaiting.findByIdAndDelete(waitingId);
    if (!deleted) {
      return res.status(404).json({ message: 'Waiting record not found' });
    }

    res.json({ message: 'Student removed from waiting list' });
  } catch (error) {
    console.error('Error removing from waiting:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = exports;
