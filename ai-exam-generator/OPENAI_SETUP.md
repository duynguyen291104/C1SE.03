# 🔑 HƯỚNG DẪN LẤY VÀ CÀI ĐẶT OPENAI API KEY

## Bước 1: Tạo tài khoản OpenAI

1. Truy cập: https://platform.openai.com/
2. Click **Sign Up** (hoặc **Log In** nếu đã có tài khoản)
3. Đăng ký bằng email hoặc Google/Microsoft account

## Bước 2: Nạp tiền (Credits)

⚠️ **OpenAI API không miễn phí**. Bạn cần nạp tiền trước khi sử dụng.

1. Vào: https://platform.openai.com/account/billing
2. Click **Add payment method**
3. Nhập thông tin thẻ (Visa/Mastercard)
4. Nạp ít nhất $5 (khuyến nghị: $10-20 để dùng lâu)

**Chi phí ước tính**:
- 1 đề thi (20 câu): ~$0.43
- $10 → ~23 đề thi
- $20 → ~46 đề thi

## Bước 3: Tạo API Key

1. Truy cập: https://platform.openai.com/api-keys
2. Click **+ Create new secret key**
3. Đặt tên (VD: "AI Exam Generator")
4. Click **Create secret key**
5. **QUAN TRỌNG**: Copy key ngay (chỉ hiện 1 lần!)
   ```
   sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
6. Lưu key vào nơi an toàn

## Bước 4: Cài đặt API Key vào hệ thống

### Cách 1: Qua file config (Khuyến nghị)

```bash
# 1. Sao chép file mẫu
cd ai-exam-generator
cp config.example.json config.json

# 2. Mở file bằng editor
nano config.json
# Hoặc: code config.json (VS Code)
# Hoặc: gedit config.json (GUI)
```

**3. Tìm dòng này:**
```json
{
  "openai": {
    "api_key": "your-openai-api-key-here",
    ...
  }
}
```

**4. Thay bằng key của bạn:**
```json
{
  "openai": {
    "api_key": "sk-proj-ABCxyz123...",
    ...
  }
}
```

**5. Lưu file** (Ctrl+S)

### Cách 2: Qua biến môi trường

```bash
# Linux/Mac (tạm thời - session hiện tại)
export OPENAI_API_KEY="sk-proj-ABCxyz123..."

# Linux/Mac (vĩnh viễn - thêm vào ~/.bashrc)
echo 'export OPENAI_API_KEY="sk-proj-ABCxyz123..."' >> ~/.bashrc
source ~/.bashrc

# Windows (Command Prompt)
setx OPENAI_API_KEY "sk-proj-ABCxyz123..."

# Windows (PowerShell)
$env:OPENAI_API_KEY = "sk-proj-ABCxyz123..."
```

## Bước 5: Kiểm tra API Key

```bash
# Kích hoạt virtual environment
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# Chạy demo để test
python demo.py
```

**Nếu thấy:**
```
🚀 BẮT ĐẦU PIPELINE SINH ĐỀ KIỂM TRA
📋 BƯỚC 1: Load cấu hình
   ✓ Model: gpt-4-turbo-preview
```
→ ✅ **API key đã hoạt động!**

**Nếu thấy lỗi:**
```
❌ Chưa cấu hình OpenAI API key!
```
→ Quay lại Bước 4 và kiểm tra lại

## Xử lý lỗi thường gặp

### Lỗi: "Incorrect API key provided"
➜ API key sai hoặc đã bị thu hồi. Tạo key mới tại: https://platform.openai.com/api-keys

### Lỗi: "You exceeded your current quota"
➜ Hết tiền. Nạp thêm credits tại: https://platform.openai.com/account/billing

### Lỗi: "Rate limit exceeded"
➜ Gọi API quá nhanh. Đợi 1 phút rồi thử lại.

### Lỗi: "Model not found"
➜ Tài khoản chưa có quyền dùng GPT-4. Đổi sang GPT-3.5:
```json
{
  "openai": {
    "model": "gpt-3.5-turbo",  // Thay vì gpt-4-turbo-preview
    ...
  }
}
```

## Bảo mật API Key

⚠️ **TUYỆT ĐỐI KHÔNG**:
- Commit file `config.json` lên GitHub/GitLab
- Chia sẻ API key công khai
- Hard-code key trong code

✅ **NÊN**:
- Lưu key trong file `config.json` (đã có trong `.gitignore`)
- Hoặc dùng biến môi trường
- Giữ key bí mật

## Theo dõi chi phí

1. Vào: https://platform.openai.com/usage
2. Xem chi tiêu theo ngày/tháng
3. Set usage limit để tránh chi quá nhiều:
   - Vào: https://platform.openai.com/account/limits
   - Set hard limit (VD: $20/tháng)

## Giá cả OpenAI (tháng 1/2025)

| Model | Input | Output |
|-------|-------|--------|
| GPT-4 Turbo | $0.01/1K tokens | $0.03/1K tokens |
| GPT-3.5 Turbo | $0.0005/1K tokens | $0.0015/1K tokens |
| Embeddings (text-embedding-3-small) | $0.00002/1K tokens | - |

**Ví dụ 1 đề thi (20 câu)**:
- GPT-4 Turbo: ~$0.43
- GPT-3.5 Turbo: ~$0.02

→ GPT-3.5 rẻ hơn 20 lần nhưng chất lượng kém hơn

## Lựa chọn Model

### GPT-4 Turbo (Khuyến nghị cho production)
```json
{
  "openai": {
    "model": "gpt-4-turbo-preview",
    ...
  }
}
```
- ✅ Chất lượng cao
- ✅ Ít lỗi
- ❌ Đắt (~$0.43/đề)

### GPT-3.5 Turbo (Tiết kiệm)
```json
{
  "openai": {
    "model": "gpt-3.5-turbo",
    ...
  }
}
```
- ✅ Rẻ (~$0.02/đề)
- ⚠️ Chất lượng thấp hơn
- ⚠️ Cần review kỹ hơn

## Hỗ trợ

**Tài liệu OpenAI**: https://platform.openai.com/docs

**Hỗ trợ**: https://help.openai.com/

**Pricing**: https://openai.com/pricing

---

Sau khi cài API key xong, bạn có thể chạy:
```bash
python main.py uploads/de_cuong.pdf
```
