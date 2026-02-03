# Hướng dẫn Test Tính Năng Phòng Chờ (Waiting Room)

## Tính năng đã fix và bổ sung:

### 1. **WebSocket Connection** ✅
- Fix URL từ `localhost:5001` → `localhost:5000`
- Socket.IO giờ kết nối đúng với server

### 2. **AuditLog Validation** ✅
- Thêm các action enum mới:
  - `CREATE_LIVE_CLASS`
  - `START_LIVE_CLASS`
  - `END_LIVE_CLASS`
  - `JOIN_LIVE_CLASS`
  - `LEAVE_LIVE_CLASS`
  - `APPROVE_STUDENT`
  - `REJECT_STUDENT`

### 3. **Waiting Room UI** ✅
- Component `WaitingRoomPanel` mới với UI đẹp
- Hiển thị thông tin học sinh: Avatar, Tên, Email, Thời gian request
- Buttons Duyệt/Từ chối với loading state
- Responsive design

## Cách Test:

### Bước 1: Restart Services

```bash
# Terminal 1: Server
cd server
npm start

# Terminal 2: Client
cd client
npm start
```

### Bước 2: Tạo Live Class (Teacher)

1. Đăng nhập với tài khoản Teacher:
   - Email: `teacher@edu.com`
   - Password: `Teacher@123`

2. Vào "Live Classes" → "Create Live Class"

3. Điền thông tin và **BẬT** "Waiting Room" trong Settings

4. Click "Create" và "Start Class"

### Bước 3: Join với Student (Incognito/Tab mới)

1. Mở Incognito window hoặc browser khác

2. Đăng nhập với Student:
   - Email: `student@edu.com`
   - Password: (xem trong database hoặc tạo mới)

3. Vào "Live Classes" → Click "Join" class đang live

4. Student sẽ thấy màn hình **"Đang chờ giáo viên duyệt..."**

### Bước 4: Teacher Approve/Reject

1. Quay lại tab Teacher

2. Ở toolbar phía dưới, click icon **"⏳ Waiting"** (có badge số học sinh chờ)

3. Panel sẽ mở bên phải hiển thị danh sách học sinh chờ

4. Click **"✓ Duyệt"** để cho phép vào

   - Student sẽ tự động join room
   - Video/Audio của student sẽ hiện trong VideoGrid
   - Participants list được update

5. Hoặc click **"✕ Từ chối"**
   - Student bị đá ra và navigate về trang Student Live Classes
   - Thông báo "Yêu cầu tham gia bị từ chối"

## Kiểm tra WebSocket Events:

Mở Console (F12) và xem logs:

### Teacher sẽ thấy:
```javascript
✅ Socket authenticated: Teacher Name (teacher)
🎯 Socket joined room: {roomId}
📋 Waiting students updated: [...]
🔴 LIVE: {student name} waiting for approval
```

### Student sẽ thấy:
```javascript
✅ Socket authenticated: Student Name (student)
⏰ Waiting for approval...
✅ Approved! Joining room...
📹 Starting local stream...
```

## Debug Tips:

### Nếu WebSocket không kết nối:
1. Check server logs: `🚀 Server running on port 5000`
2. Check Socket.IO namespace: `/live`
3. Test health: `curl http://localhost:5000/health`

### Nếu approval không hoạt động:
1. Check Redux/State: `waitingStudents` array
2. Check Socket events: `room:student-waiting`, `room:approve-student`
3. Check database collections: `LiveRoomWaiting`, `LiveRoomParticipants`

## Database Models:

### LiveRoomWaiting
```javascript
{
  roomId: String,
  liveClassId: ObjectId,
  studentId: ObjectId,
  fullName: String,
  email: String,
  status: 'waiting' | 'rejected',
  requestedAt: Date
}
```

### LiveRoomParticipants
```javascript
{
  roomId: String,
  liveClassId: ObjectId,
  studentId: ObjectId,
  fullName: String,
  email: String,
  approvedBy: ObjectId,
  approvedAt: Date,
  isOnline: Boolean
}
```

## Socket.IO Events:

### Student → Server:
- `room:request-join` - Request vào phòng

### Server → Teacher:
- `room:student-waiting` - Có học sinh chờ
- `room:waiting-list-updated` - Update danh sách chờ

### Teacher → Server:
- `room:approve-student` - Duyệt học sinh
- `room:reject-student` - Từ chối học sinh

### Server → Student:
- `room:approved` - Được duyệt, join room
- `room:rejected` - Bị từ chối

### Server → All:
- `room:user-joined` - User joined room
- `room:participants-updated` - Update participants list

## Troubleshooting:

### Port Already in Use:
```bash
lsof -i :5000 -P -n
kill -9 <PID>
```

### Clear Cache:
```bash
cd client
rm -rf node_modules/.cache
npm start
```

### MongoDB Issues:
```bash
docker ps | grep mongo
docker logs edu-mongo
```

## Next Steps:

- [ ] Add notification sound khi có student chờ
- [ ] Add auto-approve setting
- [ ] Add bulk approve/reject
- [ ] Add waiting time limit (auto-reject sau X phút)
- [ ] Add student queue position indicator

