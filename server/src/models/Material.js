const mongoose = require('mongoose');

const materialSchema = new mongoose.Schema({
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
  type: {
    type: String,
    enum: ['document', 'video', 'audio', 'image', 'link', 'slide', 'quiz', 'assignment'],
    required: true,
    index: true
  },
  // For uploaded files
  file: {
    originalName: String,
    fileName: String,
    mimeType: String,
    size: Number, // bytes
    url: String
  },
  // For links
  externalUrl: String,
  
  // Reference to other resources
  slideId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Slide'
  },
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz'
  },
  
  // For videos
  video: {
    duration: Number, // seconds
    thumbnail: String,
    processingStatus: {
      type: String,
      enum: ['uploading', 'processing', 'ready', 'failed'],
      default: 'ready'
    }
  },
  
  category: {
    type: String,
    enum: ['lecture', 'reading', 'exercise', 'reference', 'supplementary', 'other'],
    default: 'lecture'
  },
  
  access: {
    type: String,
    enum: ['public', 'course-only', 'private'],
    default: 'course-only'
  },
  
  downloadable: {
    type: Boolean,
    default: true
  },
  
  order: {
    type: Number,
    default: 0
  },
  
  // Analytics
  views: {
    type: Number,
    default: 0
  },
  downloads: {
    type: Number,
    default: 0
  },
  
  // Availability
  publishedAt: Date,
  availableFrom: Date,
  availableUntil: Date,
  
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft',
    index: true
  },
  
  tags: [String],
  
  // For tracking who accessed
  accessLog: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    action: {
      type: String,
      enum: ['view', 'download']
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Indexes
materialSchema.index({ teacherId: 1, type: 1, status: 1 });
materialSchema.index({ courseId: 1, order: 1 });
materialSchema.index({ type: 1, status: 1 });
materialSchema.index({ tags: 1 });
materialSchema.index({ createdAt: -1 });

// Virtual for file size in MB
materialSchema.virtual('fileSizeMB').get(function() {
  if (this.file && this.file.size) {
    return (this.file.size / (1024 * 1024)).toFixed(2);
  }
  return 0;
});

module.exports = mongoose.model('Material', materialSchema);
