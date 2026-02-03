#!/bin/bash

echo "🔄 RESTART CLIENT - XÓA CACHE VÀ KHỞI ĐỘNG LẠI"
echo "=============================================="
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

CLIENT_DIR="/home/dtu/huy/duy /C1SE.03/client"

# 1. Dừng client (nếu đang chạy)
echo "1️⃣  Dừng client đang chạy..."
pkill -f "react-scripts start" 2>/dev/null
sleep 2
echo -e "${GREEN}✅ Đã dừng client${NC}"
echo ""

# 2. Xóa cache
echo "2️⃣  Xóa cache..."
cd "$CLIENT_DIR"

sudo rm -rf node_modules/.cache build .cache 2>/dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Đã xóa cache${NC}"
else
    echo -e "${YELLOW}⚠️  Không thể xóa cache (cần sudo)${NC}"
    echo "   Chạy thủ công: sudo rm -rf \"$CLIENT_DIR/node_modules/.cache\""
fi

# Fix permissions
sudo chown -R $USER:$USER node_modules 2>/dev/null
echo ""

# 3. Kiểm tra .env
echo "3️⃣  Kiểm tra .env..."
if [ -f ".env" ]; then
    if grep -q "REACT_APP_SOCKET_URL" .env; then
        echo -e "${GREEN}✅ .env đã có SOCKET_URL${NC}"
    else
        echo -e "${YELLOW}⚠️  Thêm SOCKET_URL vào .env${NC}"
        echo "REACT_APP_SOCKET_URL=http://localhost:5000" >> .env
    fi
    
    echo "   📄 Nội dung .env:"
    cat .env | grep -E "REACT_APP_(API|SOCKET)" | sed 's/^/      /'
else
    echo -e "${RED}❌ File .env không tồn tại${NC}"
    echo "   Tạo file:"
    cat > .env << 'EOF'
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
DISABLE_ESLINT_PLUGIN=true
EOF
    echo -e "${GREEN}✅ Đã tạo .env${NC}"
fi
echo ""

# 4. Restart
echo "4️⃣  Khởi động lại client..."
echo -e "${YELLOW}⏳ Đang chạy npm start...${NC}"
echo ""
echo "=============================================="
echo "🎯 SAU KHI CLIENT KHỞI ĐỘNG:"
echo "=============================================="
echo "1. Mở browser: http://localhost:3000"
echo "2. Xóa cache browser: Ctrl+Shift+Delete"
echo "3. Hard refresh: Ctrl+Shift+R"
echo "4. Login: teacher@edu.com / Teacher@123"
echo "5. Tạo lớp mới với checkbox '🚪 Phòng chờ'"
echo "6. Test với student@edu.com / Student@123"
echo ""
echo "📖 Chi tiết: DEBUG_WAITING_ROOM.md"
echo "=============================================="
echo ""

# Start client (không dùng background để thấy logs)
npm start
