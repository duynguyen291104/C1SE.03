# 🚀 HƯỚNG DẪN SỬ DỤNG NHANH

## Cài đặt (1 lần duy nhất)

### Cách 1: Tự động (Linux/Mac)
```bash
./install.sh
```

### Cách 2: Thủ công
```bash
# 1. Tạo virtual environment
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# hoặc: venv\Scripts\activate  # Windows

# 2. Cài đặt thư viện
pip install -r requirements.txt

# 3. Tạo file config
cp config.example.json config.json

# 4. Mở config.json và điền OpenAI API key
nano config.json
```

## Cấu hình OpenAI API Key

1. Lấy API key tại: https://platform.openai.com/api-keys
2. Mở file `config.json`
3. Tìm dòng:
   ```json
   "api_key": "your-openai-api-key-here",
   ```
4. Thay bằng key của bạn:
   ```json
   "api_key": "sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
   ```
5. Lưu file

## Chạy hệ thống

```bash
# Kích hoạt virtual environment (nếu chưa)
source venv/bin/activate

# Chạy pipeline
python main.py <file_pdf_de_cuong>
```

**Ví dụ:**
```bash
python main.py uploads/de_cuong_toan_9.pdf
python main.py uploads/ke_hoach_kiem_tra_van_11.pdf
```

## Kết quả

Hệ thống sẽ tạo ra các file trong thư mục `outputs/`:

```
outputs/
├── document.json          # PDF đã parse
├── blueprint.json        # Cấu trúc kiến thức
├── matrix.json          # Ma trận đề
├── exam.json           # Đề thi (JSON)
├── validation.json    # Kết quả kiểm tra
└── Toan_exam.docx    # ⭐ ĐỀ THI DOCX (file chính)
```

## Tùy chỉnh đề

Chỉnh sửa file `config.json`:

### Thay đổi thời gian và điểm
```json
{
  "exam_config": {
    "global": {
      "time_minutes": 60,      // Thời gian làm bài
      "total_points": 10.0,    // Tổng điểm
      "mcq_ratio": 0.7,        // 70% trắc nghiệm
      "essay_ratio": 0.3       // 30% tự luận
    }
  }
}
```

### Thay đổi tỷ lệ mức độ
```json
{
  "exam_config": {
    "cognitive": {
      "biet": 0.25,           // 25% Biết
      "hieu": 0.35,           // 35% Hiểu
      "vandung": 0.30,        // 30% Vận dụng
      "vandungcao": 0.10      // 10% Vận dụng cao
    }
  }
}
```

### Thay đổi độ khó
```json
{
  "exam_config": {
    "difficulty": {
      "de": 0.25,     // 25% Dễ
      "tb": 0.50,     // 50% Trung bình
      "kho": 0.25     // 25% Khó
    }
  }
}
```

## Xử lý lỗi

### Lỗi: "OpenAI API key not found"
➜ Chưa điền API key vào `config.json`

### Lỗi: "Tesseract not found"
➜ Cài Tesseract OCR (cho PDF scan):
```bash
# Ubuntu/Debian
sudo apt-get install tesseract-ocr tesseract-ocr-vie

# MacOS
brew install tesseract tesseract-lang
```

### Lỗi: "No module named 'xxx'"
➜ Chưa cài đủ thư viện:
```bash
pip install -r requirements.txt
```

## Lưu ý quan trọng

⚠️ **Giáo viên vẫn cần kiểm tra đề**: Hệ thống là công cụ hỗ trợ, không thay thế hoàn toàn công việc của giáo viên.

✅ **Kiểm tra trước khi dùng**:
- Đọc lại các câu hỏi
- Kiểm tra đáp án
- Xem file `validation.json` để biết các vấn đề cần sửa

## Hỗ trợ

Xem hướng dẫn chi tiết: [README.md](README.md)
