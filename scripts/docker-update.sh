#!/bin/bash

# ============================================
# Docker Update Script
# Pulls latest code and rebuilds containers
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🔄 Updating Layout Manager...${NC}"

# Pull latest changes (if git repo)
if [ -d ".git" ]; then
    echo -e "${YELLOW}📥 Pulling latest changes...${NC}"
    git pull
fi

# Backup current images for rollback
echo -e "${YELLOW}📦 Creating backup tags...${NC}"
docker tag layout_frontend:latest layout_frontend:backup 2>/dev/null || true
docker tag layout_backend:latest layout_backend:backup 2>/dev/null || true

# Rebuild and restart
echo -e "${GREEN}🔨 Rebuilding containers...${NC}"
docker-compose build --no-cache

echo -e "${GREEN}🚀 Restarting services...${NC}"
docker-compose up -d

echo -e "${GREEN}⏳ Waiting for health checks...${NC}"
sleep 10

# Verify services are healthy
if docker-compose ps | grep -q "unhealthy\|Exit"; then
    echo -e "${YELLOW}⚠️  Some services may have issues. Rolling back...${NC}"
    ./scripts/docker-rollback.sh
    exit 1
fi

echo -e "${GREEN}✅ Update completed successfully!${NC}"
docker-compose ps
