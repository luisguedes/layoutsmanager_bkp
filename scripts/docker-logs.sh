#!/bin/bash

# ============================================
# Docker Logs Script
# ============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Default to following all logs
SERVICE=${1:-""}
LINES=${2:-100}

if [ -n "$SERVICE" ]; then
    docker-compose logs -f --tail=$LINES $SERVICE
else
    docker-compose logs -f --tail=$LINES
fi
