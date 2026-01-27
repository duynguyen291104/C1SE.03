# 📚 INDEX - DANH MỤC TÀI LIỆU

## 🚀 Bắt đầu nhanh

| File | Mô tả | Dành cho |
|------|-------|----------|
| [DONE.md](DONE.md) | ✅ Tóm tắt hoàn thành | **ĐỌC ĐẦU TIÊN** |
| [QUICKSTART.md](QUICKSTART.md) | 🚀 Hướng dẫn sử dụng nhanh 5 phút | Người dùng cuối |
| [OPENAI_SETUP.md](OPENAI_SETUP.md) | 🔑 Hướng dẫn lấy & cài OpenAI API key | **BẮT BUỘC** |

## 📖 Tài liệu chi tiết

| File | Nội dung |
|------|----------|
| [README.md](README.md) | Hướng dẫn đầy đủ (cài đặt, sử dụng, config) |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Kiến trúc hệ thống, công nghệ, data flow |
| [SUMMARY.md](SUMMARY.md) | Tóm tắt dự án (tính năng, metrics, roadmap) |

## 🛠️ Files code chính

### Scripts chạy

| File | Mô tả | Cách chạy |
|------|-------|-----------|
| `main.py` | Pipeline chính: PDF → DOCX | `python main.py <pdf_file>` |
| `demo.py` | Demo không cần PDF | `python demo.py` |
| `install.sh` | Script cài đặt tự động | `./install.sh` |

### Source code (thư mục `src/`)

| File | Chức năng |
|------|-----------|
| `config.py` | Quản lý config & OpenAI API key |
| `pdf_parser.py` | Parse PDF (text + OCR) |
| `rag_indexer.py` | Chunking + FAISS RAG |
| `generators.py` | AI generators (Blueprint/Matrix/Questions) |
| `validator.py` | Validation chất lượng |
| `exporter.py` | Export DOCX |
| `models.py` | Pydantic schemas (Document, Blueprint, Exam...) |

## ⚙️ Files cấu hình

| File | Mô tả |
|------|-------|
| `config.example.json` | Config mẫu - Sao chép thành `config.json` |
| `requirements.txt` | Danh sách thư viện Python |
| `.gitignore` | Git ignore (không commit API key, outputs...) |

## 📁 Cấu trúc thư mục

```
ai-exam-generator/
├── 📄 main.py              # Pipeline chính
├── 🎯 demo.py              # Demo script
├── 🚀 install.sh           # Cài đặt tự động
├── ⚙️  config.example.json  # Config mẫu
├── 📦 requirements.txt     # Dependencies
│
├── 📖 DONE.md             # ✅ Tóm tắt hoàn thành
├── 🚀 QUICKSTART.md       # Hướng dẫn nhanh
├── 🔑 OPENAI_SETUP.md     # Setup API key
├── 📚 README.md           # Hướng dẫn đầy đủ
├── 🏗️  ARCHITECTURE.md     # Kiến trúc hệ thống
├── 📊 SUMMARY.md          # Tóm tắt dự án
│
├── 📁 src/                # Source code
│   ├── config.py
│   ├── pdf_parser.py
│   ├── rag_indexer.py
│   ├── generators.py
│   ├── validator.py
│   ├── exporter.py
│   └── models.py
│
├── 📁 uploads/            # Đặt PDF đề cương vào đây
├── 📁 outputs/            # Kết quả (DOCX, JSON...)
├── 📁 templates/          # Template DOCX (tuỳ chọn)
└── 📁 logs/               # Log files
```

## 🎯 Workflow sử dụng

### Lần đầu tiên

1. **Cài đặt**: Đọc [OPENAI_SETUP.md](OPENAI_SETUP.md) → Lấy API key
2. **Setup**: Chạy `./install.sh`
3. **Config**: Copy `config.example.json` → `config.json` và điền API key
4. **Test**: Chạy `python demo.py` để kiểm tra

### Sử dụng thường xuyên

1. Đặt PDF vào thư mục `uploads/`
2. Chạy: `python main.py uploads/de_cuong_toan_9.pdf`
3. Xem kết quả: `outputs/Toan_exam.docx`

## 🆘 Khi gặp vấn đề

| Vấn đề | Xem file |
|--------|----------|
| Không biết bắt đầu từ đâu | [DONE.md](DONE.md) |
| Chưa có OpenAI API key | [OPENAI_SETUP.md](OPENAI_SETUP.md) |
| Lỗi khi cài đặt | [QUICKSTART.md](QUICKSTART.md) - Phần "Xử lý lỗi" |
| Muốn hiểu hệ thống hoạt động | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Muốn tùy chỉnh config | [README.md](README.md) - Phần "Tùy chỉnh" |

## 📞 Liên hệ & Đóng góp

- Issues: Báo lỗi/góp ý
- Pull Requests: Đóng góp code
- Discussions: Thảo luận tính năng mới

## 📝 Ghi chú

- Tất cả tài liệu đều viết bằng **Tiếng Việt**
- Code có comment chi tiết
- Tuân thủ PEP 8 (Python style guide)
- Sử dụng Type Hints (Python 3.8+)

---

**Bắt đầu ngay**: [DONE.md](DONE.md) → [OPENAI_SETUP.md](OPENAI_SETUP.md) → `./install.sh` → `python demo.py`
