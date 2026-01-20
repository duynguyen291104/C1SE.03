# 🎥 Live Class Socket.IO - Hướng Dẫn Sử Dụng

## 📋 Tổng Quan

Hệ thống Live Class sử dụng Socket.IO để tạo môi trường học trực tuyến real-time với các tính năng:
- ✅ Chat real-time giữa giáo viên và học sinh
- ✅ Hệ thống hỏi đáp (Q&A)
- ✅ Quản lý người tham gia
- ✅ Giơ tay phát biểu
- ✅ Tắt micro học sinh (teacher only)

---

## 🏗 Kiến Trúc

### Backend (Socket.IO Server)
- **Namespace:** `/live`
- **Authentication:** JWT token qua `socket.handshake.auth.token`
- **File:** `server/src/socket/liveClassSocket.js`

### Frontend (Socket.IO Client)
- **Library:** `socket.io-client`
- **Teacher Room:** `/teacher/live-room/:liveClassId`
- **Student Join:** `/join-live/:roomId`

---

## 🚀 Hướng Dẫn Sử Dụng

### Cho Giáo Viên

#### 1. Tạo Lớp Học
```
1. Vào trang /teacher/create-live
2. Điền thông tin:
   - Tiêu đề
   - Mô tả
   - Thời gian bắt đầu/kết thúc
   - Số người tham gia tối đa
   - Cài đặt (chat, Q&A, recording, etc.)
3. Nhấn "Tạo Lớp Học"
```

#### 2. Bắt Đầu Lớp Học
```
1. Ở danh sách lớp học, nhấn "▶️ Bắt đầu"
2. Lớp học chuyển sang trạng thái "active"
3. Nhấn "🎥 Vào Phòng" để vào phòng live
```

#### 3. Trong Phòng Live
```
✅ Thấy danh sách người tham gia real-time
✅ Chat với học sinh (nếu bật allowChat)
✅ Nhận và trả lời câu hỏi (nếu bật allowQuestions)
✅ Tắt micro học sinh (nếu cần)
✅ Copy link tham gia để gửi cho học sinh
✅ Kết thúc lớp học khi hoàn tất
```

#### 4. Chia Sẻ Link Tham Gia
```
Cách 1: Nhấn "📋 Copy Link" trong phòng
Cách 2: Chia sẻ thủ công:
   - Room ID: <roomId từ database>
   - Password: <password từ database>
   - Link: http://localhost:3000/join-live/<roomId>
```

### Cho Học Sinh

#### 1. Tham Gia Lớp Học
```
1. Nhận link từ giáo viên: http://localhost:3000/join-live/<roomId>
2. Đăng nhập (nếu chưa đăng nhập)
3. Nhập password phòng (do giáo viên cung cấp)
4. Nhấn "Tham Gia Lớp Học"
```

#### 2. Trong Phòng Live
```
✅ Xem video/nội dung của giáo viên
✅ Chat với mọi người (nếu được phép)
✅ Đặt câu hỏi cho giáo viên
✅ Giơ tay để được gọi
✅ Nhận thông báo khi bị tắt micro
```

---

## 🔌 Socket Events

### Client → Server

#### `join-room`
Tham gia phòng live

**Payload:**
```javascript
{
  roomId: string,      // Room ID từ LiveClass
  liveClassId: string  // MongoDB _id của LiveClass
}
```

**Response:** `joined-room` event

---

#### `send-message`
Gửi tin nhắn chat

**Payload:**
```javascript
{
  roomId: string,
  message: string
}
```

**Broadcast:** `new-message` event tới tất cả participants

---

#### `ask-question`
Đặt câu hỏi (student)

**Payload:**
```javascript
{
  roomId: string,
  question: string
}
```

**Broadcast:** `new-question` event tới tất cả participants

---

#### `answer-question`
Trả lời câu hỏi (teacher only)

**Payload:**
```javascript
{
  roomId: string,
  questionId: string,
  answer: string
}
```

**Broadcast:** `question-answered` event tới tất cả participants

---

#### `raise-hand`
Giơ tay phát biểu

**Payload:**
```javascript
{
  roomId: string
}
```

**Broadcast:** `hand-raised` event tới teacher

---

#### `mute-participant`
Tắt micro participant (teacher only)

**Payload:**
```javascript
{
  roomId: string,
  socketId: string  // Socket ID của participant cần mute
}
```

**Target:** `force-mute` event tới participant đó

---

#### `leave-room`
Rời phòng

**No payload**

**Broadcast:** `user-left` event tới tất cả participants

---

### Server → Client

#### `joined-room`
Xác nhận đã join thành công

**Payload:**
```javascript
{
  roomId: string,
  liveClass: {
    _id: string,
    title: string,
    description: string,
    teacherId: Object,
    status: string,
    settings: Object
  },
  participants: Array,  // Danh sách tất cả participants
  isTeacher: boolean
}
```

---

#### `user-joined`
Có người mới tham gia

**Payload:**
```javascript
{
  user: {
    socketId: string,
    userId: string,
    fullName: string,
    role: string
  },
  participantCount: number
}
```

---

#### `user-left`
Có người rời phòng

**Payload:**
```javascript
{
  userId: string,
  userName: string,
  participantCount: number
}
```

---

#### `new-message`
Tin nhắn chat mới

**Payload:**
```javascript
{
  _id: string,
  userId: string,
  userName: string,
  userRole: string,
  message: string,
  timestamp: Date
}
```

---

#### `new-question`
Câu hỏi mới

**Payload:**
```javascript
{
  _id: string,
  userId: string,
  userName: string,
  question: string,
  answer: string,
  isAnswered: boolean,
  timestamp: Date
}
```

---

#### `question-answered`
Câu hỏi đã được trả lời

**Payload:**
```javascript
{
  questionId: string,
  answer: string,
  answeredAt: Date
}
```

---

#### `hand-raised`
Học sinh giơ tay

**Payload:**
```javascript
{
  userId: string,
  userName: string
}
```

---

#### `force-mute`
Bị teacher tắt micro

**No payload**

---

#### `error`
Lỗi xảy ra

**Payload:**
```javascript
{
  message: string
}
```

---

## 🔐 Authentication

Socket.IO sử dụng JWT authentication middleware:

```javascript
// Client side
const socket = io('http://localhost:5001/live', {
  auth: { 
    token: localStorage.getItem('accessToken') 
  }
});

// Server side
socket.user = {
  _id: '...',
  fullName: '...',
  email: '...',
  role: 'teacher' | 'student'
}
```

---

## 📊 Database Schema

### LiveClass Updates

Khi có hoạt động trong phòng, database được cập nhật:

**Participants:**
```javascript
{
  userId: ObjectId,
  joinedAt: Date,
  leftAt: Date,
  status: 'joined' | 'left'
}
```

**Chat:**
```javascript
{
  userId: ObjectId,
  userName: String,
  userRole: String,
  message: String,
  timestamp: Date
}
```

**Questions:**
```javascript
{
  userId: ObjectId,
  userName: String,
  question: String,
  answer: String,
  isAnswered: Boolean,
  timestamp: Date,
  answeredAt: Date
}
```

---

## 🧪 Testing

### Test với Teacher Account

```bash
# 1. Login
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@edu.com","password":"Teacher@123"}'

# 2. Tạo live class
curl -X POST http://localhost:5001/api/live-classes \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Live Class",
    "description": "Socket.IO test",
    "scheduledStart": "2026-01-21T10:00:00.000Z",
    "scheduledEnd": "2026-01-21T11:00:00.000Z",
    "maxParticipants": 50
  }'

# 3. Start live class
curl -X POST http://localhost:5001/api/live-classes/<id>/start \
  -H "Authorization: Bearer <token>"

# 4. Mở browser: http://localhost:3000/teacher/live-room/<id>
```

### Test với Student Account

```bash
# 1. Login
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"student@edu.com","password":"Student@123"}'

# 2. Mở browser: http://localhost:3000/join-live/<roomId>
# 3. Nhập password từ live class
```

---

## 🔧 Troubleshooting

### Socket không kết nối

**Check:**
1. Server có đang chạy? `curl http://localhost:5001/health`
2. Token có hợp lệ? Check localStorage
3. CORS có được cấu hình đúng?

**Server logs:**
```bash
sudo docker logs edu-server -f
```

### Không nhận được messages

**Check:**
1. Đã join room chưa? Check event `joined-room`
2. Settings có bật chat/questions không?
3. Browser console có lỗi?

**Debug:**
```javascript
socket.on('connect', () => console.log('Connected'));
socket.on('disconnect', () => console.log('Disconnected'));
socket.on('error', (err) => console.error('Error:', err));
```

### Teacher không thấy students

**Check:**
1. Students đã join đúng roomId?
2. Password có khớp không?
3. Check `activeRooms` trong server memory

**Server-side debug:**
```javascript
const { getActiveRooms } = require('./socket/liveClassSocket');
console.log(getActiveRooms());
```

---

## 🎨 UI Components

### LiveClassRoom (Teacher)
- **Path:** `/teacher/live-room/:liveClassId`
- **File:** `client/src/pages/LiveClassRoom.js`
- **Features:**
  - Participants panel (left)
  - Video area (center)
  - Chat (center-bottom)
  - Questions panel (right)

### JoinLiveClass (Student)
- **Path:** `/join-live/:roomId`
- **File:** `client/src/pages/JoinLiveClass.js`
- **Features:**
  - Password authentication
  - Video area (main)
  - Participants, chat, questions (sidebar)

---

## 🚀 Next Steps

### Planned Features

1. **WebRTC Video/Audio**
   - Integrate simple-peer or PeerJS
   - Screen sharing
   - Audio/video controls

2. **Recording**
   - Record sessions to MinIO
   - Playback interface
   - Download recordings

3. **Whiteboard**
   - Collaborative drawing
   - Image annotations
   - PDF presentation

4. **Breakout Rooms**
   - Split students into groups
   - Teacher can join any room
   - Group discussions

5. **Polls/Surveys**
   - Quick polls during class
   - Real-time results
   - Export data

---

## 📝 API Reference

### Create Live Class
```http
POST /api/live-classes
Authorization: Bearer <token>

{
  "title": "Class Title",
  "description": "Description",
  "scheduledStart": "2026-01-21T10:00:00.000Z",
  "scheduledEnd": "2026-01-21T11:00:00.000Z",
  "maxParticipants": 50,
  "settings": {
    "allowChat": true,
    "allowQuestions": true,
    "recordSession": false,
    "waitingRoom": false,
    "muteOnEntry": true
  }
}
```

### Start Live Class
```http
POST /api/live-classes/:id/start
Authorization: Bearer <token>
```

### End Live Class
```http
POST /api/live-classes/:id/end
Authorization: Bearer <token>
```

### Get Live Class
```http
GET /api/live-classes/:id
Authorization: Bearer <token>
```

---

## 🎓 Example Flow

### Complete Teacher → Student Flow

```
1. Teacher creates live class
   POST /api/live-classes
   → Returns: { roomId, password, _id }

2. Teacher starts class
   POST /api/live-classes/:id/start
   → Status: scheduled → active

3. Teacher enters room
   Navigate to /teacher/live-room/:id
   Socket connects to /live namespace
   Emits: join-room { roomId, liveClassId }
   Receives: joined-room { participants, liveClass }

4. Teacher copies link
   Click "📋 Copy Link"
   Link: http://localhost:3000/join-live/<roomId>
   Shares with students via email/chat

5. Student receives link and password
   Password: <from teacher>
   Link: http://localhost:3000/join-live/<roomId>

6. Student joins
   Navigate to link
   Enter password
   Socket connects
   Emits: join-room { roomId, liveClassId }
   Receives: joined-room
   Teacher receives: user-joined

7. Interaction
   Student sends message
   → Emits: send-message { roomId, message }
   → All receive: new-message

   Student asks question
   → Emits: ask-question { roomId, question }
   → All receive: new-question
   
   Teacher answers
   → Emits: answer-question { roomId, questionId, answer }
   → All receive: question-answered

8. End class
   Teacher clicks "⏹ Kết thúc"
   POST /api/live-classes/:id/end
   → Status: active → ended
   → All participants disconnected
```

---

## 📊 Performance Tips

1. **Limit participants:** Set reasonable `maxParticipants`
2. **Clean up rooms:** Empty rooms are automatically deleted
3. **Compress messages:** Large messages impact performance
4. **Use pagination:** For loading chat/questions history
5. **Throttle events:** Don't spam socket events

---

## 🔒 Security

1. **JWT Authentication:** Required for all connections
2. **Room Validation:** Verify roomId and password
3. **Role Checks:** Teacher-only actions verified server-side
4. **Input Sanitization:** All user inputs sanitized
5. **Rate Limiting:** Prevent spam messages

---

✅ **Socket.IO Live Class System Ready!**

Giáo viên và học sinh giờ có thể tương tác real-time trong lớp học trực tuyến!
