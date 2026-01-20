const mongoose = require('mongoose');

const bannedWordSchema = new mongoose.Schema({
  word: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  enabled: {
    type: Boolean,
    default: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  category: {
    type: String,
    enum: ['profanity', 'hate-speech', 'spam', 'other'],
    default: 'other'
  }
}, {
  timestamps: true
});

// Index for faster queries
bannedWordSchema.index({ word: 1 });
bannedWordSchema.index({ enabled: 1 });

// Static method to check if text contains banned words
bannedWordSchema.statics.containsBannedWords = async function(text) {
  const bannedWords = await this.find({ enabled: true }).select('word');
  const lowerText = text.toLowerCase();
  
  for (const item of bannedWords) {
    if (lowerText.includes(item.word)) {
      return { contains: true, word: item.word };
    }
  }
  
  return { contains: false, word: null };
};

module.exports = mongoose.model('BannedWord', bannedWordSchema);
