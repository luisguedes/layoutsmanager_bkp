#!/bin/bash

# ============================================
# Database Restore Script
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
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check for backup file argument
BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
    echo -e "${YELLOW}Available backups:${NC}"
    ls -lh "$BACKUP_DIR"/*.sql.gz 2>/dev/null || echo "No backups found"
    echo ""
    echo "Usage: $0 <backup_file.sql.gz>"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ Backup file not found: $BACKUP_FILE${NC}"
    exit 1
fi

echo -e "${YELLOW}⚠️  WARNING: This will overwrite the current database!${NC}"
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

echo -e "${GREEN}📦 Restoring database from: $BACKUP_FILE${NC}"

# Decompress and restore
gunzip -c "$BACKUP_FILE" | docker-compose exec -T postgres psql \
    -U ${DB_USER:-postgres} \
    -d ${DB_NAME:-layout_app}

echo -e "${GREEN}✅ Database restored successfully!${NC}"
