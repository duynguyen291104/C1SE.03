# Quick Start Guide

## Hướng dẫn chạy nhanh

### 1. Clone và Setup

```bash
cd /home/ngocduy/duy/C1SE.03

# Copy environment file
cp .env.example .env
```

### 2. Khởi động hệ thống

```bash
# Build và start tất cả containers
docker-compose up --build

# Hoặc chạy background
docker-compose up -d --build
```

### 3. Kiểm tra services

```bash
# Xem logs
docker-compose logs -f

# Kiểm tra containers
docker-compose ps
```

### 4. Truy cập

- Frontend: http://localhost:3000
- Backend API: http://localhost:5001/api
- MinIO Console: http://localhost:9001
- MongoDB: localhost:27017

### 5. Tài khoản Demo (Đã tạo sẵn)

Hệ thống tự động tạo các tài khoản demo khi khởi động lần đầu:

#### 👨‍💼 Admin
- Email: `admin@edu.com`
- Password: `Admin@123`

#### 👨‍🏫 Giáo viên (đã được duyệt)
- Email: `teacher@edu.com` / Password: `Teacher@123`
- Email: `teacher2@edu.com` / Password: `Teacher@123`

#### 👨‍🎓 Học sinh
- Email: `student@edu.com` / Password: `Student@123`
- Email: `student2@edu.com` / Password: `Student@123`

📖 Xem chi tiết trong [DEMO_ACCOUNTS.md](./DEMO_ACCOUNTS.md)

### 6. Test Flow

#### A. Đăng nhập nhanh với tài khoản có sẵn
```bash
# Test login API
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@edu.com","password":"Teacher@123"}'
```

Hoặc truy cập http://localhost:3000 và đăng nhập với các tài khoản trong phần 5.

#### B. Đăng ký tài khoản mới (Student)
1. Mở http://localhost:3000/register
2. Đăng ký với email mới
3. Đăng nhập
4. Chọn vai trò "Student"
5. Vào Student Dashboard

#### C. Đăng ký tài khoản Teacher
1. Đăng ký tài khoản mới
2. Chọn vai trò "Teacher"
3. Trạng thái: **Pending** (chờ duyệt)

#### D. Admin duyệt Teacher
1. Đăng nhập bằng admin:
   - Email: admin@edu.com
   - Password: Admin@123
2. Vào Admin Dashboard
3. Duyệt giáo viên trong danh sách chờ
4. Teacher có thể tạo live class

## Development Mode

### Run local (không dùng Docker)

#### Backend
```bash
cd server
npm install
npm run dev
```

#### Frontend
```bash
cd client
npm install
npm start
```

### Environment Variables

Tạo file `.env` trong thư mục gốc:

```env
# Database
MONGO_URI=mongodb://admin:admin123@localhost:27017/edu_ecosystem?authSource=admin

# JWT
JWT_ACCESS_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
ACCESS_EXPIRES=15m
REFRESH_EXPIRES=30d

# Admin
ADMIN_EMAIL=admin@edu.com
ADMIN_PASSWORD=Admin@123
```

## Stopping Services

```bash
# Stop all containers
docker-compose down

# Stop and remove volumes (xóa data)
docker-compose down -v
```

## Common Commands

```bash
# Rebuild specific service
docker-compose up --build server

# View logs of specific service
docker-compose logs -f client

# Restart service
docker-compose restart mongo

# Execute command in container
docker-compose exec server npm run seed
```

## Next Steps

1. ✅ Hệ thống đã sẵn sàng với Auth + RBAC
2. ⏭️ Tiếp theo: Implement file upload + AI generation
3. ⏭️ Sau đó: WebRTC cho live streaming
