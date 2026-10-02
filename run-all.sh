#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "=================================================="
echo "    Starting Smart-Weigh Management System       "
echo "=================================================="

# 0. Check root dependencies
if [ ! -d "node_modules" ]; then
    echo "[Root] Installing root orchestrator dependencies..."
    npm install
fi

# 1. Check Python backend virtualenv
if [ ! -d "backend/.venv" ]; then
    echo "[Backend] Creating Python virtual environment..."
    uv venv backend/.venv
fi

# Ensure requirements installed
echo "[Backend] Verifying dependencies..."
uv pip install -q -r backend/requirements.txt --python backend/.venv/bin/python

# Apply migrations
echo "[Backend] Running database migrations..."
backend/.venv/bin/python backend/manage.py migrate --noinput

# 2. Check frontend dependencies
if [ ! -d "frontend/node_modules" ]; then
    echo "[Frontend] Installing npm packages..."
    cd frontend && npm install && cd ..
fi

echo ""
echo "Starting Django API backend on :8000 and Tauri desktop app..."
echo "=================================================="

npm run dev
