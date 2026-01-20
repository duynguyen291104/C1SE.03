const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Email không hợp lệ']
  },
  passwordHash: {
    type: String,
    required: true
  },
  roles: {
    type: [String],
    enum: ['student', 'teacher', 'admin'],
    default: []
  },
  teacherStatus: {
    type: String,
    enum: ['none', 'pending', 'approved', 'rejected'],
    default: 'none'
  },
  profile: {
    fullName: {
      type: String,
      default: ''
    },
    avatarUrl: {
      type: String,
      default: ''
    },
    bio: {
      type: String,
      default: ''
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for faster queries
userSchema.index({ email: 1 });
userSchema.index({ roles: 1 });
userSchema.index({ teacherStatus: 1 });

// Method to check if user has specific role
userSchema.methods.hasRole = function(role) {
  return this.roles.includes(role);
};

// Method to check if user is approved teacher
userSchema.methods.isApprovedTeacher = function() {
  return this.hasRole('teacher') && this.teacherStatus === 'approved';
};

// Virtual for removing sensitive data
userSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
