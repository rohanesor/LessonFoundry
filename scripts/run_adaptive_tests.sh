#!/bin/bash
#
# Run Adaptive Learning Playwright Tests Locally
#
# This script starts the backend (API + worker) and frontend,
# then runs the Playwright tests for adaptive learning features.
#
# Usage:
#   ./scripts/run_adaptive_tests.sh
#
# Requirements:
#   - Python 3.12+ with venv activated
#   - Node.js 20+
#   - Backend dependencies installed
#   - Frontend dependencies installed
#   - Playwright browsers installed (npx playwright install chromium)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=============================================="
echo "Adaptive Learning Playwright Test Runner"
echo "=============================================="
echo ""

# Cleanup function
cleanup() {
    echo ""
    echo "Cleaning up..."
    # Kill background processes
    pkill -f "uvicorn app.main:app" 2>/dev/null || true
    pkill -f "python -m app.jobs.worker" 2>/dev/null || true
    pkill -f "next dev" 2>/dev/null || true
    echo "Cleanup complete."
}

trap cleanup EXIT

# Check if virtual environment is activated
if [[ -z "$VIRTUAL_ENV" ]]; then
    echo "⚠️  Warning: Python virtual environment not detected."
    echo "   Consider running: source .venv/bin/activate"
    echo ""
fi

# Set environment variables
export DATABASE_URL="sqlite:///${ROOT_DIR}/test-adaptive-e2e.sqlite3"
export AUTH_MODE="local"
export LLM_PROVIDER="mock"
export PYTHONPATH="${ROOT_DIR}/backend"

# Remove old test database
rm -f "${ROOT_DIR}/test-adaptive-e2e.sqlite3"

echo "Starting backend API server..."
cd "${ROOT_DIR}/backend"
uvicorn app.main:app --host 127.0.0.1 --port 8000 &
API_PID=$!
sleep 3

echo "Starting backend worker..."
python -m app.jobs.worker &
WORKER_PID=$!
sleep 2

echo "Starting frontend dev server..."
cd "${ROOT_DIR}/frontend"
npm run dev &
FRONTEND_PID=$!
sleep 8

# Wait for services
echo ""
echo "Waiting for services to be ready..."
for i in {1..30}; do
    if curl -s http://127.0.0.1:8000/api/health > /dev/null 2>&1; then
        echo "✓ Backend API ready"
        break
    fi
    sleep 1
done

for i in {1..30}; do
    if curl -s http://127.0.0.1:3000 > /dev/null 2>&1; then
        echo "✓ Frontend ready"
        break
    fi
    sleep 1
done

echo ""
echo "=============================================="
echo "Running Playwright Tests"
echo "=============================================="
echo ""

# Run Playwright tests
cd "${ROOT_DIR}/frontend"
npx playwright test adaptive-learning.spec.ts --reporter=list

echo ""
echo "=============================================="
echo "Tests Complete!"
echo "=============================================="
