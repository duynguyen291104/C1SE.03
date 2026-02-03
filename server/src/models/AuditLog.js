const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'LOGIN_SUCCESS',
      'LOGIN_FAILED',
      'LOGOUT',
      'REGISTER',
      'TEACHER_APPROVED',
      'TEACHER_REJECTED',
      'BANNED_WORD_ADDED',
      'BANNED_WORD_UPDATED',
      'BANNED_WORD_DELETED',
      'USER_DEACTIVATED',
      'PROFILE_UPDATED',
      'ROLE_ASSIGNED',
      'CREATE_LIVE_CLASS',
      'START_LIVE_CLASS',
      'END_LIVE_CLASS',
      'DELETE_LIVE_CLASS',
      'JOIN_LIVE_CLASS',
      'LEAVE_LIVE_CLASS',
      'APPROVE_STUDENT',
      'REJECT_STUDENT'
    ]
  },
  targetUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  details: {
    type: mongoose.Schema.Types.Mixed
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  status: {
    type: String,
    enum: ['success', 'failure'],
    default: 'success'
  }
}, {
  timestamps: true
});

// Indexes
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

// Static method to log action
auditLogSchema.statics.log = async function(data) {
  try {
    await this.create(data);
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
};

module.exports = mongoose.model('AuditLog', auditLogSchema);
