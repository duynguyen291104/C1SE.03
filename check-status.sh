#!/bin/bash
echo "=== Container Status ==="
sudo docker ps --format "table {{.Names}}\t{{.Status}}"

echo -e "\n=== Server Logs (last 15 lines) ==="
sudo docker logs edu-server --tail=15 2>&1 | grep -E "(MongoDB|Server|Error|✅|❌|🚀)" || sudo docker logs edu-server --tail=15

echo -e "\n=== Worker Logs (last 10 lines) ==="
sudo docker logs edu-worker --tail=10 2>&1 | grep -E "(MongoDB|Worker|Error|✅|❌)" || sudo docker logs edu-worker --tail=10
