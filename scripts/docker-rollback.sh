#!/bin/bash

# ============================================
# Docker Rollback Script
# Restores previous container versions
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}⏪ Rolling back to previous version...${NC}"

# Check if backup images exist
if ! docker image inspect layout_frontend:backup &>/dev/null; then
    echo -e "${RED}❌ No backup images found. Cannot rollback.${NC}"
    exit 1
fi

# Stop current containers
docker-compose down

# Restore backup images
echo -e "${GREEN}📦 Restoring backup images...${NC}"
docker tag layout_frontend:backup layout_frontend:latest
docker tag layout_backend:backup layout_backend:latest

# Start with restored images
echo -e "${GREEN}🚀 Starting with previous version...${NC}"
docker-compose up -d

echo -e "${GREEN}✅ Rollback completed!${NC}"
docker-compose ps
