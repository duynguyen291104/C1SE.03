const mongoose = require('mongoose');

const quizResultSchema = new mongoose.Schema({
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true,
    index: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  answers: [{
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    selectedAnswer: mongoose.Schema.Types.Mixed, // Can be String, Number, Array, etc
    isCorrect: Boolean,
    pointsEarned: {
      type: Number,
      default: 0
    }
  }],
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  totalPoints: {
    type: Number,
    required: true
  },
  earnedPoints: {
    type: Number,
    required: true
  },
  passed: {
    type: Boolean,
    required: true
  },
  attemptNumber: {
    type: Number,
    default: 1
  },
  isFirstAttempt: {
    type: Boolean,
    default: true
  },
  timeSpent: {
    type: Number, // in seconds
    default: 0
  },
  startedAt: {
    type: Date,
    required: true
  },
  submittedAt: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

// Compound index for finding student's quiz attempts
quizResultSchema.index({ quizId: 1, studentId: 1 });

// Index for finding first attempts (for grading)
quizResultSchema.index({ quizId: 1, studentId: 1, isFirstAttempt: 1 });

module.exports = mongoose.model('QuizResult', quizResultSchema);
