#!/bin/bash

# Textile Inventory System - Server Startup Script
# This script starts both Django backend and React frontend

echo "=========================================="
echo "Textile Inventory System - Starting..."
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Get IP address
IP_ADDRESS=$(hostname -I | awk '{print $1}')
echo -e "${BLUE}Your IP Address: ${GREEN}$IP_ADDRESS${NC}"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Stopping servers...${NC}"
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "Servers stopped."
    exit 0
}

# Trap Ctrl+C
trap cleanup INT TERM

# Check if Django is available
if ! command -v python &> /dev/null; then
    echo "Error: Python not found. Please install Python first."
    exit 1
fi

# Check if Node.js is available
if ! command -v npm &> /dev/null; then
    echo "Error: npm not found. Please install Node.js first."
    exit 1
fi

echo -e "${BLUE}Step 1: Starting Django Backend...${NC}"
echo "Backend URL: http://$IP_ADDRESS:8000"
echo "Admin URL: http://$IP_ADDRESS:8000/admin"
echo ""

# Start Django backend in background
python manage.py runserver 0.0.0.0:8000 > backend.log 2>&1 &
BACKEND_PID=$!

# Wait a bit for backend to start
sleep 3

# Check if backend started successfully
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${YELLOW}Warning: Backend may have failed to start. Check backend.log${NC}"
else
    echo -e "${GREEN}✓ Backend started successfully (PID: $BACKEND_PID)${NC}"
fi

echo ""
echo -e "${BLUE}Step 2: Starting React Frontend...${NC}"
echo "Frontend URL: http://$IP_ADDRESS:3000"
echo ""

# Start React frontend in background
cd frontend
npm run dev -- --host 0.0.0.0 --port 3000 > ../frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Wait a bit for frontend to start
sleep 3

# Check if frontend started successfully
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo -e "${YELLOW}Warning: Frontend may have failed to start. Check frontend.log${NC}"
else
    echo -e "${GREEN}✓ Frontend started successfully (PID: $FRONTEND_PID)${NC}"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}Servers are running!${NC}"
echo "=========================================="
echo ""
echo "Access the application:"
echo -e "  ${BLUE}Frontend:${NC} http://$IP_ADDRESS:3000"
echo -e "  ${BLUE}Admin Panel:${NC} http://$IP_ADDRESS:8000/admin"
echo -e "  ${BLUE}API:${NC} http://$IP_ADDRESS:8000/api/"
echo ""
echo "From other devices on your network, use:"
echo -e "  http://$IP_ADDRESS:3000"
echo ""
echo "Logs are being written to:"
echo "  - backend.log"
echo "  - frontend.log"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop both servers${NC}"
echo ""

# Keep script running and show logs
tail -f backend.log frontend.log &
TAIL_PID=$!

# Wait for user interrupt
wait $BACKEND_PID $FRONTEND_PID
