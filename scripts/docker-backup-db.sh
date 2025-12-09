#!/bin/bash

# ============================================
# Database Backup Script
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/backups"

cd "$PROJECT_DIR"

# Load environment
source .env

# Colors
GREEN='\033[0;32m'
NC='\033[0m'

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Generate backup filename with timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/layout_db_$TIMESTAMP.sql"

echo -e "${GREEN}📦 Creating database backup...${NC}"

# Create backup
docker-compose exec -T postgres pg_dump \
    -U ${DB_USER:-postgres} \
    -d ${DB_NAME:-layout_app} \
    --clean \
    --if-exists \
    > "$BACKUP_FILE"

# Compress backup
gzip "$BACKUP_FILE"

echo -e "${GREEN}✅ Backup created: ${BACKUP_FILE}.gz${NC}"

# Keep only last 7 backups
echo -e "${GREEN}🧹 Cleaning old backups...${NC}"
ls -t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | tail -n +8 | xargs -r rm

echo -e "${GREEN}✅ Backup completed!${NC}"
ls -lh "$BACKUP_DIR"/*.sql.gz | tail -5
