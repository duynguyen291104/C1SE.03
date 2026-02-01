const express = require('express');
const router = express.Router();
const protect = require('../middleware/auth');
const approvalController = require('../controllers/liveClassApproval.controller');

/**
 * @route   /api/live-classes/:liveClassId/waiting
 * @route   /api/live-classes/:liveClassId/participants
 * @route   /api/live-classes/:liveClassId/approval-stats
 */

// Tất cả routes đều yêu cầu authentication (teacher sẽ check trong controller)
router.use(protect);

// GET danh sách chờ duyệt
router.get('/:liveClassId/waiting', approvalController.getWaitingStudents);

// GET danh sách đã tham gia
router.get('/:liveClassId/participants', approvalController.getParticipants);

// GET thống kê approval
router.get('/:liveClassId/approval-stats', approvalController.getApprovalStats);

// DELETE xóa khỏi waiting list
router.delete('/:liveClassId/waiting/:waitingId', approvalController.removeFromWaiting);

module.exports = router;
