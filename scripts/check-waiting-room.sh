#!/bin/bash

echo "🔍 KIỂM TRA WAITING ROOM - QUICK CHECK"
echo "======================================"
echo ""

# Màu sắc
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Kiểm tra Server
echo "1️⃣  Kiểm tra Server (port 5000)..."
if netstat -tuln 2>/dev/null | grep -q ":5000"; then
    echo -e "${GREEN}✅ Server đang chạy trên port 5000${NC}"
else
    echo -e "${RED}❌ Server KHÔNG chạy trên port 5000${NC}"
    echo "   → Chạy: cd server && npm start"
fi
echo ""

# 2. Kiểm tra Client
echo "2️⃣  Kiểm tra Client (port 3000)..."
if netstat -tuln 2>/dev/null | grep -q ":3000"; then
    echo -e "${GREEN}✅ Client đang chạy trên port 3000${NC}"
else
    echo -e "${RED}❌ Client KHÔNG chạy trên port 3000${NC}"
    echo "   → Chạy: cd client && npm start"
fi
echo ""

# 3. Kiểm tra Cache
echo "3️⃣  Kiểm tra Cache..."
CLIENT_CACHE="/home/dtu/huy/duy /C1SE.03/client/node_modules/.cache"
if [ -d "$CLIENT_CACHE" ]; then
    CACHE_SIZE=$(du -sh "$CLIENT_CACHE" 2>/dev/null | cut -f1)
    echo -e "${YELLOW}⚠️  Cache tồn tại: $CACHE_SIZE${NC}"
    echo "   → Nên xóa: sudo rm -rf \"$CLIENT_CACHE\""
else
    echo -e "${GREEN}✅ Cache đã được xóa${NC}"
fi
echo ""

# 4. Kiểm tra MongoDB
echo "4️⃣  Kiểm tra MongoDB..."
if docker ps | grep -q edu-mongo; then
    echo -e "${GREEN}✅ MongoDB container đang chạy${NC}"
    
    echo "   📊 Kiểm tra Live Classes..."
    docker exec edu-mongo mongosh -u admin -p admin123 --quiet --eval "
    use edu_platform;
    const classes = db.liveclasses.find({}, {title:1, 'settings.waitingRoom':1, status:1}).toArray();
    if (classes.length === 0) {
        print('   ⚠️  Chưa có lớp học nào. Vào trang Create Live để tạo lớp mới.');
    } else {
        print('   📚 Danh sách lớp học:');
        classes.forEach((c, i) => {
            const wr = c.settings?.waitingRoom ? '✅ CÓ' : '❌ KHÔNG';
            print('      ' + (i+1) + '. ' + c.title + ' (' + c.status + ') - Waiting Room: ' + wr);
        });
    }
    " 2>/dev/null
    
    echo ""
    echo "   👥 Kiểm tra Waiting Students..."
    WAITING_COUNT=$(docker exec edu-mongo mongosh -u admin -p admin123 --quiet --eval "use edu_platform; db.liveroomwaitings.countDocuments({status:'waiting'})" 2>/dev/null)
    if [ "$WAITING_COUNT" = "0" ]; then
        echo -e "      ${YELLOW}⚠️  Không có học sinh nào đang chờ duyệt${NC}"
    else
        echo -e "      ${GREEN}✅ Có $WAITING_COUNT học sinh đang chờ${NC}"
    fi
else
    echo -e "${RED}❌ MongoDB container KHÔNG chạy${NC}"
    echo "   → Chạy: docker-compose up -d"
fi
echo ""

# 5. Kiểm tra Environment Variables
echo "5️⃣  Kiểm tra Environment Variables..."
CLIENT_ENV="/home/dtu/huy/duy /C1SE.03/client/.env"
if [ -f "$CLIENT_ENV" ]; then
    API_URL=$(grep REACT_APP_API_URL "$CLIENT_ENV" | cut -d'=' -f2)
    SOCKET_URL=$(grep REACT_APP_SOCKET_URL "$CLIENT_ENV" | cut -d'=' -f2)
    
    if [[ "$API_URL" == *":5000"* ]]; then
        echo -e "${GREEN}✅ API_URL đúng: $API_URL${NC}"
    else
        echo -e "${RED}❌ API_URL sai: $API_URL${NC}"
        echo "   → Phải là: http://localhost:5000/api"
    fi
    
    if [[ "$SOCKET_URL" == *":5000"* ]]; then
        echo -e "${GREEN}✅ SOCKET_URL đúng: $SOCKET_URL${NC}"
    else
        echo -e "${RED}❌ SOCKET_URL sai: $SOCKET_URL${NC}"
        echo "   → Phải là: http://localhost:5000"
    fi
else
    echo -e "${YELLOW}⚠️  File .env không tồn tại${NC}"
    echo "   → Tạo file: echo 'REACT_APP_API_URL=http://localhost:5000/api' > client/.env"
fi
echo ""

# 6. Tóm tắt
echo "======================================"
echo "📋 TÓM TẮT:"
echo "======================================"

ALL_GOOD=true

if ! netstat -tuln 2>/dev/null | grep -q ":5000"; then
    echo -e "${RED}❌ Server chưa chạy${NC}"
    ALL_GOOD=false
fi

if ! netstat -tuln 2>/dev/null | grep -q ":3000"; then
    echo -e "${RED}❌ Client chưa chạy${NC}"
    ALL_GOOD=false
fi

if [ -d "$CLIENT_CACHE" ]; then
    echo -e "${YELLOW}⚠️  Cache cần xóa${NC}"
fi

if ! docker ps | grep -q edu-mongo; then
    echo -e "${RED}❌ MongoDB chưa chạy${NC}"
    ALL_GOOD=false
fi

if [ "$ALL_GOOD" = true ]; then
    echo -e "${GREEN}✅ Hệ thống sẵn sàng!${NC}"
    echo ""
    echo "🎯 BƯỚC TIẾP THEO:"
    echo "1. Xóa cache browser: Ctrl+Shift+Delete"
    echo "2. Hard refresh: Ctrl+Shift+R"
    echo "3. Login teacher@edu.com / Teacher@123"
    echo "4. Tạo lớp mới với checkbox '🚪 Phòng chờ'"
    echo "5. Test với học sinh"
else
    echo ""
    echo "⚠️  Cần fix các vấn đề trên trước"
fi

echo ""
echo "📖 Chi tiết: xem file DEBUG_WAITING_ROOM.md"
