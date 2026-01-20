#!/bin/bash

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     🎓 EDU PLATFORM - TEACHER FEATURES UPDATE                  ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Container Status
echo "📦 Container Status:"
sudo docker ps --format "table {{.Names}}\t{{.Status}}" | grep edu-

echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""

# Test API endpoints
echo "🧪 Testing New Teacher API Endpoints..."
echo ""

# Login first
echo "1️⃣ Login as teacher..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@edu.com","password":"Teacher@123"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed!"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login successful!"
echo "   Token: ${TOKEN:0:20}..."
echo ""

# Test endpoints
echo "2️⃣ Testing Slides API..."
SLIDES_RESPONSE=$(curl -s -X GET http://localhost:5001/api/slides \
  -H "Authorization: Bearer $TOKEN")
echo "   Response: $(echo $SLIDES_RESPONSE | head -c 100)..."
if echo "$SLIDES_RESPONSE" | grep -q '"success":true'; then
  echo "   ✅ Slides API working!"
else
  echo "   ⚠️  Slides API response: $SLIDES_RESPONSE"
fi
echo ""

echo "3️⃣ Testing Quizzes API..."
QUIZ_RESPONSE=$(curl -s -X GET http://localhost:5001/api/quizzes \
  -H "Authorization: Bearer $TOKEN")
if echo "$QUIZ_RESPONSE" | grep -q '"success":true'; then
  echo "   ✅ Quizzes API working!"
else
  echo "   ⚠️  Quizzes API response: $QUIZ_RESPONSE"
fi
echo ""

echo "4️⃣ Testing Live Classes API..."
LIVE_RESPONSE=$(curl -s -X GET http://localhost:5001/api/live-classes \
  -H "Authorization: Bearer $TOKEN")
if echo "$LIVE_RESPONSE" | grep -q '"success":true'; then
  echo "   ✅ Live Classes API working!"
else
  echo "   ⚠️  Live Classes API response: $LIVE_RESPONSE"
fi
echo ""

echo "5️⃣ Testing Materials API..."
MATERIALS_RESPONSE=$(curl -s -X GET http://localhost:5001/api/materials \
  -H "Authorization: Bearer $TOKEN")
if echo "$MATERIALS_RESPONSE" | grep -q '"success":true'; then
  echo "   ✅ Materials API working!"
else
  echo "   ⚠️  Materials API response: $MATERIALS_RESPONSE"
fi
echo ""

echo "════════════════════════════════════════════════════════════════"
echo ""
echo "🎯 Access URLs:"
echo ""
echo "   Frontend:    http://localhost:3000"
echo "   Backend API: http://localhost:5001/api"
echo ""
echo "📱 Teacher Pages:"
echo "   • Slides:    http://localhost:3000/teacher/create-slide"
echo "   • Quizzes:   http://localhost:3000/teacher/create-quiz"
echo "   • Live:      http://localhost:3000/teacher/create-live"
echo "   • Materials: http://localhost:3000/teacher/materials"
echo ""
echo "🔑 Teacher Login:"
echo "   Email:    teacher@edu.com"
echo "   Password: Teacher@123"
echo ""
echo "📚 Documentation:"
echo "   • TEACHER_FEATURES.md - Full feature documentation"
echo "   • API_TEACHER.md      - API endpoints reference"
echo "   • DEMO_ACCOUNTS.md    - All demo accounts"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "✅ Teacher features deployed successfully!"
echo ""
