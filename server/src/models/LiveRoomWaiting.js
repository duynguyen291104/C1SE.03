const mongoose = require('mongoose');

/**
 * 📋 Bảng CHỜ DUYỆT
 * Lưu học sinh đã request vào phòng nhưng CHƯA được giáo viên duyệt
 */
const liveRoomWaitingSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    index: true
  },
  liveClassId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LiveClass',
    required: true,
    index: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  fullName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  avatar: String,
  status: {
    type: String,
    enum: ['waiting', 'rejected'],
    default: 'waiting',
    index: true
  },
  requestedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  rejectedAt: Date,
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectReason: String
}, {
  timestamps: true
});

// Compound index cho query nhanh
liveRoomWaitingSchema.index({ roomId: 1, studentId: 1 });
liveRoomWaitingSchema.index({ liveClassId: 1, status: 1 });

// TTL index - tự động xóa record sau 24h nếu vẫn waiting
liveRoomWaitingSchema.index({ requestedAt: 1 }, { expireAfterSeconds: 86400 });

// Static method: Lấy danh sách chờ duyệt của 1 phòng
liveRoomWaitingSchema.statics.getWaitingList = function(roomId) {
  return this.find({ roomId, status: 'waiting' })
    .populate('studentId', 'profile.fullName email profile.avatar')
    .sort({ requestedAt: 1 });
};

// Static method: Kiểm tra học sinh có đang chờ không
liveRoomWaitingSchema.statics.isWaiting = async function(roomId, studentId) {
  const count = await this.countDocuments({
    roomId,
    studentId,
    status: 'waiting'
  });
  return count > 0;
};

// Instance method: Reject student
liveRoomWaitingSchema.methods.reject = function(teacherId, reason) {
  this.status = 'rejected';
  this.rejectedAt = new Date();
  this.rejectedBy = teacherId;
  this.rejectReason = reason;
  return this.save();
};

module.exports = mongoose.model('LiveRoomWaiting', liveRoomWaitingSchema);
