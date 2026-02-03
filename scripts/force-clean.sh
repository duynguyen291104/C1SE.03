#!/bin/bash

echo "🔥 FORCE CLEAN - XÓA TẤT CẢ CACHE"
echo "=================================="
echo ""

# 1. Kill tất cả process
echo "1. Kill all processes..."
pkill -9 -f "react-scripts" 2>/dev/null
pkill -9 -f "node.*webpack" 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null
lsof -ti:3002 | xargs kill -9 2>/dev/null
echo "   ✅ Killed all"

# 2. Xóa cache client
echo "2. Remove client cache..."
cd "/home/dtu/huy/duy /C1SE.03/client"
sudo rm -rf node_modules/.cache
sudo rm -rf build
sudo rm -rf .cache
sudo rm -rf public/service-worker.js
sudo rm -rf public/sw.js
echo "   ✅ Removed cache"

# 3. Fix permissions
echo "3. Fix permissions..."
sudo chown -R $USER:$USER node_modules
echo "   ✅ Fixed permissions"

# 4. Clear npm cache
echo "4. Clear npm cache..."
npm cache clean --force 2>/dev/null
echo "   ✅ NPM cache cleared"

# 5. Start fresh
echo "5. Starting client on port 3000..."
PORT=3000 REACT_APP_SOCKET_URL=http://localhost:5000 npm start &
echo "   ⏳ Starting..."

sleep 5
echo ""
echo "=================================="
echo "✅ CLIENT STARTING..."
echo "=================================="
echo ""
echo "📝 IMPORTANT - DO THIS NOW:"
echo ""
echo "1. Mở Chrome DevTools (F12)"
echo "2. Vào tab 'Application'"
echo "3. Bên trái chọn:"
echo "   - Storage → Clear site data → Clear all"
echo "   - Service Workers → Unregister all"
echo "   - Cache Storage → Delete all"
echo ""
echo "4. Đóng tất cả tab localhost:3000"
echo "5. Mở Incognito: Ctrl+Shift+N"
echo "6. Vào: http://localhost:3000"
echo ""
echo "7. Check console KHÔNG có 'ws://localhost:5001'"
echo ""
echo "=================================="
