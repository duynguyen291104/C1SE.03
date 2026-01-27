#!/bin/bash
# Script cài đặt nhanh cho AI Exam Generator

echo "🚀 Bắt đầu cài đặt AI Exam Generator..."
echo ""

# 1. Kiểm tra Python
echo "📋 Kiểm tra Python..."
if ! command -v python3 &> /dev/null; then
    echo "❌ Chưa cài Python 3. Vui lòng cài Python 3.8+"
    exit 1
fi
PYTHON_VERSION=$(python3 --version)
echo "✓ $PYTHON_VERSION"
echo ""

# 2. Tạo virtual environment
echo "📦 Tạo virtual environment..."
python3 -m venv venv
echo "✓ Đã tạo venv"
echo ""

# 3. Kích hoạt venv
echo "🔄 Kích hoạt virtual environment..."
source venv/bin/activate
echo "✓ Đã kích hoạt venv"
echo ""

# 4. Upgrade pip
echo "⬆️  Upgrade pip..."
pip install --upgrade pip
echo ""

# 5. Cài đặt dependencies
echo "📚 Cài đặt thư viện Python..."
pip install -r requirements.txt
echo "✓ Đã cài đặt thư viện"
echo ""

# 6. Tạo thư mục cần thiết
echo "📁 Tạo thư mục..."
mkdir -p uploads outputs templates logs
echo "✓ Đã tạo thư mục: uploads, outputs, templates, logs"
echo ""

# 7. Copy config example
if [ ! -f "config.json" ]; then
    echo "📝 Tạo file config.json..."
    cp config.example.json config.json
    echo "✓ Đã tạo config.json"
    echo ""
    echo "⚠️  LƯU Ý: Hãy mở config.json và điền OpenAI API key!"
    echo "   Lấy API key tại: https://platform.openai.com/api-keys"
else
    echo "ℹ️  File config.json đã tồn tại"
fi
echo ""

# 8. Kiểm tra Tesseract (cho OCR)
echo "🔍 Kiểm tra Tesseract OCR..."
if command -v tesseract &> /dev/null; then
    TESSERACT_VERSION=$(tesseract --version | head -1)
    echo "✓ $TESSERACT_VERSION"
else
    echo "⚠️  Chưa cài Tesseract OCR (cần cho PDF scan)"
    echo "   Ubuntu/Debian: sudo apt-get install tesseract-ocr tesseract-ocr-vie"
    echo "   MacOS: brew install tesseract tesseract-lang"
fi
echo ""

# 9. Hoàn thành
echo "=" "=" "=" "=" "=" "=" "=" "=" "=" "="
echo "✅ CÀI ĐẶT HOÀN TẤT!"
echo "=" "=" "=" "=" "=" "=" "=" "=" "=" "="
echo ""
echo "📋 BƯỚC TIẾP THEO:"
echo "   1. Mở file config.json"
echo "   2. Điền OpenAI API key vào openai.api_key"
echo "   3. Chạy: python main.py <pdf_file>"
echo ""
echo "Ví dụ:"
echo "   python main.py uploads/de_cuong_toan_9.pdf"
echo ""
echo "📖 Xem thêm tại README.md"
echo ""
