#!/bin/bash

echo "🚀 Starting Edu Ecosystem Platform..."
echo "======================================"

# Navigate to project directory
cd /home/ngocduy/duy/C1SE.03

# Check if containers are already running
if sudo docker ps | grep -q "edu-server"; then
    echo "⚠️  Containers already running. Restarting to apply changes..."
    sudo docker compose restart server worker
else
    echo "📦 Starting all containers..."
    sudo docker compose up -d
fi

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

echo ""
echo "📋 Container Status:"
sudo docker ps --format "table {{.Names}}\t{{.Status}}" | grep "edu-"

echo ""
echo "✅ Platform is ready!"
echo ""
echo "📍 Access Points:"
echo "   - Frontend:     http://localhost:3000"
echo "   - Backend API:  http://localhost:5001/api"
echo "   - MinIO Console: http://localhost:9001"
echo ""
echo "👤 Demo Accounts:"
echo "   Admin:    admin@edu.com / Admin@123"
echo "   Teacher:  teacher@edu.com / Teacher@123"
echo "   Student:  student@edu.com / Student@123"
echo ""
echo "📖 Full documentation: DEMO_ACCOUNTS.md"
echo ""
echo "🧪 Test accounts with:"
echo "   chmod +x test-accounts.sh && ./test-accounts.sh"
echo ""
echo "📝 View logs:"
echo "   sudo docker logs edu-server -f"
