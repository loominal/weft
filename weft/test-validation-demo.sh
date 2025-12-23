#!/bin/bash
# Demonstration script for OpenAPI runtime validation
# This script should be run with the Weft API server running on localhost:3000

echo "=================================================="
echo "Weft API - OpenAPI Validation Demonstration"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API_URL="http://localhost:3000"

echo -e "${GREEN}Test 1: Valid work submission (should succeed - 201)${NC}"
echo "POST /api/work with all required fields"
curl -s -X POST "$API_URL/api/work" \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "task-123",
    "boundary": "personal",
    "capability": "typescript",
    "description": "Implement feature X",
    "priority": 7
  }' | jq '.'
echo ""
echo ""

echo -e "${RED}Test 2: Missing required field (should fail - 400)${NC}"
echo "POST /api/work without taskId and description"
curl -s -X POST "$API_URL/api/work" \
  -H "Content-Type: application/json" \
  -d '{
    "boundary": "personal",
    "capability": "typescript"
  }' | jq '.'
echo ""
echo ""

echo -e "${RED}Test 3: Invalid priority - too high (should fail - 400)${NC}"
echo "POST /api/work with priority=99 (max is 10)"
curl -s -X POST "$API_URL/api/work" \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "task-123",
    "boundary": "personal",
    "capability": "typescript",
    "description": "Test task",
    "priority": 99
  }' | jq '.'
echo ""
echo ""

echo -e "${RED}Test 4: Invalid priority - too low (should fail - 400)${NC}"
echo "POST /api/work with priority=0 (min is 1)"
curl -s -X POST "$API_URL/api/work" \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "task-123",
    "boundary": "personal",
    "capability": "typescript",
    "description": "Test task",
    "priority": 0
  }' | jq '.'
echo ""
echo ""

echo -e "${RED}Test 5: Invalid enum value (should fail - 400)${NC}"
echo "POST /api/work with preferredAgentType='gpt-4' (not in enum)"
curl -s -X POST "$API_URL/api/work" \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "task-123",
    "boundary": "personal",
    "capability": "typescript",
    "description": "Test task",
    "preferredAgentType": "gpt-4"
  }' | jq '.'
echo ""
echo ""

echo -e "${RED}Test 6: Invalid query parameter - limit too high (should fail - 400)${NC}"
echo "GET /api/agents?limit=9999 (max is 100)"
curl -s "$API_URL/api/agents?limit=9999" | jq '.'
echo ""
echo ""

echo -e "${GREEN}Test 7: Valid query parameter (should succeed - 200)${NC}"
echo "GET /api/agents?limit=50"
curl -s "$API_URL/api/agents?limit=50" | jq '.'
echo ""
echo ""

echo -e "${GREEN}Test 8: Health check (should succeed - 200)${NC}"
echo "GET /health"
curl -s "$API_URL/health" | jq '.'
echo ""
echo ""

echo "=================================================="
echo "Validation demonstration complete!"
echo "=================================================="
