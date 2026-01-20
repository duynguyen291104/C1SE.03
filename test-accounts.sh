#!/bin/bash

echo "🧪 Testing Demo Accounts Login..."
echo "=================================="
echo ""

BASE_URL="http://localhost:5001/api"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

test_login() {
    local email=$1
    local password=$2
    local role=$3
    
    echo -e "${BLUE}Testing: $email ($role)${NC}"
    
    response=$(curl -s -X POST "$BASE_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$email\",\"password\":\"$password\"}")
    
    if echo "$response" | grep -q "accessToken"; then
        echo -e "${GREEN}✅ Login successful${NC}"
        # Extract user info
        echo "$response" | jq -r '.user | "   Name: \(.profile.fullName // "N/A")\n   Roles: \(.roles | join(", "))\n   Status: \(.teacherStatus // "N/A")"' 2>/dev/null || echo "   (Response received but jq not installed)"
    else
        echo -e "${RED}❌ Login failed${NC}"
        echo "$response" | jq . 2>/dev/null || echo "$response"
    fi
    echo ""
}

# Test all demo accounts
test_login "admin@edu.com" "Admin@123" "Admin"
test_login "teacher@edu.com" "Teacher@123" "Teacher"
test_login "teacher2@edu.com" "Teacher@123" "Teacher"
test_login "student@edu.com" "Student@123" "Student"
test_login "student2@edu.com" "Student@123" "Student"

echo "=================================="
echo -e "${BLUE}💡 Tip: Install jq for better output formatting${NC}"
echo "   sudo apt install jq"
