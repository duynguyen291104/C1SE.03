const express = require('express');
const router = express.Router();
const studentQuizController = require('../controllers/student.quiz.controller');
const authMiddleware = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

// Student quiz routes
router.get('/published', studentQuizController.getPublishedQuizzes);
router.get('/:id/take', studentQuizController.getQuizForTaking);
router.post('/:id/submit', studentQuizController.submitQuiz);
router.get('/results', studentQuizController.getMyResults);
router.get('/results/:resultId', studentQuizController.getQuizResult);
router.get('/:id/attempts', studentQuizController.getQuizAttempts);

module.exports = router;
