# 🎥 Socket.IO Live Class - Quick Start

## ✨ Demo Live Class đã tạo sẵn!

**Room Information:**
- **Room ID:** `8a8c9fe1f2998fefad02b02abbb9fc63`
- **Password:** `5cd78bda3923ebd7`
- **Title:** Live Socket.IO Demo
- **Status:** Scheduled (cần start trước khi join)

---

## 🚀 Hướng Dẫn Test Nhanh

### Bước 1: Teacher Login & Start Class

```bash
# 1. Mở browser và truy cập
http://localhost:3000/login

# 2. Đăng nhập với tài khoản teacher
Email: teacher@edu.com
Password: Teacher@123

# 3. Vào trang Create Live
http://localhost:3000/teacher/create-live

# 4. Tìm lớp "Live Socket.IO Demo"
# 5. Nhấn "▶️ Bắt đầu" để start class
# 6. Nhấn "🎥 Vào Phòng" để vào live room
```

### Bước 2: Teacher trong Live Room

```
✅ Thấy header với title "Live Socket.IO Demo"
✅ Status hiển thị "🔴 Live" (màu đỏ)
✅ Connection status: "🟢 Đã kết nối"
✅ Participants panel bên trái (hiện 1 người - chính teacher)
✅ Video placeholder ở giữa
✅ Chat area ở dưới
✅ Questions panel bên phải

🔑 Nhấn "📋 Copy Link" để lấy link tham gia
Link sẽ là: http://localhost:3000/join-live/8a8c9fe1f2998fefad02b02abbb9fc63
```

### Bước 3: Student Login & Join

```bash
# 1. Mở tab/browser mới (hoặc incognito)
http://localhost:3000/login

# 2. Đăng nhập với tài khoản student
Email: student@edu.com
Password: Student@123

# 3. Paste link từ teacher
http://localhost:3000/join-live/8a8c9fe1f2998fefad02b02abbb9fc63

# 4. Nhập password
Password: 5cd78bda3923ebd7

# 5. Nhấn "Tham Gia Lớp Học"
```

### Bước 4: Student trong Live Room

```
✅ Thấy title "Live Socket.IO Demo"
✅ Video placeholder (giáo viên)
✅ Sidebar với:
   - Participants (2 người: teacher + student)
   - Chat
   - Questions

📝 Test Chat:
   - Nhập "Hello teacher!" → Enter
   → Teacher thấy tin nhắn ngay lập tức!

❓ Test Questions:
   - Nhập câu hỏi "What is Socket.IO?"
   - Nhấn "Gửi Câu Hỏi"
   → Teacher thấy trong Questions panel
   → Teacher có thể trả lời ngay

✋ Test Raise Hand:
   - Nhấn "✋ Giơ Tay"
   → Teacher nhận notification
```

### Bước 5: Teacher Response

```
Teacher browser:

💬 Chat:
   - Thấy tin nhắn từ student
   - Trả lời: "Hello student!"
   → Student thấy ngay

❓ Questions:
   - Thấy câu hỏi "What is Socket.IO?"
   - Nhập câu trả lời: "Socket.IO enables real-time communication"
   - Nhấn "Trả lời"
   → Student thấy answer màu xanh

📊 Participants:
   - Thấy 2 người: 👨‍🏫 Teacher, 👨‍🎓 Student
   - Có thể mute student (nhấn 🔇)

🔴 Notification:
   - Thấy "✋ [Student Name] đã giơ tay"
```

---

## 🎯 Các Tính Năng Để Test

### ✅ Real-time Chat
- [ ] Student gửi message → Teacher nhận ngay
- [ ] Teacher gửi message → Student nhận ngay
- [ ] Messages của teacher highlight màu vàng
- [ ] System messages khi join/leave

### ✅ Q&A System
- [ ] Student đặt câu hỏi → Teacher thấy
- [ ] Teacher trả lời → Student thấy ngay
- [ ] Câu hỏi đã trả lời màu xanh
- [ ] Multiple questions handling

### ✅ Participant Management
- [ ] Real-time participant count
- [ ] Join notifications
- [ ] Leave notifications
- [ ] Role badges hiển thị đúng

### ✅ Controls
- [ ] Raise hand → Teacher nhận notification
- [ ] Copy link → Link chính xác
- [ ] Mute participant → Student nhận force-mute
- [ ] End class → All disconnect

---

## 🔄 Alternative Test Flow

### Test với 3 browsers cùng lúc:

**Browser 1 (Teacher):**
```
1. Login: teacher@edu.com
2. Start class
3. Enter room
4. Send chat: "Welcome everyone!"
5. Wait for students to join
6. Answer questions
```

**Browser 2 (Student 1):**
```
1. Login: student@edu.com
2. Join room với link & password
3. Send chat: "Hello!"
4. Ask question: "Can you explain the topic?"
5. Raise hand
```

**Browser 3 (Student 2):**
```
1. Login: student2@edu.com
2. Join room
3. Send chat: "Hi everyone!"
4. Watch chat and Q&A
```

**Kết quả:**
- Cả 3 browsers thấy nhau trong participants
- Messages xuất hiện real-time ở tất cả browsers
- Questions và answers sync ngay lập tức
- Join/leave notifications cho tất cả

---

## 🐛 Troubleshooting

### Socket không connect?

```bash
# Check server
curl http://localhost:5001/health

# Check logs
sudo docker logs edu-server -f

# Browser console
# Should see: "Socket connected"
# Should see: "Joined room successfully"
```

### Không nhận được messages?

```javascript
// Browser console
socket.on('new-message', (msg) => console.log('Message:', msg));
socket.on('error', (err) => console.error('Error:', err));

// Check settings
// allowChat should be true
// allowQuestions should be true
```

### Password không đúng?

```bash
# Get correct password from API
TOKEN=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@edu.com","password":"Teacher@123"}' \
  | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

curl -s http://localhost:5001/api/live-classes/<id> \
  -H "Authorization: Bearer $TOKEN" \
  | jq '{roomId, password}'
```

---

## 📹 Demo Video Flow

```
0:00 - Teacher login
0:15 - Teacher creates live class
0:30 - Teacher starts class
0:45 - Teacher enters room
1:00 - Teacher copies join link
1:15 - Student opens link
1:30 - Student enters password
1:45 - Student joins room
2:00 - Both see each other in participants
2:15 - Student sends chat message
2:20 - Teacher sees message immediately
2:30 - Teacher replies
2:35 - Student sees reply immediately
2:45 - Student asks question
2:50 - Teacher sees question in panel
3:00 - Teacher types answer
3:05 - Student sees answer turn green
3:15 - Student raises hand
3:20 - Teacher sees notification
3:30 - Teacher ends class
3:35 - Both disconnected
```

---

## ✅ Success Checklist

- [ ] Server health: `curl http://localhost:5001/health` returns OK
- [ ] Teacher can login
- [ ] Teacher can create live class
- [ ] Teacher can start class
- [ ] Teacher can enter room
- [ ] Teacher sees "🟢 Đã kết nối"
- [ ] Student can login
- [ ] Student can access join link
- [ ] Student can enter correct password
- [ ] Student can join room
- [ ] Both see each other in participants list
- [ ] Chat messages appear real-time
- [ ] Questions appear real-time
- [ ] Answers update real-time
- [ ] Hand raise notifications work
- [ ] Teacher can end class
- [ ] All disconnect properly

---

## 🎉 Expected Results

### Teacher View
```
┌───────────────────────────────────────────────┐
│ 🎥 Live Socket.IO Demo  🔴 Live  👥 2         │
│ 🟢 Đã kết nối  📋 Copy Link  ⏹ Kết Thúc     │
├──────┬────────────────────┬────────────────────┤
│      │                    │                    │
│ 👥 2 │  📹 Video Area     │  ❓ Questions (1)  │
│      │                    │                    │
│👨‍🏫 You│                    │  Q: What is       │
│👨‍🎓 S1 │                    │     Socket.IO?    │
│      ├────────────────────┤                    │
│      │ 💬 Chat            │  A: Socket.IO...  │
│      │                    │  ✅ Answered       │
│      │ S1: Hello!         │                    │
│      │ You: Welcome!      │                    │
└──────┴────────────────────┴────────────────────┘
```

### Student View
```
┌──────────────────────────────────────────────────┐
│ 🎥 Live Socket.IO Demo  🔴 Live  👥 2  ✋ 🚪    │
├─────────────────────────────┬────────────────────┤
│                             │                    │
│  📹 Video Area              │  👥 Participants   │
│  (Teacher Stream)           │  👨‍🏫 Teacher       │
│                             │  👨‍🎓 You           │
│                             ├────────────────────┤
│                             │  💬 Chat           │
│                             │  You: Hello!       │
│                             │  Teacher: Welcome! │
│                             ├────────────────────┤
│                             │  ❓ Ask Question   │
│                             │  [text area]       │
│                             │  [Send button]     │
│                             │                    │
│                             │  Your Questions:   │
│                             │  Q: What is...     │
│                             │  A: Socket.IO...   │
│                             │  ✅ Answered        │
└─────────────────────────────┴────────────────────┘
```

---

## 📚 Documentation

- [SOCKET_LIVE_CLASS.md](SOCKET_LIVE_CLASS.md) - Complete guide
- [SOCKET_DEPLOYMENT.md](SOCKET_DEPLOYMENT.md) - Deployment details
- [TEACHER_FEATURES.md](TEACHER_FEATURES.md) - Teacher features
- [API_TEACHER.md](API_TEACHER.md) - API reference

---

## 🚀 Start Testing Now!

1. **Teacher Browser:** http://localhost:3000/login → teacher@edu.com
2. **Student Browser:** http://localhost:3000/login → student@edu.com
3. **Follow steps above** ☝️
4. **Enjoy real-time interaction!** 🎉

---

✅ **Socket.IO Live Class Ready to Test!**
