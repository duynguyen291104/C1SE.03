# 🔐 Tài Khoản Demo - Edu Ecosystem Platform

## 📋 Danh Sách Tài Khoản

### 👨‍💼 Quản Trị Viên (Admin)
```
Email: admin@edu.com
Password: Admin@123
Roles: admin
```
**Quyền hạn:**
- Quản lý toàn bộ hệ thống
- Duyệt tài khoản giáo viên
- Quản lý người dùng, khóa học, tài liệu
- Xem báo cáo và thống kê

---

### 👨‍🏫 Giáo Viên (Teacher)

#### Giáo viên 1
```
Email: teacher@edu.com
Password: Teacher@123
Roles: teacher
Status: approved
Họ tên: Nguyễn Văn Giáo Viên
```

#### Giáo viên 2
```
Email: teacher2@edu.com
Password: Teacher@123
Roles: teacher
Status: approved
Họ tên: Trần Thị Minh
```

**Quyền hạn:**
- Tạo và quản lý khóa học
- Upload tài liệu học tập
- Tạo bài kiểm tra và đề thi
- Quản lý học sinh trong khóa học
- Chấm điểm và đánh giá

---

### 👨‍🎓 Học Sinh (Student)

#### Học sinh 1
```
Email: student@edu.com
Password: Student@123
Roles: student
Họ tên: Lê Văn Học Sinh
Lớp: 12A1
```

#### Học sinh 2
```
Email: student2@edu.com
Password: Student@123
Roles: student
Họ tên: Phạm Thị Lan
Lớp: 11B2
```

**Quyền hạn:**
- Đăng ký khóa học
- Xem tài liệu học tập
- Làm bài kiểm tra
- Theo dõi tiến độ học tập
- Comment và thảo luận

---

## 🚀 Hướng Dẫn Sử Dụng

### 1. Khởi động hệ thống
```bash
cd C1SE.03
sudo docker compose up -d
```

### 2. Đăng nhập
- Truy cập: http://localhost:3000
- Chọn tài khoản phù hợp từ danh sách trên
- Nhập email và password

### 3. Test API với curl

#### Login
```bash
# Login as teacher
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@edu.com","password":"Teacher@123"}'

# Login as student
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"student@edu.com","password":"Student@123"}'
```

#### Get Profile
```bash
# Thay <ACCESS_TOKEN> bằng token nhận được từ login
curl http://localhost:5001/api/auth/me \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

---

## 📝 Lưu Ý Bảo Mật

⚠️ **Chỉ sử dụng các tài khoản này cho môi trường development/demo**

Khi deploy production:
1. Xóa hoặc disable các tài khoản demo
2. Đổi tất cả mật khẩu mặc định
3. Sử dụng mật khẩu mạnh và unique
4. Bật xác thực 2 yếu tố (2FA) nếu có
5. Thay đổi JWT secrets trong environment variables

---

## 🔄 Reset Tài Khoản

Nếu muốn reset về trạng thái ban đầu:
```bash
# Dừng containers
sudo docker compose down

# Xóa volume database
sudo docker volume rm c1se03_mongo_data

# Khởi động lại (sẽ tự tạo lại demo accounts)
sudo docker compose up -d
```

---

## 📞 Hỗ Trợ

Nếu gặp vấn đề với tài khoản:
1. Kiểm tra server logs: `sudo docker logs edu-server`
2. Kiểm tra database: `sudo docker exec -it edu-mongo mongosh`
3. Xem hướng dẫn trong [QUICKSTART.md](./QUICKSTART.md)
