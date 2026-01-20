const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  originalName: {
    type: String,
    required: true
  },
  mimeType: {
    type: String,
    required: true,
    enum: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']
  },
  sizeBytes: {
    type: Number,
    required: true
  },
  storage: {
    bucket: {
      type: String,
      required: true,
      default: 'edu-docs'
    },
    objectKey: {
      type: String,
      required: true
    }
  },
  status: {
    type: String,
    enum: ['uploaded', 'extracting', 'ready', 'failed'],
    default: 'uploaded',
    index: true
  },
  extract: {
    pageCount: {
      type: Number,
      default: 0
    },
    textPreview: {
      type: String,
      default: ''
    },
    error: {
      type: String
    },
    startedAt: {
      type: Date
    },
    finishedAt: {
      type: Date
    }
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
documentSchema.index({ ownerId: 1, createdAt: -1 });
documentSchema.index({ status: 1, createdAt: -1 });

// Method to get safe object (without sensitive data)
documentSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  return obj;
};

// Static method to get documents by owner
documentSchema.statics.getByOwner = function(ownerId, options = {}) {
  const { page = 1, limit = 20, status } = options;
  const filter = { ownerId };
  if (status) filter.status = status;
  
  return this.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);
};

module.exports = mongoose.model('Document', documentSchema);
