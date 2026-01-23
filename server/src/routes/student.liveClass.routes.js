const express = require('express');
const router = express.Router();
const studentLiveClassController = require('../controllers/student.liveClass.controller');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// Student live class routes
router.get('/available', studentLiveClassController.getAvailableLiveClasses); // Get all live classes that are currently live
router.get('/:id', studentLiveClassController.getLiveClassDetails); // Get details of a specific live class
router.post('/:id/join', studentLiveClassController.joinLiveClass); // Join a live class
router.post('/:id/leave', studentLiveClassController.leaveLiveClass); // Leave a live class
router.get('/:id/check-access', studentLiveClassController.checkAccess); // Check if student can access the live class

module.exports = router;
