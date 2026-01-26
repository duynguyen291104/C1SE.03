const mongoose = require('mongoose');

const liveClassSchema = new mongoose.Schema({
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
  scheduledStart: {
    type: Date,
    required: true,
    index: true
  },
  scheduledEnd: {
    type: Date,
    required: true
  },
  actualStart: Date,
  actualEnd: Date,
  status: {
    type: String,
    enum: ['scheduled', 'live', 'ended', 'cancelled'],
    default: 'scheduled',
    index: true
  },
  meetingLink: String,
  roomId: String,
  password: String,
  maxParticipants: {
    type: Number,
    default: 100
  },
  participants: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    joinedAt: Date,
    leftAt: Date,
    duration: Number // seconds
  }],
  // Danh sách học sinh đang chờ duyệt
  waitingStudents: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    fullName: String,
    email: String,
    requestedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Danh sách học sinh đã được duyệt
  approvedStudents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  settings: {
    allowChat: {
      type: Boolean,
      default: true
    },
    allowQuestions: {
      type: Boolean,
      default: true
    },
    allowScreenShare: {
      type: Boolean,
      default: false
    },
    recordSession: {
      type: Boolean,
      default: false
    },
    waitingRoom: {
      type: Boolean,
      default: false
    },
    muteOnEntry: {
      type: Boolean,
      default: true
    }
  },
  recording: {
    url: String,
    duration: Number,
    size: Number,
    status: {
      type: String,
      enum: ['processing', 'ready', 'failed'],
      default: 'processing'
    }
  },
  materials: [{
    type: {
      type: String,
      enum: ['slide', 'document', 'link']
    },
    title: String,
    url: String,
    slideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Slide'
    }
  }],
  chat: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    message: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  questions: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    question: String,
    answer: String,
    answeredAt: Date,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  pinnedMessageId: {
    type: String,
    default: null
  },
  tags: [String]
}, {
  timestamps: true
});

// Virtual for duration
liveClassSchema.virtual('duration').get(function() {
  if (this.actualEnd && this.actualStart) {
    return Math.floor((this.actualEnd - this.actualStart) / 1000); // seconds
  }
  return Math.floor((this.scheduledEnd - this.scheduledStart) / 1000);
});

// Indexes
liveClassSchema.index({ teacherId: 1, status: 1 });
liveClassSchema.index({ courseId: 1, scheduledStart: -1 });
liveClassSchema.index({ scheduledStart: 1, status: 1 });
liveClassSchema.index({ tags: 1 });

module.exports = mongoose.model('LiveClass', liveClassSchema);
