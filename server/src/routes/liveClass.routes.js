const express = require('express');
const router = express.Router();
const liveClassController = require('../controllers/liveClass.controller');
const authMiddleware = require('../middleware/auth');
const { requireApprovedTeacher } = require('../middleware/rbac');

// All routes require authentication and approved teacher status
router.use(authMiddleware);
router.use(requireApprovedTeacher);

// Live class routes
router.post('/', liveClassController.createLiveClass);
router.get('/', liveClassController.getLiveClasses);
router.get('/:id', liveClassController.getLiveClassById);
router.put('/:id', liveClassController.updateLiveClass);
router.delete('/:id', liveClassController.deleteLiveClass);
router.post('/:id/start', liveClassController.startLiveClass);
router.post('/:id/end', liveClassController.endLiveClass);
router.post('/:id/cancel', liveClassController.cancelLiveClass);

module.exports = router;
