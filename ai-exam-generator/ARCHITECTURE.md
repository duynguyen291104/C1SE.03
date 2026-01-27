# 🛠️ CÔNG NGHỆ VÀ KIẾN TRÚC HỆ THỐNG

## Stack công nghệ

### 1. PDF Processing
- **pdfplumber** (0.11.0) - Parse PDF text-based, trích xuất text và table
- **PyMuPDF/fitz** (1.24.0) - Render PDF thành image với độ phân giải cao
- **pytesseract** (0.3.10) - OCR engine wrapper cho Tesseract
- **opencv-python** (4.9.0) - Tiền xử lý ảnh trước khi OCR (threshold, denoise)
- **Pillow** (10.2.0) - Xử lý image

### 2. AI & Embeddings
- **openai** (1.12.0) - OpenAI API client
  - Model: GPT-4 Turbo (sinh blueprint, matrix, questions)
  - Embeddings: text-embedding-3-small (vector hoá text)
- **faiss-cpu** (1.8.0) - Vector similarity search (FAISS index)
- **tiktoken** (0.6.0) - Token counting cho OpenAI

### 3. Data Validation & Schema
- **pydantic** (2.6.1) - Data validation và schema definition
  - Đảm bảo output JSON đúng format
  - Type checking runtime
- **python-dotenv** (1.0.1) - Load config từ file

### 4. Document Export
- **python-docx** (1.1.0) - Tạo file DOCX (ma trận, đề, đáp án)
- **lxml** (5.1.0) - XML processing (dùng bởi python-docx)

### 5. Text Processing
- **nltk** (3.8.1) - Natural Language Toolkit (tokenization, sentence splitting)
- **regex** (2023.12.25) - Advanced regex patterns
- **rapidfuzz** (3.6.1) - Fast string similarity (phát hiện câu trùng lặp)

### 6. Utilities
- **numpy** (1.26.4) - Array operations (cho FAISS)
- **pandas** (2.2.0) - Data manipulation (nếu cần)
- **tqdm** (4.66.1) - Progress bars
- **loguru** (0.7.2) - Advanced logging với colors

## Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────────────┐
│                        AI EXAM GENERATOR                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────┐
│  PDF Input  │
│  (Đề cương) │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. PDF PARSER (pdf_parser.py)                                  │
│  • pdfplumber: Extract text                                     │
│  • PyMuPDF: Render to image (300 DPI)                           │
│  • Tesseract OCR: Scan → Text                                   │
│  • OpenCV: Image preprocessing                                  │
│  Output: Document (pages, text, metadata)                       │
└──────┬──────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. TEXT CHUNKING (rag_indexer.py)                              │
│  • Detect sections (CHƯƠNG, BÀI, MỤC)                           │
│  • Sliding window chunking (1000 chars, overlap 200)            │
│  • Preserve metadata (page, section, char_range)                │
│  Output: List[Chunk]                                            │
└──────┬──────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. RAG INDEXER (rag_indexer.py)                                │
│  • OpenAI Embeddings API (text-embedding-3-small)               │
│  • FAISS IndexFlatL2 (L2 distance)                              │
│  • Store: index.faiss + chunks_meta.pkl                         │
│  Output: RAGIndexer (searchable)                                │
└──────┬──────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. BLUEPRINT GENERATOR (generators.py)                         │
│  • Prompt: Phân tích đề cương → topics + outcomes               │
│  • OpenAI GPT-4 Turbo (JSON mode)                               │
│  • Pydantic validation (Blueprint schema)                       │
│  Output: Blueprint                                              │
└──────┬──────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. MATRIX GENERATOR (generators.py)                            │
│  • Input: Blueprint + Config (tỷ lệ TN/TL, mức độ, độ khó)     │
│  • OpenAI GPT-4 Turbo (JSON mode)                               │
│  • Validation: Tổng điểm = 10, tỷ lệ gần đúng                   │
│  Output: ExamMatrix (items_plan)                                │
└──────┬──────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. QUESTION GENERATOR (generators.py)                          │
│  • For each row in matrix:                                      │
│    1. RAG.search(topic + outcomes) → top-k chunks               │
│    2. Prompt + context chunks → OpenAI                          │
│    3. Generate N questions                                      │
│  • Pydantic validation (Question schema)                        │
│  • Attach source_trace (chunk_id, page)                         │
│  Output: Exam (questions list)                                  │
└──────┬──────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  7. VALIDATOR (validator.py)                                    │
│  • Rule-based checks:                                           │
│    - MCQ có đúng 1 đáp án?                                      │
│    - Tổng điểm = 10?                                            │
│    - Câu hỏi đủ dài?                                            │
│  • Duplicate detection (rapidfuzz similarity)                   │
│  • AI-based quality check (optional)                            │
│  Output: ValidationResult (is_valid, issues)                    │
└──────┬──────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  8. DOCX EXPORTER (exporter.py)                                 │
│  • python-docx: Generate DOCX                                   │
│  • Sections:                                                    │
│    - Header (school, subject, time)                             │
│    - Ma trận (Phụ lục 1) - Table                                │
│    - Bảng đặc tả - Table                                        │
│    - Đề thi (questions)                                         │
│    - Đáp án + Rubric (answer key)                               │
│  Output: exam.docx                                              │
└──────┬──────────────────────────────────────────────────────────┘
       │
       ▼
  ┌────────┐
  │ OUTPUT │
  │  DOCX  │
  └────────┘
```

## Data Models (Pydantic Schemas)

### Document
```python
class Document(BaseModel):
    doc_id: str
    file_name: str
    metadata: DocumentMetadata
    pages: List[DocumentPage]
```

### Chunk
```python
class Chunk(BaseModel):
    chunk_id: str
    page: int
    section: Optional[str]
    text: str
    char_start: int
    char_end: int
    embedding: Optional[List[float]]
```

### Blueprint
```python
class Blueprint(BaseModel):
    subject: str
    grade: Optional[int]
    topics: List[Topic]

class Topic(BaseModel):
    topic_id: str
    name: str
    outcomes: List[LearningOutcome]
    keywords: List[str]
```

### ExamMatrix
```python
class ExamMatrix(BaseModel):
    global_config: GlobalConfig
    cognitive_ratios: CognitiveRatios
    difficulty_ratios: DifficultyRatios
    items_plan: List[MatrixItem]

class MatrixItem(BaseModel):
    row_id: str
    topic_id: str
    outcome_ids: List[str]
    cognitive_level: Literal["biet", "hieu", "vandung", "vandungcao"]
    difficulty: Literal["de", "tb", "kho"]
    type: Literal["mcq_single", "mcq_multiple", "essay", ...]
    n_questions: int
    points_each: float
```

### Exam
```python
class Exam(BaseModel):
    title: str
    subject: str
    grade: Optional[int]
    time_minutes: int
    total_points: float
    questions: List[Question]

class Question(BaseModel):
    id: str
    type: str
    stem: str
    options: List[str]  # For MCQ
    answer: str
    explanation: str
    points: float
    rubric: Optional[QuestionRubric]  # For essay
    source_trace: List[SourceTrace]  # Traceability
```

## Traceability (Minh bạch)

Mỗi câu hỏi có **source_trace**:

```python
class SourceTrace(BaseModel):
    chunk_id: str  # ID của chunk (vd: "p2_c003")
    page: int      # Trang trong PDF
    section: Optional[str]  # Tên section (vd: "CHƯƠNG 1")
```

→ Giáo viên có thể xác minh câu hỏi dựa vào:
- Trang nào trong PDF?
- Đoạn nào (chunk)?
- Section nào?

## Performance & Scalability

### Token Usage (OpenAI)
- **Blueprint**: ~2K tokens input → 1K output
- **Matrix**: ~3K tokens input → 1K output
- **Question** (mỗi câu): ~2K tokens input → 0.5K output

**Ước tính cost** (1 đề 20 câu):
- Blueprint: $0.01
- Matrix: $0.02
- Questions (20 câu): $0.40
- **Total**: ~$0.43/đề (GPT-4 Turbo)

### Tốc độ
- Parse PDF: ~2s
- Chunking + Embedding: ~10s (50 chunks)
- Blueprint: ~5s
- Matrix: ~8s
- Questions (20 câu): ~60s (3s/câu)
- Export DOCX: ~2s
- **Total**: ~90s/đề

### Caching & Optimization
- Cache embeddings (lưu FAISS index)
- Batch embedding requests
- Parallel question generation (có thể)

## Security & Privacy

✅ **Data không rời máy** (ngoại trừ gửi OpenAI):
- PDF parse local
- Chunking local
- FAISS index local
- Output local

⚠️ **Dữ liệu gửi OpenAI**:
- Text chunks (để embedding)
- Blueprint/Matrix prompts
- Question generation prompts

→ Không nên dùng cho nội dung **tuyệt mật**

## Khả năng mở rộng

### Thay thế OpenAI
- Có thể dùng: Gemini, Claude, LLaMA (local)
- Chỉ cần thay `openai` client trong `generators.py`

### Thêm loại câu hỏi
- Thêm type mới vào `QuestionType` enum
- Thêm prompt template trong `QuestionGenerator`
- Thêm validation rules

### Multi-language
- Thêm language parameter
- Thay prompt (tiếng Anh, tiếng Việt, ...)
- OCR language config

## Maintenance

### Logs
- File logs: `logs/exam_generator_*.log`
- Rotation: 1 ngày
- Retention: 7 ngày

### Monitoring
- Token usage tracking
- Error tracking (Sentry có thể tích hợp)
- Performance metrics

## Tài liệu tham khảo

### API Docs
- **OpenAI**: https://platform.openai.com/docs
- **FAISS**: https://github.com/facebookresearch/faiss
- **python-docx**: https://python-docx.readthedocs.io

### Quy định giáo dục VN
- **Thông tư 22/2021/TT-BGDĐT**
- **Công văn 7991/BGDĐT-GDTrH**
- **Bloom's Taxonomy** (revised)
