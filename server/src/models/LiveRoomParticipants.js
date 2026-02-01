const mongoose = require('mongoose');

/**
 * 👥 Bảng ĐÃ THAM GIA
 * Chỉ lưu học sinh ĐÃ ĐƯỢC DUYỆT và đã/đang tham gia phòng
 */
const liveRoomParticipantsSchema = new mongoose.Schema({
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
  // Thông tin duyệt
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  // Thông tin tham gia
  joinedAt: {
    type: Date,
    default: Date.now
  },
  leftAt: Date,
  duration: {
    type: Number, // seconds
    default: 0
  },
  // Trạng thái
  isOnline: {
    type: Boolean,
    default: true,
    index: true
  },
  // Tracking hoạt động
  lastActivityAt: {
    type: Date,
    default: Date.now
  },
  // Thống kê
  stats: {
    messagesSent: {
      type: Number,
      default: 0
    },
    questionsAsked: {
      type: Number,
      default: 0
    },
    handsRaised: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Compound indexes
liveRoomParticipantsSchema.index({ roomId: 1, studentId: 1 }, { unique: true });
liveRoomParticipantsSchema.index({ liveClassId: 1, isOnline: 1 });
liveRoomParticipantsSchema.index({ studentId: 1, approvedAt: -1 });

// Static method: Lấy danh sách participants đang online
liveRoomParticipantsSchema.statics.getOnlineParticipants = function(roomId) {
  return this.find({ roomId, isOnline: true })
    .populate('studentId', 'profile.fullName email profile.avatar')
    .sort({ joinedAt: 1 });
};

// Static method: Kiểm tra đã approved chưa
liveRoomParticipantsSchema.statics.isApproved = async function(roomId, studentId) {
  const count = await this.countDocuments({ roomId, studentId });
  return count > 0;
};

// Static method: Đếm số người online
liveRoomParticipantsSchema.statics.countOnline = function(roomId) {
  return this.countDocuments({ roomId, isOnline: true });
};

// Instance method: Student left room
liveRoomParticipantsSchema.methods.leave = function() {
  this.isOnline = false;
  this.leftAt = new Date();
  if (this.joinedAt) {
    this.duration = Math.floor((this.leftAt - this.joinedAt) / 1000);
  }
  return this.save();
};

// Instance method: Student rejoin room
liveRoomParticipantsSchema.methods.rejoin = function() {
  this.isOnline = true;
  this.joinedAt = new Date();
  this.leftAt = null;
  this.lastActivityAt = new Date();
  return this.save();
};

// Instance method: Update activity
liveRoomParticipantsSchema.methods.updateActivity = function() {
  this.lastActivityAt = new Date();
  return this.save();
};

module.exports = mongoose.model('LiveRoomParticipants', liveRoomParticipantsSchema);
