const mongoose = require('mongoose');

const documentPageSchema = new mongoose.Schema({
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: true,
    index: true
  },
  pageNumber: {
    type: Number,
    required: true,
    min: 1
  },
  text: {
    type: String,
    required: true
  },
  meta: {
    charCount: {
      type: Number,
      default: 0
    },
    source: {
      type: String,
      enum: ['pdf', 'docx', 'pptx'],
      required: true
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Unique compound index
documentPageSchema.index({ documentId: 1, pageNumber: 1 }, { unique: true });

// Pre-save to calculate charCount
documentPageSchema.pre('save', function(next) {
  if (this.text) {
    this.meta.charCount = this.text.length;
  }
  next();
});

// Static method to get pages for a document
documentPageSchema.statics.getByDocument = function(documentId, options = {}) {
  const { page = 1, limit = 10 } = options;
  
  return this.find({ documentId })
    .sort({ pageNumber: 1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);
};

// Static method to delete all pages for a document
documentPageSchema.statics.deleteByDocument = function(documentId) {
  return this.deleteMany({ documentId });
};

module.exports = mongoose.model('DocumentPage', documentPageSchema);
