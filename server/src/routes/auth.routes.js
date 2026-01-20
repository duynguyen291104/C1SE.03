const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth');
const { registerValidation, loginValidation } = require('../middleware/validation');
const { loginLimiter, registerLimiter, refreshLimiter } = require('../middleware/rateLimiter');

// Public routes with validation and rate limiting
router.post('/register', registerLimiter, registerValidation, authController.register);
router.post('/login', loginLimiter, loginValidation, authController.login);
router.post('/refresh', refreshLimiter, authController.refresh);
router.post('/logout', authController.logout);

// Protected routes
router.post('/logout-all', authMiddleware, authController.logoutAll);

module.exports = router;
