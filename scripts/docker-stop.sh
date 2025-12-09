#!/bin/bash

# ============================================
# Docker Stop Script
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Colors
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}🛑 Stopping Layout Manager...${NC}"

docker-compose down

echo -e "${GREEN}✅ All services stopped.${NC}"
