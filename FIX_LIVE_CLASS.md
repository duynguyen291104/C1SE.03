# Hướng dẫn Sửa lỗi Live Class

## Các lỗi đã được sửa

### 1. **Lỗi 401 Unauthorized khi tạo lớp học**
**Nguyên nhân:** 
- File `CreateLive.js` đang sử dụng `axios` trực tiếp thay vì instance `api` đã được cấu hình
- Instance `api` có interceptors để tự động thêm token và xử lý refresh token

**Giải pháp:**
- ✅ Đã thay đổi tất cả các lời gọi từ `axios` sang `api`
- ✅ Loại bỏ việc thêm header Authorization thủ công (api đã tự động xử lý)
- ✅ Cải thiện xử lý lỗi để hiển thị thông báo rõ ràng hơn

### 2. **Yêu cầu phê duyệt giáo viên**
**Nguyên nhân:**
- API `/live-classes` yêu cầu user phải là giáo viên đã được phê duyệt (`teacherStatus: 'approved'`)

**Giải pháp:**
- ✅ Cải thiện thông báo lỗi khi user chưa được phê duyệt
- ✅ Tạo script `approve-teacher.js` để phê duyệt giáo viên nhanh chóng

### 3. **Lưu dữ liệu vào database**
**Trạng thái:** ✅ Đã hoạt động đúng
- Controller `createLiveClass` đã sử dụng `LiveClass.create()` để lưu vào MongoDB
- Mỗi lớp học được tạo sẽ tự động lưu vào collection `liveclasses`
- Có AuditLog để theo dõi hành động tạo lớp học

## Cách sử dụng

### 1. Đảm bảo đã đăng nhập với tài khoản giáo viên được phê duyệt

**Tài khoản giáo viên có sẵn trong database:**
- Email: `teacher@edu.com`
- Password: `Teacher@123`
- Status: ✅ Đã được phê duyệt

**Hoặc:**
- Email: `teacher2@edu.com`
- Password: `Teacher@123`
- Status: ✅ Đã được phê duyệt

### 2. Phê duyệt giáo viên mới (nếu cần)

Nếu bạn muốn phê duyệt một user khác làm giáo viên:

```bash
# Cách 1: Sử dụng script
docker exec -it edu-server node scripts/approve-teacher.js <email>

# Ví dụ:
docker exec -it edu-server node scripts/approve-teacher.js newteacher@edu.com

# Cách 2: Sử dụng MongoDB trực tiếp
docker exec -it edu-mongo mongosh -u admin -p admin123 --authenticationDatabase admin edu_ecosystem --eval "
  db.users.updateOne(
    { email: 'newteacher@edu.com' },
    { 
      \$set: { 
        teacherStatus: 'approved'
      },
      \$addToSet: { 
        roles: 'teacher'
      }
    }
  )
"
```

### 3. Test tạo lớp học

1. Đăng nhập với tài khoản giáo viên đã được phê duyệt
2. Vào trang "Tạo Lớp Học" (`/teacher/create-live`)
3. Điền thông tin:
   - Tiêu đề lớp học
   - Mô tả (tùy chọn)
   - Thời gian bắt đầu (phải là thời điểm tương lai)
   - Thời gian kết thúc (phải sau thời gian bắt đầu)
   - Số người tham gia tối đa
   - Các cài đặt khác
4. Click "Tạo Lớp Học"

### 4. Kiểm tra dữ liệu trong database

```bash
# Xem tất cả lớp học đã tạo
docker exec -it edu-mongo mongosh -u admin -p admin123 --authenticationDatabase admin edu_ecosystem --eval "db.liveclasses.find({}).pretty()"

# Xem lớp học của một giáo viên cụ thể
docker exec -it edu-mongo mongosh -u admin -p admin123 --authenticationDatabase admin edu_ecosystem --eval "
  db.liveclasses.find({ teacherId: ObjectId('YOUR_TEACHER_ID') }).pretty()
"

# Đếm số lớp học
docker exec -it edu-mongo mongosh -u admin -p admin123 --authenticationDatabase admin edu_ecosystem --eval "db.liveclasses.countDocuments()"
```

## Cấu trúc dữ liệu LiveClass trong Database

```javascript
{
  _id: ObjectId,
  teacherId: ObjectId,              // ID của giáo viên tạo lớp
  title: String,                    // Tiêu đề lớp học
  description: String,              // Mô tả
  scheduledStart: Date,             // Thời gian bắt đầu
  scheduledEnd: Date,               // Thời gian kết thúc
  maxParticipants: Number,          // Số người tham gia tối đa
  roomId: String,                   // ID phòng (tự động sinh)
  password: String,                 // Mật khẩu phòng (tự động sinh)
  status: String,                   // scheduled | live | ended | cancelled
  settings: {
    allowChat: Boolean,
    allowQuestions: Boolean,
    recordSession: Boolean,
    waitingRoom: Boolean,
    muteOnEntry: Boolean
  },
  materials: Array,                 // Tài liệu đính kèm
  tags: Array,                      // Tags
  participants: Array,              // Danh sách người tham gia
  uniqueParticipants: Number,       // Tổng số người đã tham gia
  currentOnline: Number,            // Số người đang online
  createdAt: Date,
  updatedAt: Date
}
```

## Các API endpoints

```
POST   /api/live-classes           - Tạo lớp học mới
GET    /api/live-classes           - Lấy danh sách lớp học
GET    /api/live-classes/:id       - Lấy chi tiết lớp học
PUT    /api/live-classes/:id       - Cập nhật lớp học
DELETE /api/live-classes/:id       - Xóa lớp học
POST   /api/live-classes/:id/start - Bắt đầu lớp học
POST   /api/live-classes/:id/end   - Kết thúc lớp học
POST   /api/live-classes/:id/cancel - Hủy lớp học

POST   /api/student/live-classes/:id/join - Tham gia lớp học
```

## Xử lý lỗi phổ biến

### Lỗi: "Teacher approval required"
- **Nguyên nhân:** User chưa được phê duyệt làm giáo viên
- **Giải pháp:** Sử dụng script `approve-teacher.js` để phê duyệt

### Lỗi: "Start time must be in the future"
- **Nguyên nhân:** Thời gian bắt đầu phải là thời điểm trong tương lai
- **Giải pháp:** Chọn thời gian bắt đầu sau thời điểm hiện tại

### Lỗi: "End time must be after start time"
- **Nguyên nhân:** Thời gian kết thúc phải sau thời gian bắt đầu
- **Giải pháp:** Đảm bảo thời gian kết thúc > thời gian bắt đầu

### Lỗi: "Bạn đã có một lớp học đang diễn ra"
- **Nguyên nhân:** Giáo viên chỉ có thể có 1 lớp học đang live
- **Giải pháp:** Kết thúc lớp học hiện tại trước khi tạo lớp mới

## Logs và Debug

```bash
# Xem logs của server
docker logs edu-server -f

# Xem logs của client
docker logs edu-client -f

# Kiểm tra database connection
docker exec -it edu-mongo mongosh -u admin -p admin123 --authenticationDatabase admin --eval "db.adminCommand('ping')"

# Restart services nếu cần
docker restart edu-server
docker restart edu-client
```

## Tính năng đã hoàn thiện

✅ Tạo lớp học và lưu vào database
✅ Xác thực và phân quyền
✅ Tự động sinh roomId và password
✅ Validation dữ liệu đầu vào
✅ Audit logging
✅ Quản lý trạng thái lớp học
✅ Xử lý lỗi và thông báo rõ ràng
✅ Auto-refresh token khi hết hạn

## Support

Nếu gặp vấn đề, kiểm tra:
1. Server đang chạy: `docker ps | grep edu-server`
2. Database đang chạy: `docker ps | grep edu-mongo`
3. Logs của server: `docker logs edu-server --tail 50`
4. User đã được phê duyệt: Script approve-teacher.js
