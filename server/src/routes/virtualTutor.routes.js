const express = require('express');
const router = express.Router();
const virtualTutorController = require('../controllers/virtualTutor.controller');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// Virtual tutor routes
router.post('/ask', virtualTutorController.askQuestion);
router.get('/history', virtualTutorController.getChatHistory);
router.get('/documents', virtualTutorController.getAvailableDocuments);

module.exports = router;
