const express = require('express');
const router = express.Router();
const teacherStatsController = require('../controllers/teacher.stats.controller');
const authMiddleware = require('../middleware/auth');
const { requireApprovedTeacher } = require('../middleware/rbac');

// All routes require authentication and approved teacher status
router.use(authMiddleware);
router.use(requireApprovedTeacher);

// Teacher statistics routes
router.get('/dashboard', teacherStatsController.getDashboardStats);
router.get('/quiz/:quizId', teacherStatsController.getQuizDetailedStats);

module.exports = router;
