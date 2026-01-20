const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const authMiddleware = require('../middleware/auth');
const { profileUpdateValidation, roleAssignmentValidation } = require('../middleware/validation');

// All user routes require authentication
router.use(authMiddleware);

// User profile
router.get('/me', userController.getMe);
router.patch('/me/profile', profileUpdateValidation, userController.updateProfile);

// Role assignment
router.patch('/me/role', roleAssignmentValidation, userController.assignRole);

module.exports = router;
