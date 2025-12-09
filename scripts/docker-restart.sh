#!/bin/bash

# ============================================
# Docker Restart Script
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Colors
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}🔄 Restarting Layout Manager...${NC}"

docker-compose restart

echo -e "${GREEN}✅ All services restarted.${NC}"
docker-compose ps
