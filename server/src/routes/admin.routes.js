const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// All admin routes require authentication and admin role
router.use(authMiddleware);
router.use(requireRole(['admin']));

// Teacher approval
router.get('/teachers/pending', adminController.getPendingTeachers);
router.patch('/teachers/:userId/approve', adminController.approveTeacher);
router.patch('/teachers/:userId/reject', adminController.rejectTeacher);

// User management
router.get('/users', adminController.getAllUsers);
router.patch('/users/:userId/deactivate', adminController.deactivateUser);

// Banned words management
const { bannedWordValidation } = require('../middleware/validation');
router.get('/banned-words', adminController.getBannedWords);
router.post('/banned-words', bannedWordValidation, adminController.addBannedWord);
router.patch('/banned-words/:wordId', adminController.updateBannedWord);
router.delete('/banned-words/:wordId', adminController.deleteBannedWord);

module.exports = router;
