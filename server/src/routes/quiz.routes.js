const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quiz.controller');
const authMiddleware = require('../middleware/auth');
const { requireApprovedTeacher } = require('../middleware/rbac');

// All routes require authentication and approved teacher status
router.use(authMiddleware);
router.use(requireApprovedTeacher);

// Quiz routes
router.post('/', quizController.createQuiz);
router.get('/', quizController.getQuizzes);
router.get('/:id', quizController.getQuizById);
router.put('/:id', quizController.updateQuiz);
router.delete('/:id', quizController.deleteQuiz);
router.post('/:id/publish', quizController.publishQuiz);
router.post('/:id/duplicate', quizController.duplicateQuiz);

module.exports = router;
