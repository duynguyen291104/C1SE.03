#!/bin/bash
echo "🔄 Restarting containers to seed demo accounts..."
cd /home/ngocduy/duy/C1SE.03
sudo docker compose restart server

echo ""
echo "⏳ Waiting for server to start..."
sleep 8

echo ""
echo "📋 Checking server logs for demo account creation..."
sudo docker logs edu-server --tail=50 | grep -E "(Demo user created|👤)" || sudo docker logs edu-server --tail=20

echo ""
echo "✅ Done! Check DEMO_ACCOUNTS.md for login credentials"
echo ""
echo "Test login with:"
echo "  curl -X POST http://localhost:5001/api/auth/login \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"email\":\"teacher@edu.com\",\"password\":\"Teacher@123\"}'"
