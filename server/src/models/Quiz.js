const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema({
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  quizType: {
    type: String,
    enum: ['practice', 'exam'],
    default: 'practice',
    required: true
  },
  instructions: {
    type: String,
    maxlength: 2000
  },
  duration: {
    type: Number, // minutes
    default: 30
  },
  passingScore: {
    type: Number,
    default: 60,
    min: 0,
    max: 100
  },
  questions: [{
    order: {
      type: Number,
      required: true
    },
    type: {
      type: String,
      enum: ['multiple-choice', 'true-false', 'short-answer', 'essay', 'matching', 'fill-blank'],
      required: true
    },
    question: {
      type: String,
      required: true,
      maxlength: 1000
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium'
    },
    imageUrl: String,
    points: {
      type: Number,
      default: 1,
      min: 0
    },
    // For multiple choice
    options: [{
      text: String,
      isCorrect: Boolean
    }],
    // For true/false
    correctAnswer: Boolean,
    // For short answer/essay
    sampleAnswer: String,
    // For matching
    pairs: [{
      left: String,
      right: String
    }],
    // For fill in blank
    blanks: [{
      text: String,
      acceptedAnswers: [String]
    }],
    explanation: String,
    tags: [String]
  }],
  settings: {
    shuffleQuestions: {
      type: Boolean,
      default: false
    },
    shuffleOptions: {
      type: Boolean,
      default: false
    },
    showCorrectAnswers: {
      type: Boolean,
      default: true
    },
    allowReview: {
      type: Boolean,
      default: true
    },
    maxAttempts: {
      type: Number,
      default: 1
    },
    showResultsImmediately: {
      type: Boolean,
      default: true
    }
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  dueDate: Date,
  availableFrom: Date,
  availableUntil: Date,
  tags: [String]
}, {
  timestamps: true
});

// Virtual for total points
quizSchema.virtual('totalPoints').get(function() {
  return this.questions.reduce((sum, q) => sum + (q.points || 0), 0);
});

// Indexes
quizSchema.index({ teacherId: 1, status: 1 });
quizSchema.index({ courseId: 1, status: 1 });
quizSchema.index({ tags: 1 });
quizSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Quiz', quizSchema);
