#!/bin/bash

# ============================================
# Docker Start Script
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Layout Manager...${NC}"

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from template...${NC}"
    cp .env.docker.example .env
    echo -e "${RED}❌ Please configure .env file before starting!${NC}"
    echo -e "   Edit the following required values:"
    echo -e "   - DB_PASSWORD"
    echo -e "   - VITE_JWT_SECRET"
    exit 1
fi

# Check required variables
source .env
if [ -z "$DB_PASSWORD" ] || [ "$DB_PASSWORD" = "your_secure_password_here" ]; then
    echo -e "${RED}❌ DB_PASSWORD is not configured in .env${NC}"
    exit 1
fi

if [ -z "$VITE_JWT_SECRET" ] || [ "$VITE_JWT_SECRET" = "your_jwt_secret_here_change_this" ]; then
    echo -e "${RED}❌ VITE_JWT_SECRET is not configured in .env${NC}"
    echo -e "   Generate one with: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\""
    exit 1
fi

# Build and start containers
echo -e "${GREEN}📦 Building containers...${NC}"
docker-compose build

echo -e "${GREEN}🐳 Starting services...${NC}"
docker-compose up -d

echo -e "${GREEN}⏳ Waiting for services to be healthy...${NC}"
sleep 5

# Check service status
if docker-compose ps | grep -q "unhealthy\|Exit"; then
    echo -e "${RED}❌ Some services failed to start. Check logs:${NC}"
    docker-compose logs --tail=50
    exit 1
fi

echo -e "${GREEN}✅ All services started successfully!${NC}"
echo ""
echo -e "📊 Service Status:"
docker-compose ps
echo ""
echo -e "🌐 Access the application at: http://localhost:${FRONTEND_PORT:-80}"
echo -e "📝 View logs with: docker-compose logs -f"
