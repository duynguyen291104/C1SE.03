#!/bin/bash

# Script to view live classes in the database
# Usage: ./scripts/view-live-classes.sh

echo "==================================================="
echo "📹 LIVE CLASSES IN DATABASE"
echo "==================================================="
echo ""

docker exec -it edu-mongo mongosh -u admin -p admin123 --authenticationDatabase admin edu_ecosystem --eval "
  const classes = db.liveclasses.find({}).sort({ createdAt: -1 }).toArray();
  
  if (classes.length === 0) {
    print('❌ Chưa có lớp học nào trong database');
  } else {
    print('✅ Tổng số lớp học: ' + classes.length);
    print('');
    
    classes.forEach((liveClass, index) => {
      print('─────────────────────────────────────────────────');
      print('📚 Lớp học #' + (index + 1));
      print('─────────────────────────────────────────────────');
      print('ID: ' + liveClass._id);
      print('Tiêu đề: ' + liveClass.title);
      print('Mô tả: ' + (liveClass.description || 'Không có'));
      print('Giáo viên ID: ' + liveClass.teacherId);
      print('Trạng thái: ' + liveClass.status);
      print('Thời gian bắt đầu: ' + liveClass.scheduledStart);
      print('Thời gian kết thúc: ' + liveClass.scheduledEnd);
      print('Số người tối đa: ' + liveClass.maxParticipants);
      print('Đã tham gia: ' + (liveClass.uniqueParticipants || 0) + ' người');
      print('Room ID: ' + liveClass.roomId);
      print('Ngày tạo: ' + liveClass.createdAt);
      print('');
    });
  }
" 2>/dev/null

echo ""
echo "==================================================="
echo "📊 THỐNG KÊ THEO TRẠNG THÁI"
echo "==================================================="

docker exec -it edu-mongo mongosh -u admin -p admin123 --authenticationDatabase admin edu_ecosystem --eval "
  const stats = db.liveclasses.aggregate([
    {
      \$group: {
        _id: '\$status',
        count: { \$sum: 1 }
      }
    },
    {
      \$sort: { _id: 1 }
    }
  ]).toArray();
  
  stats.forEach(stat => {
    const emoji = {
      'scheduled': '📅',
      'live': '🔴',
      'ended': '✅',
      'cancelled': '❌'
    };
    print((emoji[stat._id] || '📌') + ' ' + stat._id + ': ' + stat.count);
  });
" 2>/dev/null

echo ""
echo "==================================================="
