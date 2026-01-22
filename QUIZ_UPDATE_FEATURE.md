# Tính Năng Cập Nhật Quiz - Chỉ Dành Cho Giáo Viên

## ✅ Đã Hoàn Thành

### 🎯 Chức Năng Chính

1. **Chỉnh Sửa Quiz Đã Tạo**
   - Giáo viên có thể click nút "✏️ Sửa" trên bất kỳ quiz nào đã tạo
   - Form tự động điền đầy đủ thông tin quiz cần sửa
   - Tất cả câu hỏi và options được load lại

2. **Cập Nhật Và Lưu Vào Database**
   - Khi sửa xong, click "💾 Cập Nhật Quiz"
   - Dữ liệu được gửi qua API `PUT /api/quizzes/:id`
   - **Lưu vào MongoDB database** với tất cả thay đổi
   - Chỉ giáo viên sở hữu quiz mới có quyền sửa

3. **Bảo Mật**
   - Kiểm tra `teacherId` - chỉ teacher tạo quiz mới sửa được
   - Require token authentication
   - Middleware `requireApprovedTeacher` bảo vệ endpoint

---

## 📋 Luồng Hoạt Động

### Bước 1: Vào Trang Create Quiz
```
URL: http://localhost:3000/teacher/create-quiz
```

### Bước 2: Click Nút "✏️ Sửa" Trên Quiz
- Danh sách quiz hiển thị ở phía dưới
- Mỗi quiz card có nút "✏️ Sửa"
- Click vào quiz muốn chỉnh sửa

### Bước 3: Form Tự Động Điền Dữ Liệu
```javascript
// Dữ liệu được load từ API
GET /api/quizzes/:id

// Form điền tự động:
- Tiêu đề
- Mô tả
- Hướng dẫn
- Thời gian
- Điểm đạt
- Tags
- Tất cả câu hỏi và đáp án
```

### Bước 4: Chỉnh Sửa
- Sửa bất kỳ thông tin nào: tiêu đề, câu hỏi, đáp án...
- Thêm/xóa câu hỏi
- Thay đổi cài đặt quiz

### Bước 5: Click "💾 Cập Nhật Quiz"
```javascript
// API Call
PUT /api/quizzes/:id
Authorization: Bearer <token>

// Body gửi đi
{
  title: "...",
  description: "...",
  questions: [...],
  duration: 30,
  passingScore: 60,
  tags: [...],
  settings: {...}
}
```

### Bước 6: Lưu Vào Database
```javascript
// Backend Controller (quiz.controller.js)
exports.updateQuiz = async (req, res) => {
  // 1. Tìm quiz theo ID và teacherId
  const quiz = await Quiz.findOne({
    _id: req.params.id,
    teacherId: req.user._id  // Chỉ teacher sở hữu mới sửa được
  });
  
  // 2. Cập nhật các fields
  quiz.title = req.body.title;
  quiz.questions = req.body.questions;
  // ... các fields khác
  
  // 3. Lưu vào MongoDB
  await quiz.save();
  
  // 4. Ghi log audit
  await AuditLog.log({
    userId: req.user._id,
    action: 'UPDATE_QUIZ',
    metadata: { quizId: quiz._id }
  });
}
```

### Bước 7: Thông Báo Thành Công
- Hiển thị: "Cập nhật quiz thành công!"
- Form reset về chế độ tạo mới
- Danh sách quiz tự động refresh

---

## 🔒 Bảo Mật

### Kiểm Tra Quyền Sở Hữu
```javascript
// Chỉ teacher tạo quiz mới có thể sửa
const quiz = await Quiz.findOne({
  _id: req.params.id,
  teacherId: req.user._id  // ← Kiểm tra này
});

if (!quiz) {
  return res.status(404).json({
    success: false,
    message: 'Quiz not found'
  });
}
```

### Middleware Protection
```javascript
// Routes được bảo vệ
router.use(authMiddleware);           // Yêu cầu đăng nhập
router.use(requireApprovedTeacher);   // Yêu cầu là teacher được duyệt
router.put('/:id', quizController.updateQuiz);
```

---

## 📊 Database Schema

### Quiz Model
```javascript
{
  _id: ObjectId,
  teacherId: ObjectId,          // Chủ sở hữu quiz
  title: String,
  description: String,
  instructions: String,
  duration: Number,
  passingScore: Number,
  questions: [{
    order: Number,
    type: String,
    question: String,
    points: Number,
    options: [{
      text: String,
      isCorrect: Boolean
    }],
    explanation: String
  }],
  tags: [String],
  status: String,               // 'draft' | 'published'
  createdAt: Date,
  updatedAt: Date              // Tự động cập nhật khi save()
}
```

---

## 🎨 UI/UX Features

### Edit Mode Visual Indicators
- ✏️ Tiêu đề đổi: "Chỉnh Sửa Bài Kiểm Tra / Quiz"
- 🎨 Mô tả: "Chỉnh sửa và cập nhật bài kiểm tra"
- 🔵 Border màu xanh around form khi edit mode
- 💾 Nút submit đổi text: "Cập Nhật Quiz"
- ❌ Nút "Hủy Chỉnh Sửa" xuất hiện

### Nút Actions
```jsx
<div className="form-actions">
  {editMode && (
    <button onClick={cancelEdit} className="btn-secondary">
      ❌ Hủy Chỉnh Sửa
    </button>
  )}
  <button type="submit" className="btn-primary">
    {editMode ? '💾 Cập Nhật Quiz' : '💾 Lưu Quiz'}
  </button>
</div>
```

---

## 🧪 Test Cases

### Test 1: Load Quiz Để Sửa
```
✅ Click nút "✏️ Sửa"
✅ Form điền đúng dữ liệu
✅ Tất cả câu hỏi hiển thị
✅ Đáp án đúng được check
```

### Test 2: Cập Nhật Thành Công
```
✅ Sửa tiêu đề quiz
✅ Thêm câu hỏi mới
✅ Sửa đáp án
✅ Click "Cập Nhật Quiz"
✅ Thông báo success
✅ Database được update
✅ Danh sách quiz refresh
```

### Test 3: Hủy Chỉnh Sửa
```
✅ Click "Hủy Chỉnh Sửa"
✅ Form reset về rỗng
✅ Edit mode tắt
✅ Không có thay đổi trong database
```

### Test 4: Bảo Mật
```
✅ Teacher A không thể sửa quiz của Teacher B
✅ Phải đăng nhập mới sửa được
✅ Phải là approved teacher
```

---

## 🚀 Cách Sử Dụng

### Tạo Quiz Mới
1. Vào http://localhost:3000/teacher/create-quiz
2. Điền form và click "💾 Lưu Quiz"

### Sửa Quiz Đã Tạo
1. Scroll xuống "Quiz Đã Tạo"
2. Tìm quiz cần sửa
3. Click "✏️ Sửa"
4. Chỉnh sửa thông tin
5. Click "💾 Cập Nhật Quiz" → **LƯU VÀO DATABASE**

### Hủy Sửa
1. Khi đang ở edit mode
2. Click "❌ Hủy Chỉnh Sửa"
3. Form reset về chế độ tạo mới

---

## ✨ Tính Năng Đã Implement

✅ **Frontend (CreateQuiz.js)**
- State management cho edit mode
- Load quiz data từ API
- Update quiz qua PUT API
- Cancel edit functionality
- Visual indicators cho edit mode

✅ **Backend (quiz.controller.js)**
- Update quiz endpoint: `PUT /api/quizzes/:id`
- Ownership verification (teacherId check)
- Save to MongoDB database
- Audit logging

✅ **Security**
- Authentication required
- Teacher approval required
- Ownership verification
- Token-based auth

✅ **Database**
- MongoDB auto-update `updatedAt`
- All fields updatable
- Questions array fully editable

---

## 📝 Code Files Modified

1. `/client/src/pages/CreateQuiz.js`
   - Added edit mode state
   - Added loadQuizForEdit()
   - Updated handleSubmit()
   - Added cancelEdit()

2. `/client/src/pages/CreateQuiz.css`
   - Edit mode styling
   - Button styles

3. `/server/src/controllers/quiz.controller.js`
   - Already has updateQuiz() method ✅

4. `/server/src/routes/quiz.routes.js`
   - Already has PUT route ✅

---

## 🎉 HOÀN TẤT

Tính năng **Cập Nhật Quiz Chỉ Dành Cho Giáo Viên** đã được implement đầy đủ và **LƯU VÀO DATABASE** khi click cập nhật!

Application đang chạy tại:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5001/api

Vào http://localhost:3000/teacher/create-quiz để test ngay! 🚀
