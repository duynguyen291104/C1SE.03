# API Documentation - Teacher Features

## Base URL
```
http://localhost:5001/api
```

## Authentication
All endpoints require Bearer token authentication:
```
Authorization: Bearer <access_token>
```

---

## 📊 Slides API

### Create Slide
```http
POST /slides
Content-Type: application/json

{
  "title": "Bài giảng Toán học",
  "description": "Chương 1: Hàm số",
  "slides": [
    {
      "order": 1,
      "type": "title",
      "title": "Giới thiệu Hàm số",
      "content": "Nội dung chi tiết...",
      "backgroundColor": "#ffffff",
      "textColor": "#000000",
      "layout": "single"
    }
  ],
  "tags": ["toán", "hàm số", "lớp 10"],
  "status": "draft"
}
```

### Get All Slides
```http
GET /slides?status=published&page=1&limit=20
```

### Get Single Slide
```http
GET /slides/:id
```

### Update Slide
```http
PUT /slides/:id
Content-Type: application/json

{
  "title": "Updated title",
  "slides": [...],
  "status": "published"
}
```

### Publish Slide
```http
POST /slides/:id/publish
```

### Duplicate Slide
```http
POST /slides/:id/duplicate
```

### Delete Slide
```http
DELETE /slides/:id
```

---

## 📝 Quizzes API

### Create Quiz
```http
POST /quizzes
Content-Type: application/json

{
  "title": "Kiểm tra Toán học",
  "description": "Bài kiểm tra chương 1",
  "duration": 30,
  "passingScore": 60,
  "questions": [
    {
      "order": 1,
      "type": "multiple-choice",
      "question": "1 + 1 = ?",
      "points": 1,
      "options": [
        { "text": "1", "isCorrect": false },
        { "text": "2", "isCorrect": true },
        { "text": "3", "isCorrect": false },
        { "text": "4", "isCorrect": false }
      ],
      "explanation": "1 + 1 bằng 2"
    }
  ],
  "settings": {
    "shuffleQuestions": false,
    "shuffleOptions": false,
    "showCorrectAnswers": true,
    "maxAttempts": 3
  }
}
```

### Get All Quizzes
```http
GET /quizzes?status=published&page=1&limit=20
```

### Get Single Quiz
```http
GET /quizzes/:id
```

### Update Quiz
```http
PUT /quizzes/:id
```

### Publish Quiz
```http
POST /quizzes/:id/publish
```

### Delete Quiz
```http
DELETE /quizzes/:id
```

---

## 📹 Live Classes API

### Create Live Class
```http
POST /live-classes
Content-Type: application/json

{
  "title": "Học trực tuyến Toán",
  "description": "Buổi học chương 1",
  "scheduledStart": "2026-01-25T14:00:00Z",
  "scheduledEnd": "2026-01-25T15:30:00Z",
  "maxParticipants": 100,
  "settings": {
    "allowChat": true,
    "allowQuestions": true,
    "recordSession": true,
    "waitingRoom": false,
    "muteOnEntry": true
  }
}
```

### Get All Live Classes
```http
GET /live-classes?status=scheduled&page=1&limit=20
```

### Get Single Live Class
```http
GET /live-classes/:id
```

### Update Live Class
```http
PUT /live-classes/:id
```

### Start Live Class
```http
POST /live-classes/:id/start
```

### End Live Class
```http
POST /live-classes/:id/end
```

### Cancel Live Class
```http
POST /live-classes/:id/cancel
```

### Delete Live Class
```http
DELETE /live-classes/:id
```

---

## 📚 Materials API

### Upload Material
```http
POST /materials
Content-Type: multipart/form-data

{
  "title": "Tài liệu chương 1",
  "description": "Tài liệu học tập",
  "type": "document",
  "category": "lecture",
  "access": "course-only",
  "downloadable": true,
  "file": <binary>,
  "tags": ["toán", "chương 1"]
}
```

### Get All Materials
```http
GET /materials?type=document&category=lecture&page=1&limit=20
```

### Get Single Material
```http
GET /materials/:id
```

### Update Material
```http
PUT /materials/:id
Content-Type: multipart/form-data
```

### Publish Material
```http
POST /materials/:id/publish
```

### Get Download URL
```http
GET /materials/:id/download

Response:
{
  "success": true,
  "data": {
    "downloadUrl": "https://minio:9000/...",
    "fileName": "document.pdf",
    "expiresIn": 3600
  }
}
```

### Reorder Materials
```http
POST /materials/reorder
Content-Type: application/json

{
  "materials": [
    { "id": "material1_id", "order": 1 },
    { "id": "material2_id", "order": 2 }
  ]
}
```

### Delete Material
```http
DELETE /materials/:id
```

---

## Data Types

### Slide Types
- `title` - Slide tiêu đề
- `content` - Slide nội dung
- `image` - Slide hình ảnh
- `video` - Slide video
- `code` - Slide code

### Question Types
- `multiple-choice` - Trắc nghiệm
- `true-false` - Đúng/Sai
- `short-answer` - Tự luận ngắn
- `essay` - Tự luận dài
- `matching` - Nối câu
- `fill-blank` - Điền vào chỗ trống

### Material Types
- `document` - Tài liệu
- `video` - Video
- `audio` - Audio
- `image` - Hình ảnh
- `link` - Liên kết
- `slide` - Bài giảng slide
- `quiz` - Quiz
- `assignment` - Bài tập

### Access Levels
- `public` - Công khai
- `course-only` - Chỉ trong khóa học
- `private` - Riêng tư

### Status
- `draft` - Bản nháp
- `published` - Đã xuất bản
- `archived` - Đã lưu trữ

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation error message"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Unauthorized"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Teacher approval required"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Resource not found"
}
```

### 500 Server Error
```json
{
  "success": false,
  "message": "Internal server error"
}
```

---

## Testing with curl

### Login and get token
```bash
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@edu.com","password":"Teacher@123"}'
```

### Create a slide
```bash
TOKEN="your_access_token_here"

curl -X POST http://localhost:5001/api/slides \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Slide",
    "description": "Test description",
    "slides": [{
      "order": 1,
      "type": "title",
      "title": "Welcome",
      "content": "Hello World"
    }]
  }'
```

### Upload material
```bash
curl -X POST http://localhost:5001/api/materials \
  -H "Authorization: Bearer $TOKEN" \
  -F "title=Test Document" \
  -F "type=document" \
  -F "category=lecture" \
  -F "file=@/path/to/document.pdf"
```
