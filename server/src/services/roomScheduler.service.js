const LiveClass = require('../models/LiveClass');

/**
 * Room Scheduler Service
 * Tự động kết thúc phòng live khi hết thời gian
 */
class RoomScheduler {
  constructor() {
    // Map lưu các timer đang chạy: roomId -> { warningTimeoutId, endTimeoutId, ... }
    this.scheduledRooms = new Map();
    this.io = null;
  }

  /**
   * Set Socket.IO instance
   */
  setIO(io) {
    this.io = io;
  }

  /**
   * Tính toán thời gian delay (milliseconds) từ bây giờ đến endTime
   */
  calculateDelay(endTime) {
    const now = Date.now();
    const end = new Date(endTime).getTime();
    return end - now;
  }

  /**
   * Schedule tự động kết thúc phòng
   */
  scheduleRoomEnd(liveClass) {
    const roomId = liveClass.roomId;
    const liveClassId = liveClass._id.toString();
    
    // Nếu đã có schedule cho room này thì hủy cái cũ
    if (this.scheduledRooms.has(roomId)) {
      this.cancelSchedule(roomId);
    }

    const now = Date.now();
    const endTime = new Date(liveClass.scheduledEnd).getTime();
    const delay = endTime - now;

    // Nếu đã quá giờ kết thúc, kết thúc ngay
    if (delay <= 0) {
      console.log(`⏰ Room ${roomId} đã quá giờ kết thúc, kết thúc ngay lập tức`);
      this.endRoom(roomId, liveClassId);
      return;
    }

    // ⚠️ Schedule cảnh báo 30 giây trước khi kết thúc
    const warningDelay = delay - 30000; // 30 giây = 30000ms
    let warningTimeoutId = null;

    if (warningDelay > 0) {
      warningTimeoutId = setTimeout(() => {
        console.log(`⚠️ Gửi cảnh báo cho room ${roomId}: Còn 30 giây`);
        this.sendWarning(roomId);
      }, warningDelay);
      
      console.log(`⚠️ Đã schedule cảnh báo cho room ${roomId} sau ${Math.round(warningDelay / 1000)} giây`);
    }

    // ⛔ Schedule tự động kết thúc phòng
    const endTimeoutId = setTimeout(() => {
      console.log(`⏰ Đến giờ kết thúc room ${roomId}`);
      this.endRoom(roomId, liveClassId);
    }, delay);

    this.scheduledRooms.set(roomId, {
      warningTimeoutId,
      endTimeoutId,
      liveClassId,
      scheduledEnd: liveClass.scheduledEnd
    });

    console.log(`✅ Đã schedule kết thúc phòng ${roomId} vào lúc ${new Date(liveClass.scheduledEnd).toLocaleString('vi-VN')}`);
    console.log(`   → Thời gian còn lại: ${Math.round(delay / 1000 / 60)} phút ${Math.round((delay / 1000) % 60)} giây`);
  }

  /**
   * Hủy schedule của một room
   */
  cancelSchedule(roomId) {
    const schedule = this.scheduledRooms.get(roomId);
    if (schedule) {
      if (schedule.warningTimeoutId) {
        clearTimeout(schedule.warningTimeoutId);
      }
      if (schedule.endTimeoutId) {
        clearTimeout(schedule.endTimeoutId);
      }
      this.scheduledRooms.delete(roomId);
      console.log(`❌ Đã hủy schedule kết thúc phòng ${roomId}`);
    }
  }

  /**
   * Gửi cảnh báo 30 giây trước khi kết thúc
   */
  sendWarning(roomId) {
    if (!this.io) {
      console.error('Socket.IO chưa được khởi tạo');
      return;
    }

    const liveNs = this.io.of('/live');
    
    // Emit event 'room:warning' cho tất cả user trong room
    liveNs.to(roomId).emit('room:warning', {
      message: 'Còn 30 giây nữa là phòng học sẽ đóng',
      roomId,
      secondsRemaining: 30
    });

    console.log(`⚠️ Đã gửi cảnh báo 30s cho room ${roomId}`);
  }

  /**
   * Kết thúc phòng live
   */
  async endRoom(roomId, liveClassId) {
    try {
      console.log(`🚪 Bắt đầu kết thúc phòng ${roomId}`);

      // 1. Gửi thông báo cho tất cả user trong room qua Socket.IO
      if (this.io) {
        const liveNs = this.io.of('/live');
        
        // Emit event 'room-ended' cho tất cả user trong room
        liveNs.to(roomId).emit('room:ended', {
          message: 'Phòng học đã kết thúc',
          roomId,
          endedAt: new Date().toISOString()
        });

        console.log(`📢 Đã gửi thông báo "room:ended" cho tất cả user trong room ${roomId}`);

        // 2. Kick tất cả socket ra khỏi room
        const sockets = await liveNs.in(roomId).fetchSockets();
        console.log(`👥 Số lượng socket cần kick: ${sockets.length}`);
        
        for (const socket of sockets) {
          socket.leave(roomId);
          // Có thể disconnect socket nếu muốn
          // socket.disconnect(true);
        }
      }

      // 3. XÓA HOÀN TOÀN phòng khỏi database (theo yêu cầu mới)
      const liveClass = await LiveClass.findById(liveClassId);
      if (liveClass) {
        await LiveClass.deleteOne({ _id: liveClassId });
        console.log(`🗑️ Đã XÓA hoàn toàn LiveClass ${liveClassId} khỏi database`);
      }

      // 4. Xóa schedule khỏi map
      this.scheduledRooms.delete(roomId);

      console.log(`✅ Đã kết thúc và XÓA phòng ${roomId} thành công`);

    } catch (error) {
      console.error(`❌ Lỗi khi kết thúc phòng ${roomId}:`, error);
    }
  }

  /**
   * Restore tất cả schedules khi server restart
   * Gọi hàm này khi server khởi động
   */
  async restoreSchedules() {
    try {
      console.log('🔄 Đang restore room schedules...');

      // Tìm tất cả live class đang active (scheduled hoặc live)
      const activeLiveClasses = await LiveClass.find({
        status: { $in: ['scheduled', 'live'] },
        scheduledEnd: { $exists: true }
      });

      console.log(`📋 Tìm thấy ${activeLiveClasses.length} phòng active cần restore schedule`);

      for (const liveClass of activeLiveClasses) {
        if (liveClass.roomId) {
          this.scheduleRoomEnd(liveClass);
        }
      }

      console.log('✅ Đã restore xong tất cả schedules');
    } catch (error) {
      console.error('❌ Lỗi khi restore schedules:', error);
    }
  }

  /**
   * Lấy thông tin các room đang được schedule
   */
  getScheduledRooms() {
    const rooms = [];
    for (const [roomId, schedule] of this.scheduledRooms.entries()) {
      rooms.push({
        roomId,
        liveClassId: schedule.liveClassId,
        scheduledEnd: schedule.scheduledEnd,
        timeRemaining: this.calculateDelay(schedule.scheduledEnd)
      });
    }
    return rooms;
  }
}

// Export singleton instance
const roomScheduler = new RoomScheduler();
module.exports = roomScheduler;
