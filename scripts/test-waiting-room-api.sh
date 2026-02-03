#!/bin/bash

echo "🧪 TEST WAITING ROOM API - COMPREHENSIVE TESTING"
echo "================================================"
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

API_URL="http://localhost:5000/api"
SERVER_URL="http://localhost:5000"

# Check if server is running
echo "1️⃣  Checking server status..."
if ! curl -s "$API_URL/health" > /dev/null 2>&1; then
    echo -e "${RED}❌ Server is not running on port 5000${NC}"
    echo "   Start server: cd server && npm start"
    exit 1
fi
echo -e "${GREEN}✅ Server is running${NC}"
echo ""

# Variables to store tokens
TEACHER_TOKEN=""
STUDENT_TOKEN=""
LIVE_CLASS_ID=""
JOIN_TOKEN=""

# ============================================
# TEST 1: Login Teacher
# ============================================
echo "2️⃣  TEST 1: Login Teacher"
echo "   Endpoint: POST $API_URL/auth/login"
echo "   Body: {email: 'teacher@edu.com', password: 'Teacher@123'}"
echo ""

TEACHER_LOGIN=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teacher@edu.com",
    "password": "Teacher@123"
  }')

TEACHER_TOKEN=$(echo $TEACHER_LOGIN | jq -r '.accessToken // .data.accessToken' 2>/dev/null)

if [ "$TEACHER_TOKEN" == "null" ] || [ -z "$TEACHER_TOKEN" ]; then
    echo -e "${RED}❌ Teacher login FAILED${NC}"
    echo "Response: $TEACHER_LOGIN"
    exit 1
fi

echo -e "${GREEN}✅ Teacher login SUCCESS${NC}"
echo "   Token: ${TEACHER_TOKEN:0:20}..."
echo ""

# ============================================
# TEST 2: End any existing live class first
# ============================================
echo "3️⃣  TEST 2: Check and End Existing Live Class"
echo "   Checking for active classes..."
echo ""

EXISTING_CLASS=$(curl -s -X GET "$API_URL/live-classes" \
  -H "Authorization: Bearer $TEACHER_TOKEN" | jq -r '.data[] | select(.status=="live") | ._id' | head -1)

if [ ! -z "$EXISTING_CLASS" ] && [ "$EXISTING_CLASS" != "null" ]; then
    echo "   Found active class: $EXISTING_CLASS"
    echo "   Ending it..."
    
    END_OLD=$(curl -s -X POST "$API_URL/live-classes/$EXISTING_CLASS/end" \
      -H "Authorization: Bearer $TEACHER_TOKEN")
    
    echo -e "${GREEN}✅ Ended old live class${NC}"
else
    echo "   No active class found"
fi
echo ""

# ============================================
# TEST 3: Create Live Class with Waiting Room
# ============================================
echo "4️⃣  TEST 3: Create Live Class (Waiting Room Enabled)"
echo "   Endpoint: POST $API_URL/live-classes"
echo ""

# Get current time + 5 minutes for scheduledStart
SCHEDULED_START=$(date -u -d "+5 minutes" +"%Y-%m-%dT%H:%M:%S.000Z")
SCHEDULED_END=$(date -u -d "+2 hours" +"%Y-%m-%dT%H:%M:%S.000Z")

CREATE_RESPONSE=$(curl -s -X POST "$API_URL/live-classes" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TEACHER_TOKEN" \
  -d "{
    \"title\": \"Test Waiting Room $(date +%H:%M:%S)\",
    \"description\": \"Testing approval workflow\",
    \"scheduledStart\": \"$SCHEDULED_START\",
    \"scheduledEnd\": \"$SCHEDULED_END\",
    \"maxParticipants\": 50,
    \"settings\": {
      \"allowChat\": true,
      \"allowQuestions\": true,
      \"recordSession\": false,
      \"waitingRoom\": true,
      \"muteOnEntry\": true
    }
  }")

LIVE_CLASS_ID=$(echo $CREATE_RESPONSE | jq -r '.data._id' 2>/dev/null)

if [ "$LIVE_CLASS_ID" == "null" ] || [ -z "$LIVE_CLASS_ID" ]; then
    echo -e "${RED}❌ Create live class FAILED${NC}"
    echo "Response: $CREATE_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✅ Live class created SUCCESS${NC}"
echo "   ID: $LIVE_CLASS_ID"
echo "   Waiting Room: $(echo $CREATE_RESPONSE | jq -r '.data.settings.waitingRoom')"
echo ""

# ============================================
# TEST 4: Start Live Class
# ============================================
echo "5️⃣  TEST 4: Start Live Class"
echo "   Endpoint: POST $API_URL/live-classes/$LIVE_CLASS_ID/start"
echo ""

START_RESPONSE=$(curl -s -X POST "$API_URL/live-classes/$LIVE_CLASS_ID/start" \
  -H "Authorization: Bearer $TEACHER_TOKEN")

START_STATUS=$(echo $START_RESPONSE | jq -r '.data.status' 2>/dev/null)

if [ "$START_STATUS" != "live" ]; then
    echo -e "${RED}❌ Start live class FAILED${NC}"
    echo "Response: $START_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✅ Live class started SUCCESS${NC}"
echo "   Status: $START_STATUS"
echo "   RoomId: $(echo $START_RESPONSE | jq -r '.data.roomId')"
echo ""

# ============================================
# TEST 5: Teacher Join Room
# ============================================
echo "6️⃣  TEST 5: Teacher Join Room"
echo "   Endpoint: POST $API_URL/student/live-classes/$LIVE_CLASS_ID/join"
echo ""

TEACHER_JOIN=$(curl -s -X POST "$API_URL/student/live-classes/$LIVE_CLASS_ID/join" \
  -H "Authorization: Bearer $TEACHER_TOKEN")

TEACHER_JOIN_TOKEN=$(echo $TEACHER_JOIN | jq -r '.data.joinToken' 2>/dev/null)

if [ "$TEACHER_JOIN_TOKEN" == "null" ] || [ -z "$TEACHER_JOIN_TOKEN" ]; then
    echo -e "${RED}❌ Teacher join FAILED${NC}"
    echo "Response: $TEACHER_JOIN"
    exit 1
fi

echo -e "${GREEN}✅ Teacher join SUCCESS${NC}"
echo "   Join Token: ${TEACHER_JOIN_TOKEN:0:30}..."
echo ""

# ============================================
# TEST 6: Login Student
# ============================================
echo "7️⃣  TEST 6: Login Student"
echo "   Endpoint: POST $API_URL/auth/login"
echo "   Body: {email: 'student@edu.com', password: 'Student@123'}"
echo ""

STUDENT_LOGIN=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@edu.com",
    "password": "Student@123"
  }')

STUDENT_TOKEN=$(echo $STUDENT_LOGIN | jq -r '.accessToken // .data.accessToken' 2>/dev/null)

if [ "$STUDENT_TOKEN" == "null" ] || [ -z "$STUDENT_TOKEN" ]; then
    echo -e "${YELLOW}⚠️  Student login FAILED - Account may not exist${NC}"
    echo "   Creating new student account..."
    
    # Register new student
    REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
      -H "Content-Type: application/json" \
      -d '{
        "email": "teststudent@edu.com",
        "password": "Test@123",
        "confirmPassword": "Test@123",
        "profile": {
          "fullName": "Test Student",
          "dateOfBirth": "2000-01-01"
        },
        "roles": ["student"]
      }')
    
    STUDENT_TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.accessToken // .data.accessToken' 2>/dev/null)
    
    if [ "$STUDENT_TOKEN" == "null" ] || [ -z "$STUDENT_TOKEN" ]; then
        echo -e "${RED}❌ Student registration FAILED${NC}"
        echo "Response: $REGISTER_RESPONSE"
        exit 1
    fi
    
    echo -e "${GREEN}✅ New student registered SUCCESS${NC}"
fi

echo -e "${GREEN}✅ Student login/register SUCCESS${NC}"
echo "   Token: ${STUDENT_TOKEN:0:20}..."
echo ""

# ============================================
# TEST 7: Student Request Join (Should go to waiting)
# ============================================
echo "8️⃣  TEST 7: Student Request Join (Waiting Room)"
echo "   Endpoint: POST $API_URL/student/live-classes/$LIVE_CLASS_ID/join"
echo "   Expected: Should receive 'waiting_approval' status"
echo ""

STUDENT_JOIN=$(curl -s -X POST "$API_URL/student/live-classes/$LIVE_CLASS_ID/join" \
  -H "Authorization: Bearer $STUDENT_TOKEN")

JOIN_STATUS=$(echo $STUDENT_JOIN | jq -r '.data.status' 2>/dev/null)
JOIN_TOKEN=$(echo $STUDENT_JOIN | jq -r '.data.joinToken' 2>/dev/null)

if [ "$JOIN_STATUS" == "waiting_approval" ]; then
    echo -e "${GREEN}✅ Student correctly sent to WAITING ROOM${NC}"
    echo "   Status: $JOIN_STATUS"
    echo "   Message: $(echo $STUDENT_JOIN | jq -r '.data.message')"
elif [ "$JOIN_STATUS" == "approved" ]; then
    echo -e "${YELLOW}⚠️  Student was AUTO-APPROVED (Waiting room may be disabled)${NC}"
    echo "   Token: ${JOIN_TOKEN:0:30}..."
else
    echo -e "${RED}❌ Unexpected status: $JOIN_STATUS${NC}"
    echo "Response: $STUDENT_JOIN"
fi
echo ""

# ============================================
# TEST 8: Check Waiting List (MongoDB)
# ============================================
echo "9️⃣  TEST 8: Check Database - Waiting List"
echo "   Collection: liveroomwaitings"
echo ""

WAITING_LIST=$(docker exec edu-mongo mongosh -u admin -p admin123 --quiet --eval "
use edu_platform;
db.liveroomwaitings.find({status:'waiting'}).toArray();
" 2>/dev/null)

WAITING_COUNT=$(docker exec edu-mongo mongosh -u admin -p admin123 --quiet --eval "
use edu_platform;
db.liveroomwaitings.countDocuments({status:'waiting'});
" 2>/dev/null | grep -o '[0-9]*')

if [ "$WAITING_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ Found $WAITING_COUNT student(s) in waiting list${NC}"
    echo ""
    echo "Waiting Students:"
    docker exec edu-mongo mongosh -u admin -p admin123 --quiet --eval "
    use edu_platform;
    db.liveroomwaitings.find({status:'waiting'},{fullName:1,email:1,status:1,requestedAt:1}).pretty();
    " 2>/dev/null
else
    echo -e "${YELLOW}⚠️  No students in waiting list${NC}"
    echo "   This might mean:"
    echo "   1. Student was auto-approved (waiting room disabled)"
    echo "   2. Database not synced yet"
fi
echo ""

# ============================================
# SUMMARY & NEXT STEPS
# ============================================
echo "================================================"
echo "📊 TEST SUMMARY"
echo "================================================"
echo ""
echo -e "${BLUE}🎓 Teacher Account:${NC}"
echo "   Token: ${TEACHER_TOKEN:0:40}..."
echo ""
echo -e "${BLUE}👨‍🎓 Student Account:${NC}"
echo "   Token: ${STUDENT_TOKEN:0:40}..."
echo ""
echo -e "${BLUE}📚 Live Class:${NC}"
echo "   ID: $LIVE_CLASS_ID"
echo "   Status: live"
echo "   Waiting Room: ✅ Enabled"
echo ""
echo -e "${BLUE}⏳ Waiting Students:${NC}"
echo "   Count: $WAITING_COUNT"
echo ""
echo "================================================"
echo "🎯 MANUAL TEST - OPEN BROWSER"
echo "================================================"
echo ""
echo "1️⃣  Teacher Window (Normal browser):"
echo "   URL: http://localhost:3000/live-room/$LIVE_CLASS_ID"
echo "   Login: teacher@edu.com / Teacher@123"
echo "   Expected: Should see '⏳ Chờ duyệt (1)' button"
echo ""
echo "2️⃣  Student Window (Incognito: Ctrl+Shift+N):"
echo "   URL: http://localhost:3000/student/classes"
echo "   Login: student@edu.com / Student@123"
echo "   Join class → Should see '⏰ Đang chờ giáo viên duyệt...'"
echo ""
echo "3️⃣  Test Approval:"
echo "   - Teacher clicks '⏳ Chờ duyệt (1)'"
echo "   - Panel opens with student card"
echo "   - Click '✅ Duyệt' button"
echo "   - Student should join room immediately"
echo ""
echo "================================================"
echo "🐛 DEBUG COMMANDS"
echo "================================================"
echo ""
echo "# Check WebSocket connections:"
echo "docker logs edu-server --tail=50 | grep -E 'Socket|room:approve|room:reject'"
echo ""
echo "# Check waiting list in real-time:"
echo "docker exec edu-mongo mongosh -u admin -p admin123 --eval \"use edu_platform; db.liveroomwaitings.find({status:'waiting'}).pretty()\""
echo ""
echo "# Check participants:"
echo "docker exec edu-mongo mongosh -u admin -p admin123 --eval \"use edu_platform; db.liveroomparticipants.find({isOnline:true}).pretty()\""
echo ""
echo "📖 Full guide: DEBUG_WAITING_ROOM.md"
echo ""
