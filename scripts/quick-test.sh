#!/bin/bash

# Quick test - không cần health check phức tạp

echo "🚀 QUICK TEST - WAITING ROOM"
echo "============================"
echo ""

API="http://localhost:5000/api"

# 1. Login Teacher
echo "1. Login Teacher..."
T_TOKEN=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@edu.com","password":"Teacher@123"}' \
  | jq -r '.accessToken')

echo "   Token: ${T_TOKEN:0:20}..."

# 2. End any live class
echo "2. End existing live class..."
OLD_ID=$(curl -s "$API/live-classes" \
  -H "Authorization: Bearer $T_TOKEN" \
  | jq -r '.data[]|select(.status=="live")|._id' | head -1)

if [ ! -z "$OLD_ID" ]; then
  curl -s -X POST "$API/live-classes/$OLD_ID/end" \
    -H "Authorization: Bearer $T_TOKEN" > /dev/null
  echo "   Ended: $OLD_ID"
fi

# 3. Create new class
echo "3. Create new class with waiting room..."
START=$(date -u -d "+1 minute" +"%Y-%m-%dT%H:%M:%S.000Z")
END=$(date -u -d "+2 hours" +"%Y-%m-%dT%H:%M:%S.000Z")

CLASS_ID=$(curl -s -X POST "$API/live-classes" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $T_TOKEN" \
  -d "{
    \"title\":\"Test WR $(date +%H:%M)\",
    \"description\":\"Test\",
    \"scheduledStart\":\"$START\",
    \"scheduledEnd\":\"$END\",
    \"settings\":{\"waitingRoom\":true}
  }" | jq -r '.data._id')

echo "   Class ID: $CLASS_ID"

# 4. Start class
echo "4. Start class..."
curl -s -X POST "$API/live-classes/$CLASS_ID/start" \
  -H "Authorization: Bearer $T_TOKEN" > /dev/null
echo "   Status: live"

# 5. Login Student
echo "5. Login Student..."
S_TOKEN=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"student@edu.com","password":"Student@123"}' \
  | jq -r '.accessToken')

if [ "$S_TOKEN" == "null" ]; then
  echo "   Creating student..."
  S_TOKEN=$(curl -s -X POST "$API/auth/register" \
    -H "Content-Type: application/json" \
    -d '{
      "email":"teststudent@edu.com",
      "password":"Test@123",
      "confirmPassword":"Test@123",
      "profile":{"fullName":"Test Student"},
      "roles":["student"]
    }' | jq -r '.accessToken')
fi

echo "   Token: ${S_TOKEN:0:20}..."

# 6. Student join (should go to waiting)
echo "6. Student join class..."
JOIN_STATUS=$(curl -s -X POST "$API/student/live-classes/$CLASS_ID/join" \
  -H "Authorization: Bearer $S_TOKEN" \
  | jq -r '.data.status')

echo "   Status: $JOIN_STATUS"

# 7. Check waiting list
echo "7. Check database..."
docker exec edu-mongo mongosh -u admin -p admin123 --quiet --eval "
use edu_platform;
const waiting = db.liveroomwaitings.find({status:'waiting'}).toArray();
print('   Waiting: ' + waiting.length + ' student(s)');
waiting.forEach(s => print('   - ' + s.fullName + ' (' + s.email + ')'));
" 2>/dev/null

echo ""
echo "✅ SETUP COMPLETE!"
echo ""
echo "📝 Next steps:"
echo "1. Open browser: http://localhost:3000"
echo "2. Login as teacher@edu.com"
echo "3. Go to: http://localhost:3000/live-room/$CLASS_ID"
echo "4. Click '⏳ Chờ duyệt (1)' button"
echo "5. Test approve/reject buttons"
echo ""
echo "Class ID: $CLASS_ID"
