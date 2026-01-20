const mongoose = require('mongoose');

const slideSchema = new mongoose.Schema({
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
  slides: [{
    order: {
      type: Number,
      required: true
    },
    type: {
      type: String,
      enum: ['title', 'content', 'image', 'video', 'code', 'quiz'],
      default: 'content'
    },
    title: {
      type: String,
      trim: true,
      maxlength: 200
    },
    content: {
      type: String,
      maxlength: 5000
    },
    imageUrl: String,
    videoUrl: String,
    code: {
      language: String,
      snippet: String
    },
    quizId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quiz'
    },
    backgroundColor: {
      type: String,
      default: '#ffffff'
    },
    textColor: {
      type: String,
      default: '#000000'
    },
    layout: {
      type: String,
      enum: ['single', 'two-column', 'three-column', 'grid'],
      default: 'single'
    }
  }],
  thumbnail: String,
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  views: {
    type: Number,
    default: 0
  },
  tags: [String],
  isPublic: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes
slideSchema.index({ teacherId: 1, status: 1 });
slideSchema.index({ courseId: 1, status: 1 });
slideSchema.index({ tags: 1 });
slideSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Slide', slideSchema);
