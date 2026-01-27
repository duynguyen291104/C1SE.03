# Hệ thống Sinh Đề Kiểm Tra Tự Động từ PDF Đề Cương

Hệ thống AI tự động tạo đề kiểm tra từ file PDF đề cương/kế hoạch kiểm tra theo chuẩn **Công văn 7991**.

## ✨ Tính năng

- 📖 **Parse PDF**: Đọc PDF text-based hoặc OCR cho file scan
- 🧠 **Trích xuất Blueprint**: AI phân tích đề cương → chủ đề, outcomes, keywords
- 📊 **Sinh Ma trận**: Tạo ma trận đề theo CV 7991 (Phụ lục 1 + Bảng đặc tả)
- 📝 **Sinh Câu hỏi**: RAG-based question generation với truy vết nguồn
- ✅ **Validate**: Kiểm tra chất lượng, trùng lặp, tổng điểm
- 📄 **Xuất DOCX**: Xuất đề + đáp án + rubric theo format chuẩn

## 🚀 Cài đặt

### 1. Tạo môi trường ảo

```bash
cd ai-exam-generator
python -m venv venv
source venv/bin/activate  # Linux/Mac
# hoặc
venv\Scripts\activate  # Windows
```

### 2. Cài dependencies

```bash
pip install -r requirements.txt
```

### 3. Cấu hình OpenAI API Key

Sao chép file `.env.example` thành `.env`:

```bash
cp .env.example .env
```

Mở file `.env` và điền OpenAI API key của bạn:

```env
OPENAI_API_KEY=sk-your-actual-api-key-here
OPENAI_MODEL=gpt-4-turbo-preview
```

## 📖 Sử dụng

### Cách 1: Command Line Interface (CLI)

```bash
python -m src.main decuong.pdf --time 45 --points 10 --mcq-ratio 0.6
```

**Tham số:**

- `pdf_path`: Đường dẫn file PDF đề cương (bắt buộc)
- `-o, --output`: Tên file output (không cần .docx)
- `--time`: Thời gian làm bài (phút) - mặc định 45
- `--points`: Tổng điểm - mặc định 10
- `--mcq-ratio`: Tỷ lệ trắc nghiệm (0.0-1.0) - mặc định 0.6

**Ví dụ:**

```bash
# Sinh đề Toán 9, 60 phút, 70% trắc nghiệm
python -m src.main de_cuong_toan_9.pdf \
    --output de_toan_9_hk1 \
    --time 60 \
    --points 10 \
    --mcq-ratio 0.7

# Sử dụng file config JSON
python -m src.main de_cuong.pdf -c config.json
```

### Cách 2: Sử dụng trong Python code

```python
from src.main import ExamGeneratorApp

app = ExamGeneratorApp()

# Config tùy chỉnh
config = {
    'global': {
        'time_minutes': 45,
        'total_points': 10,
        'mcq_ratio': 0.6,
        'essay_ratio': 0.4
    },
    'cognitive': {
        'biet': 0.3,
        'hieu': 0.3,
        'vandung': 0.3,
        'vandungcao': 0.1
    },
    'difficulty': {
        'de': 0.3,
        'tb': 0.4,
        'kho': 0.3
    }
}

# Chạy
output_path = app.generate_exam(
    pdf_path='decuong.pdf',
    output_name='de_kiem_tra_toan_9',
    config=config
)

print(f"Đã xuất: {output_path}")
```

## 📁 Cấu trúc Project

```
ai-exam-generator/
├── src/
│   ├── __init__.py
│   ├── config.py           # Cấu hình app
│   ├── models.py           # Pydantic data models
│   ├── pdf_parser.py       # Parse PDF + OCR
│   ├── rag_indexer.py      # Chunking + RAG indexing
│   ├── generators.py       # Blueprint, Matrix, Question generators
│   ├── validator.py        # Validate chất lượng
│   ├── exporter.py         # Export DOCX
│   └── main.py             # Main application + CLI
├── exports/                # Thư mục output (tự tạo)
├── templates/              # DOCX templates (tuỳ chọn)
├── requirements.txt
├── .env.example
├── .env                    # Tạo từ .env.example
└── README.md
```

## 🔄 Quy trình hoàn chỉnh

```
PDF Đề cương
    ↓
[1] Parse PDF → document.json
    ↓
[2] Chunking → chunks.json
    ↓
[3] RAG Indexing (FAISS + OpenAI Embeddings)
    ↓
[4] AI Extract Blueprint → blueprint.json
    (Chương, chủ đề, outcomes, keywords)
    ↓
[5] AI Generate Matrix → matrix.json
    (Ma trận theo CV 7991: mức độ × độ khó × loại câu)
    ↓
[6] AI Generate Questions → exam.json
    (RAG: truy vết nguồn từ chunks)
    ↓
[7] Validate (rule-based + stats)
    ↓
[8] Export DOCX
    - Ma trận (Phụ lục 1)
    - Bảng đặc tả
    - Đề bài
    - Đáp án + Rubric
```

## 📊 Data Output

Hệ thống tạo ra các file JSON trung gian:

- `{doc_id}_document.json`: PDF đã parse
- `{doc_id}_chunks.json`: Text đã chia chunk
- `{doc_id}_blueprint.json`: Blueprint kiến thức
- `{doc_id}_matrix.json`: Ma trận đề
- `{doc_id}_exam.json`: Đề kiểm tra
- `{doc_id}_validation.json`: Kết quả validate
- `{output_name}.docx`: File đề cuối cùng

## 🔍 Ví dụ Output JSON

### Blueprint

```json
{
  "subject": "Toán",
  "grade": 9,
  "topics": [
    {
      "topic_id": "T1",
      "name": "Hệ phương trình bậc nhất",
      "outcomes": [
        {
          "outcome_id": "O1",
          "verb": "giải",
          "statement": "Giải hệ phương trình bằng phương pháp thế",
          "cognitive_level_hint": ["biet", "hieu"]
        }
      ],
      "keywords": ["phương pháp thế", "phương pháp cộng"]
    }
  ]
}
```

### Matrix Item

```json
{
  "row_id": "R1",
  "topic_id": "T1",
  "outcome_ids": ["O1"],
  "cognitive_level": "hieu",
  "difficulty": "tb",
  "type": "mcq_single",
  "n_questions": 2,
  "points_each": 0.25
}
```

### Question

```json
{
  "id": "Q1",
  "type": "mcq_single",
  "stem": "Hệ phương trình nào sau đây có nghiệm duy nhất?",
  "options": ["A. x + y = 1, x + y = 2", "B. x + y = 1, 2x + 2y = 2", "C. x + y = 1, x - y = 1", "D. x = 0, y = 0"],
  "answer": "C",
  "explanation": "Hệ có hệ số không tỷ lệ nên có nghiệm duy nhất",
  "source_trace": [{"chunk_id": "p3_c02", "page": 3}],
  "points": 0.25
}
```

## 🛠️ Tùy chỉnh

### Thay đổi prompt AI

Chỉnh sửa trong `src/generators.py`:

- `BlueprintGenerator._create_blueprint_prompt()`
- `MatrixGenerator._create_matrix_prompt()`
- `QuestionGenerator._create_question_prompt()`

### Thay đổi format DOCX

Chỉnh sửa `src/exporter.py`:

- Tạo template DOCX riêng theo mẫu CV 7991 của trường
- Truyền vào: `DOCXExporter(template_path='templates/cv7991.docx')`

### Thay đổi chunking strategy

Chỉnh sửa `src/rag_indexer.py`:

- `TextChunker._detect_sections()`: Pattern tìm tiêu đề
- `TextChunker._chunk_text()`: Sliding window size

## ⚠️ Lưu ý

1. **OpenAI API Cost**: Hệ thống dùng GPT-4 + Embeddings → có chi phí. Ước tính ~$0.5-2 cho 1 đề (tuỳ độ dài PDF)

2. **OCR**: Nếu PDF scan, cần cài `tesseract-ocr`:
   ```bash
   # Ubuntu/Debian
   sudo apt-get install tesseract-ocr tesseract-ocr-vie
   
   # macOS
   brew install tesseract tesseract-lang
   ```

3. **Validation**: Luôn kiểm tra lại đề sinh ra, đặc biệt:
   - Đáp án MCQ có đúng không
   - Tổng điểm = 10
   - Mức độ nhận thức có phù hợp không

4. **Source Trace**: Câu hỏi có `source_trace` → truy vết ngược về chunk/page trong PDF

## 📞 Hỗ trợ

Nếu gặp lỗi:

1. Kiểm tra `exam_generator.log`
2. Kiểm tra validation JSON: `{doc_id}_validation.json`
3. Xem các file JSON trung gian để debug từng bước

## 📝 License

MIT License - Sử dụng tự do cho mục đích giáo dục.
