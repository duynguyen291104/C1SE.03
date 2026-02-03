## 🔍 DEBUG WAITING ROOM - KIỂM TRA LOGS

### ✅ ĐÃ THÊM DEBUG LOGS

**Server logs (đang có):**
- ✅ `⏳ Student added to WAITING table`
- ✅ `⏳ Student waiting for approval from host`

**Client logs (vừa thêm):**
- 🆕 `🔔 New student waiting:` - Khi nhận event từ server
- 🆕 `📋 Full waiting list:` - Danh sách đầy đủ
- 🆕 `✅ Setting waitingStudents to:` - State sẽ set
- 🆕 `⏳ LiveClassRoom: waitingStudents updated:` - State đã update trong component

### 🧪 TEST NGAY - QUAN SÁT LOGS

#### BƯỚC 1: Refresh Browser (Giáo Viên)
```
Ctrl + Shift + R
```

#### BƯỚC 2: Mở Console (F12)
Nhìn các log sau khi giáo viên vào phòng:
```javascript
✅ Connected to signaling server
🎉 Joined room: {roomId: "...", ...}
⏳ LiveClassRoom: waitingStudents updated: {count: 0, students: [], isHost: true}
```

#### BƯỚC 3: Học Sinh Join (Incognito)
Sau khi học sinh nhấn "Tham gia lớp", xem console giáo viên:

**Nếu ĐÚNG (working):**
```javascript
🔔 New student waiting: {userId: "...", fullName: "Lê Văn Học Sinh", ...}
📋 Full waiting list: [{userId: "...", fullName: "Lê Văn Học Sinh", ...}]
✅ Setting waitingStudents to: [{...}]
⏳ LiveClassRoom: waitingStudents updated: {count: 1, students: [{...}], isHost: true}
```

**Nếu SAI (not working):**
```javascript
// Không thấy log 🔔 New student waiting
// HOẶC
🔔 New student waiting: undefined
📋 Full waiting list: []
✅ Setting waitingStudents to: []
```

### 🐛 TROUBLESHOOTING

#### Trường hợp 1: Không thấy log "🔔 New student waiting"
**Nguyên nhân:** Giáo viên chưa join room hoặc socket chưa connect
**Giải pháp:**
1. Kiểm tra log có "🎉 Joined room" không
2. Kiểm tra log có "✅ Connected to signaling server" không
3. Nếu không có → Lỗi joinToken hoặc authentication

#### Trường hợp 2: Log có nhưng waitingList = []
**Nguyên nhân:** Server emit sai format hoặc studentId không match
**Giải pháp:** Xem server logs có dòng:
```
⏳ Student Lê Văn Học Sinh added to WAITING table
```
Nếu có → Check database:
```bash
docker exec edu-mongo mongosh -u admin -p admin123 --eval "
  use edu_platform;
  db.liveroomwaitings.find({status:'waiting'}).pretty();
"
```

#### Trường hợp 3: waitingStudents update nhưng UI không hiện
**Nguyên nhân:** isHost = false hoặc conditional rendering issue
**Giải pháp:** Kiểm tra log:
```javascript
⏳ LiveClassRoom: waitingStudents updated: {
  count: 1, 
  students: [...],
  isHost: false  // ← NẾU false THÌ NÚT SẼ KHÔNG HIỆN
}
```

### 📊 EXPECTED FLOW

**1. Giáo viên vào phòng:**
```
Client → Socket connect → Emit join với JWT
Server → Verify JWT → joinRoomDirectly (teacher)
Server → Emit room:joined với waitingStudents: []
Client → Set roomData, waitingStudents = []
```

**2. Học sinh request join:**
```
Client → Emit join với JWT
Server → Check isStudent + waitingRoom enabled
Server → Add to LiveRoomWaiting table
Server → Emit room:student-waiting TO HOST
Client (Teacher) → Receive event → Update waitingStudents state
UI → Show badge "⏳ Chờ duyệt (1)"
```

**3. Giáo viên approve:**
```
Client → Click "Duyệt" → approveStudent(userId)
Hook → Emit room:approve-student
Server → Delete from LiveRoomWaiting
Server → Add to LiveRoomParticipants
Server → Call joinRoomDirectly(studentSocket)
Server → Emit room:waiting-updated TO HOST
Client → Update waitingStudents (remove approved)
```

### 🎯 NEXT STEPS

1. **Refresh browser giáo viên** với F12 console mở sẵn
2. **Học sinh join** qua incognito
3. **Copy toàn bộ console logs** (cả giáo viên và học sinh)
4. **Gửi logs** nếu vẫn không work

**Expected result:** Sau khi học sinh join, giáo viên thấy badge "(1)" ngay lập tức!
