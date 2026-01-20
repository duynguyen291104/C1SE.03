# 🎓 C1SE.03 - Edu Ecosystem Platform

Nền tảng giáo dục toàn diện cho giáo viên và học sinh với tính năng quản lý khóa học, tài liệu, và học tập trực tuyến.

## ✨ Tính năng chính

- 🔐 **Authentication & RBAC**: Hệ thống đăng nhập với 3 vai trò (Admin, Teacher, Student)
- 👨‍🏫 **Teacher Management**: Duyệt giáo viên, quản lý quyền hạn
- 📚 **Document Management**: Upload, trích xuất text từ PDF/DOCX/PPTX
- 🔄 **Queue Processing**: BullMQ worker xử lý bất đồng bộ
- 🗄️ **Object Storage**: MinIO lưu trữ file
- 🔒 **Security**: Rate limiting, input validation, audit logging, password policy
- 🐳 **Docker Ready**: Triển khai dễ dàng với Docker Compose

## 🚀 Khởi động nhanh

```bash
# Clone và vào thư mục
cd /home/ngocduy/duy/C1SE.03

# Khởi động tất cả services
chmod +x start.sh && ./start.sh

# Hoặc thủ công:
sudo docker compose up -d
```

**Truy cập:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5001/api
- MinIO Console: http://localhost:9001 (admin / admin123)

## 👤 Tài khoản Demo

| Role | Email | Password |
|------|-------|----------|
| 👨‍💼 Admin | admin@edu.com | Admin@123 |
| 👨‍🏫 Teacher | teacher@edu.com | Teacher@123 |
| 👨‍🎓 Student | student@edu.com | Student@123 |

📖 Chi tiết: [DEMO_ACCOUNTS.md](./DEMO_ACCOUNTS.md)

## 🧪 Test API

```bash
# Test login
chmod +x test-accounts.sh && ./test-accounts.sh

# Hoặc manual:
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@edu.com","password":"Teacher@123"}'
```

## 📁 Cấu trúc dự án

```
C1SE.03/
├── server/              # Backend (Node.js + Express)
│   ├── src/
│   │   ├── models/      # Mongoose schemas
│   │   ├── controllers/ # Business logic
│   │   ├── routes/      # API endpoints
│   │   ├── middleware/  # Auth, validation
│   │   ├── services/    # External services (MinIO, etc)
│   │   ├── queues/      # BullMQ queues
│   │   └── worker.js    # Background job processor
│   └── Dockerfile
├── client/              # Frontend (React)
│   └── Dockerfile
├── docker-compose.yml   # Services orchestration
├── DEMO_ACCOUNTS.md     # Danh sách tài khoản demo
├── QUICKSTART.md        # Hướng dẫn chi tiết
└── start.sh            # Script khởi động nhanh
```

## 🛠️ Tech Stack

**Backend:**
- Node.js 18 + Express.js
- MongoDB 7.0 (Mongoose ODM)
- Redis 7 (BullMQ queues)
- MinIO (S3-compatible storage)
- JWT authentication
- bcryptjs, express-validator, helmet

**Frontend:**
- React 18
- React Router v6
- Axios
- CSS Modules

**DevOps:**
- Docker & Docker Compose
- Health checks & auto-restart
- Volume persistence

## 📚 Tài liệu

- [Quick Start Guide](./QUICKSTART.md) - Hướng dẫn nhanh
- [Demo Accounts](./DEMO_ACCOUNTS.md) - Tài khoản demo
- [Teacher API Documentation](./API_TEACHER.md) - API cho giáo viên
- [API Documentation](./API.md) - API endpoints (sắp có)

## 🔧 Development

### Yêu cầu
- Docker & Docker Compose
- Node.js 18+ (nếu chạy local)
- MongoDB (nếu chạy local)

### Chạy local không dùng Docker

```bash
# Backend
cd server
npm install
npm run dev

# Frontend
cd client
npm install
npm start
```

### Xem logs

```bash
# Tất cả services
sudo docker compose logs -f

# Specific service
sudo docker logs edu-server -f
sudo docker logs edu-worker -f
```

### Rebuild sau khi thay đổi code

```bash
sudo docker compose down
sudo docker compose up -d --build
```

## 📋 Roadmap

- [x] Phase 0: Authentication & RBAC
  - [x] JWT auth với access/refresh tokens
  - [x] 3 roles: Admin, Teacher, Student
  - [x] Teacher approval workflow
  - [x] Security: rate limiting, validation, audit logs
  
- [x] Phase 1: Document Management (In Progress)
  - [x] Upload documents (PDF, DOCX, PPTX)
  - [x] Background text extraction worker
  - [x] MinIO storage integration
  - [ ] Frontend upload UI
  - [ ] Document viewer

- [x] Phase 2: Teacher Features (Completed)
  - [x] Create Slides/Presentations
  - [x] Create Quizzes/Tests
  - [x] Create Live Classes
  - [x] Materials Management
  - [x] Teacher Dashboard
  
- [ ] Phase 3: Course Management
  - [ ] Create/edit courses
  - [ ] Enroll students
  - [ ] Course materials
  
- [ ] Phase 3: Assessment
  - [ ] Create tests/quizzes
  - [ ] Auto grading
  - [ ] Gradebook
  
- [ ] Phase 4: Live Streaming
  - [ ] WebRTC integration
  - [ ] Live classes
  - [ ] Recording

## 🤝 Contributing

Pull requests are welcome! Vui lòng tạo issue trước khi làm feature lớn.

## 📄 License

MIT License - Xem [LICENSE](./LICENSE) để biết thêm chi tiết.

---

**Built with ❤️ for education**
