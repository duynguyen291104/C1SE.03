#!/bin/bash

# Test Script for Camera & Microphone Functionality
# Run this to verify everything is working

echo "=============================================="
echo "🧪 TESTING CAMERA & MIC FUNCTIONALITY"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if containers are running
echo "1️⃣  Checking Docker containers..."
if docker ps --format "{{.Names}}" | grep -q "edu-client"; then
    echo -e "${GREEN}✅ Client container: Running${NC}"
else
    echo -e "${RED}❌ Client container: Not running${NC}"
    exit 1
fi

if docker ps --format "{{.Names}}" | grep -q "edu-server"; then
    echo -e "${GREEN}✅ Server container: Running${NC}"
else
    echo -e "${RED}❌ Server container: Not running${NC}"
    exit 1
fi

echo ""

# Check if client compiled successfully
echo "2️⃣  Checking client compilation..."
if docker logs edu-client 2>&1 | tail -20 | grep -q "Compiled successfully"; then
    echo -e "${GREEN}✅ Client compiled successfully${NC}"
else
    echo -e "${RED}❌ Client compilation failed${NC}"
    exit 1
fi

echo ""

# Check if server is running
echo "3️⃣  Checking server status..."
if docker logs edu-server 2>&1 | grep -q "Server running\|MongoDB Connected"; then
    echo -e "${GREEN}✅ Server is running${NC}"
else
    echo -e "${RED}❌ Server is not running${NC}"
    exit 1
fi

echo ""

# Check if files were updated
echo "4️⃣  Checking updated files..."

files=(
    "/home/ngocduy/duy/C1SE.03/client/src/hooks/useWebRTC.js"
    "/home/ngocduy/duy/C1SE.03/client/src/pages/LiveClassRoom.css"
    "/home/ngocduy/duy/C1SE.03/CAMERA_MIC_GUIDE.md"
    "/home/ngocduy/duy/C1SE.03/CAMERA_MIC_SUMMARY.md"
)

all_files_exist=true
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $file${NC}"
    else
        echo -e "${RED}❌ $file not found${NC}"
        all_files_exist=false
    fi
done

if [ "$all_files_exist" = false ]; then
    exit 1
fi

echo ""

# Check for key functions in useWebRTC
echo "5️⃣  Verifying useWebRTC hook updates..."

if grep -q "toggleMicrophone" /home/ngocduy/duy/C1SE.03/client/src/hooks/useWebRTC.js; then
    echo -e "${GREEN}✅ toggleMicrophone function exists${NC}"
else
    echo -e "${RED}❌ toggleMicrophone function not found${NC}"
    exit 1
fi

if grep -q "toggleCamera" /home/ngocduy/duy/C1SE.03/client/src/hooks/useWebRTC.js; then
    echo -e "${GREEN}✅ toggleCamera function exists${NC}"
else
    echo -e "${RED}❌ toggleCamera function not found${NC}"
    exit 1
fi

if grep -q "media:toggle-mic" /home/ngocduy/duy/C1SE.03/client/src/hooks/useWebRTC.js; then
    echo -e "${GREEN}✅ Socket event 'media:toggle-mic' found${NC}"
else
    echo -e "${RED}❌ Socket event 'media:toggle-mic' not found${NC}"
    exit 1
fi

if grep -q "media:toggle-camera" /home/ngocduy/duy/C1SE.03/client/src/hooks/useWebRTC.js; then
    echo -e "${GREEN}✅ Socket event 'media:toggle-camera' found${NC}"
else
    echo -e "${RED}❌ Socket event 'media:toggle-camera' not found${NC}"
    exit 1
fi

echo ""

# Check CSS updates
echo "6️⃣  Verifying CSS improvements..."

if grep -q "gradient" /home/ngocduy/duy/C1SE.03/client/src/pages/LiveClassRoom.css; then
    echo -e "${GREEN}✅ Gradient styles found${NC}"
else
    echo -e "${YELLOW}⚠️  Gradient styles not found (optional)${NC}"
fi

if grep -q "control-btn.active" /home/ngocduy/duy/C1SE.03/client/src/pages/LiveClassRoom.css; then
    echo -e "${GREEN}✅ Control button states found${NC}"
else
    echo -e "${RED}❌ Control button states not found${NC}"
    exit 1
fi

echo ""

# Get a live class to test
echo "7️⃣  Finding available live classes..."
live_classes=$(docker exec -it edu-mongo mongosh -u admin -p admin123 --authenticationDatabase admin edu_ecosystem --quiet --eval "db.liveclasses.find({}).limit(1).toArray()" 2>/dev/null)

if echo "$live_classes" | grep -q "_id"; then
    echo -e "${GREEN}✅ Found live classes in database${NC}"
    
    # Extract first live class ID
    class_id=$(echo "$live_classes" | grep -o "ObjectId('[^']*')" | head -1 | sed "s/ObjectId('\([^']*\)')/\1/")
    if [ ! -z "$class_id" ]; then
        echo -e "${YELLOW}📝 Test URL: http://localhost:3000/live-room/$class_id${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  No live classes found. Create one first.${NC}"
fi

echo ""
echo "=============================================="
echo -e "${GREEN}✅ ALL TESTS PASSED!${NC}"
echo "=============================================="
echo ""
echo "🎯 Next Steps:"
echo ""
echo "1. Open browser: http://localhost:3000"
echo "2. Login with teacher account:"
echo "   📧 Email: teacher@edu.com"
echo "   🔑 Password: Teacher@123"
echo ""
echo "3. Create or join a live class"
echo ""
echo "4. Test camera & microphone buttons:"
echo "   📹 Click camera button to toggle"
echo "   🎤 Click microphone button to toggle"
echo ""
echo "5. Open another browser/incognito window"
echo "   Login as another user to test P2P"
echo ""
echo "📚 Documentation:"
echo "   - CAMERA_MIC_GUIDE.md - Detailed user guide"
echo "   - CAMERA_MIC_SUMMARY.md - Technical summary"
echo ""
echo "🐛 Troubleshooting:"
echo "   - Check browser console (F12)"
echo "   - Check permissions (Settings → Privacy)"
echo "   - docker logs edu-client"
echo "   - docker logs edu-server"
echo ""
echo "✨ Happy Testing! ✨"
echo ""
