# 🔍 DEBUG WAITING ROOM - HƯỚNG DẪN FIX LỖI

## ❌ LỖI HIỆN TẠI

1. **WebSocket vẫn kết nối port 5001** → Cache browser chưa xóa
2. **401 Unauthorized** khi học sinh join → Token hoặc authentication sai
3. **Nút duyệt/từ chối không hiện** → Waiting Room chưa được bật hoặc cache

---

## ✅ GIẢI PHÁP - THỰC HIỆN THEO THỨ TỰ

### BƯỚC 1: XÓA CACHE VÀ RESTART

```bash
# 1.1. Dừng client (Ctrl+C)

# 1.2. Xóa toàn bộ cache
cd "/home/dtu/huy/duy /C1SE.03/client"
sudo rm -rf node_modules/.cache build .cache
sudo chown -R $USER:$USER node_modules

# 1.3. Restart client
npm start
```

### BƯỚC 2: XÓA CACHE BROWSER

**Trong Chrome/Edge:**
1. Nhấn `Ctrl + Shift + Delete`
2. Chọn "Cached images and files"
3. Chọn "All time"
4. Nhấn "Clear data"

**Hoặc Hard Refresh:**
- `Ctrl + Shift + R` (Linux/Windows)
- `Cmd + Shift + R` (Mac)

### BƯỚC 3: TẠO LỚP HỌC MỚI VỚI WAITING ROOM

**Quan trọng:** Phải tạo lớp mới, lớp cũ không có `waitingRoom: true`

1. Login bằng **teacher@edu.com / Teacher@123**
2. Vào trang "Tạo lớp học trực tuyến"
3. Điền thông tin:
   - Tiêu đề: "Test Waiting Room"
   - Mô tả: "Kiểm tra chức năng phòng chờ"
   - Thời gian bắt đầu: (chọn thời gian hiện tại)
   - Thời gian kết thúc: (chọn sau 2 giờ)
4. **⚠️ QUAN TRỌNG: Tích vào checkbox "🚪 Phòng chờ"** 
5. Nhấn "Tạo và bắt đầu ngay"

### BƯỚC 4: KIỂM TRA GIAO DIỆN GIÁO VIÊN

Sau khi vào phòng học, giáo viên sẽ thấy:

**Toolbar bên trái có 4 nút:**
- 👥 Người tham gia (0)
- ⏳ **Chờ duyệt (0)** ← NÚT NÀY PHẢI CÓ
- ❓ Câu hỏi (0)  
- 💬 Chat

**Nếu không thấy nút "⏳ Chờ duyệt":**
- Cache chưa xóa → Quay lại BƯỚC 1-2
- Live class không có `waitingRoom: true` → Tạo lớp mới

### BƯỚC 5: TEST VỚI HỌC SINH

**5.1. Mở Incognito Window (Ctrl+Shift+N)**

**5.2. Login học sinh:**
- Email: **student@edu.com**
- Password: **Student@123**

**Nếu 401 Unauthorized:**

```bash
# Kiểm tra xem account có tồn tại không
cd "/home/dtu/huy/duy /C1SE.03"
./scripts/check-student.sh
```

**Nếu không có account, tạo mới:**
- Vào trang Register
- Chọn role "Student"
- Điền thông tin:
  - Email: teststudent@edu.com
  - Password: Test@123
  - Họ tên: Test Student

**5.3. Học sinh join lớp:**
- Vào "Lớp học của tôi"
- Click vào lớp vừa tạo
- Nhấn "Tham gia lớp"

**5.4. Học sinh sẽ thấy màn hình:**
```
⏰ Đang chờ giáo viên duyệt...
Vui lòng đợi giáo viên chấp nhận yêu cầu tham gia của bạn
```

### BƯỚC 6: GIÁO VIÊN DUYỆT

**6.1. Quay lại cửa sổ giáo viên**

**6.2. Kiểm tra nút "⏳ Chờ duyệt":**
- Badge đỏ hiển thị số 1
- Click vào nút "⏳ Chờ duyệt (1)"

**6.3. Panel bên phải mở ra:**
- Thấy card học sinh với:
  - 👨‍🎓 Tên học sinh
  - ✅ Nút "Duyệt" (xanh lá)
  - ❌ Nút "Từ chối" (đỏ)

**6.4. Click nút "✅ Duyệt"**

**6.5. Kiểm tra kết quả:**
- Badge "⏳ Chờ duyệt" giảm xuống 0
- Học sinh biến mất khỏi panel
- "👥 Người tham gia" tăng lên 1
- Video của học sinh xuất hiện trong VideoGrid

**6.6. Ở cửa sổ học sinh:**
- Màn hình chờ biến mất
- Video của giáo viên xuất hiện
- Camera/micro của học sinh bật

---

## 🔎 DEBUG BẰNG CONSOLE LOGS

### Console của Giáo Viên:

```javascript
// Khi có học sinh vào chờ:
🔔 New student waiting: {userId: "xxx", fullName: "Test Student", ...}
waitingStudents: [...]

// Khi approve:
👍 Approving student: xxx
✅ Student approved successfully: xxx
```

### Console của Học Sinh:

```javascript
// Khi vào phòng:
🚪 Socket connected to waiting room
⏰ Status: waiting_approval

// Khi được duyệt:
✅ Join approved! Connecting to room...
🎥 Joining room with video...
```

---

## 📊 KIỂM TRA DATABASE

```bash
# Kết nối MongoDB
docker exec -it edu-mongo mongosh -u admin -p admin123

# Chuyển sang database
use edu_platform

# Kiểm tra live class có waitingRoom không
db.liveclasses.findOne(
  { title: "Test Waiting Room" },
  { title: 1, "settings.waitingRoom": 1 }
)
// Phải trả về: { settings: { waitingRoom: true } }

# Kiểm tra waiting students
db.liveroomwaitings.find({}).pretty()

# Kiểm tra participants
db.liveroomparticipants.find({}).pretty()
```

---

## ❓ TROUBLESHOOTING

### Vấn đề: WebSocket vẫn kết nối port 5001

**Nguyên nhân:** Browser cache hoặc build cache chưa xóa

**Giải pháp:**
1. Dừng hẳn npm start (Ctrl+C)
2. Đóng tất cả tab browser liên quan
3. Xóa cache: `sudo rm -rf node_modules/.cache`
4. Hard refresh: Ctrl+Shift+R
5. Restart: `npm start`

### Vấn đề: 401 Unauthorized

**Nguyên nhân:** Token hết hạn hoặc account không tồn tại

**Giải pháp:**
1. Logout và login lại
2. Kiểm tra localStorage:
   ```javascript
   // Mở Console (F12)
   console.log(localStorage.getItem('accessToken'))
   console.log(JSON.parse(localStorage.getItem('user')))
   ```
3. Nếu null → Login lại
4. Nếu vẫn lỗi → Tạo account mới

### Vấn đề: Không thấy nút "⏳ Chờ duyệt"

**Nguyên nhân:** 
- Waiting Room chưa bật trong live class
- Không phải giáo viên (isHost = false)
- Cache chưa xóa

**Giải pháp:**
1. Kiểm tra DB: `db.liveclasses.findOne({}, {"settings.waitingRoom": 1})`
2. Tạo lớp mới với checkbox "🚪 Phòng chờ" được tích
3. Xóa cache và restart

### Vấn đề: Badge hiện số nhưng panel trống

**Nguyên nhân:** Socket event không được xử lý đúng

**Giải pháp:**
1. Kiểm tra console có log `🔔 New student waiting`
2. Kiểm tra `waitingStudents` trong useWebRTC hook
3. Restart server:
   ```bash
   cd "/home/dtu/huy/duy /C1SE.03/server"
   npm start
   ```

---

## ✅ CHECKLIST HOÀN THÀNH

- [ ] Cache đã xóa (client + browser)
- [ ] Server đang chạy port 5000
- [ ] Client đang chạy port 3000
- [ ] Tạo lớp mới với "🚪 Phòng chờ" được tích
- [ ] Giáo viên thấy nút "⏳ Chờ duyệt (0)"
- [ ] Học sinh login thành công (không 401)
- [ ] Học sinh vào chờ → Badge tăng lên 1
- [ ] Panel mở ra hiển thị card học sinh
- [ ] Nút "✅ Duyệt" và "❌ Từ chối" hiển thị
- [ ] Click duyệt → Học sinh join thành công
- [ ] Video học sinh xuất hiện trong VideoGrid

---

## 📞 NẾU VẪN LỖI

Gửi cho tôi:

1. **Screenshot của:**
   - Toolbar giáo viên (4 nút)
   - Console log của giáo viên
   - Console log của học sinh
   - Form tạo lớp (checkbox phòng chờ)

2. **Output của commands:**
   ```bash
   # Check server port
   netstat -tuln | grep 5000
   
   # Check live class
   docker exec -it edu-mongo mongosh -u admin -p admin123 \
     --eval "use edu_platform; db.liveclasses.findOne({}, {title:1,'settings.waitingRoom':1})"
   ```

3. **Browser console logs:**
   - Mở F12 → Console tab
   - Copy toàn bộ logs có chữ "WebSocket" hoặc "waiting"
