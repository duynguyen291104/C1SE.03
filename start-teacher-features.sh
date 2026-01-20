#!/bin/bash

echo "🚀 Starting Edu Platform with Teacher Features..."
echo "=================================================="

cd /home/ngocduy/duy/C1SE.03

# Rebuild and start
echo "📦 Rebuilding containers..."
sudo docker compose down
sudo docker compose build --no-cache server worker client
sudo docker compose up -d

echo ""
echo "⏳ Waiting for services to start..."
sleep 15

echo ""
echo "📋 Container Status:"
sudo docker ps --format "table {{.Names}}\t{{.Status}}" | grep "edu-"

echo ""
echo "🔍 Checking server logs..."
sudo docker logs edu-server --tail=20 | grep -E "(Server running|MongoDB Connected|Demo user created)" || echo "Check logs manually with: sudo docker logs edu-server"

echo ""
echo "✅ Platform Ready!"
echo ""
echo "📍 Access:"
echo "   Frontend:    http://localhost:3000"
echo "   Backend API: http://localhost:5001/api"
echo ""
echo "👤 Teacher Account:"
echo "   Email:    teacher@edu.com"
echo "   Password: Teacher@123"
echo ""
echo "🎯 Teacher Pages:"
echo "   - http://localhost:3000/teacher/dashboard"
echo "   - http://localhost:3000/teacher/create-slide"
echo "   - http://localhost:3000/teacher/create-quiz"
echo "   - http://localhost:3000/teacher/create-live"
echo "   - http://localhost:3000/teacher/materials"
echo ""
echo "📚 API Documentation: API_TEACHER.md"
echo ""
echo "🧪 Test login:"
echo "   curl -X POST http://localhost:5001/api/auth/login \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"email\":\"teacher@edu.com\",\"password\":\"Teacher@123\"}'"
