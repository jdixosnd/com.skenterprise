#!/bin/bash

###############################################################################
# Deployment Script for Textile Inventory System
# Run this script on EC2 after initial setup to deploy updates
###############################################################################

set -e  # Exit on any error

echo "========================================="
echo "Starting Deployment Process..."
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as correct user
if [ "$USER" != "ubuntu" ]; then
    echo -e "${RED}Error: This script should be run as ubuntu user${NC}"
    exit 1
fi

# Set working directory
cd /var/www/inventory

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo -e "${RED}Error: .env.production file not found!${NC}"
    echo "Please create it from .env.production.template"
    exit 1
fi

# Load environment variables
export $(cat .env.production | xargs)

echo -e "${YELLOW}[1/9] Pulling latest code from repository...${NC}"
git pull origin main

echo -e "${YELLOW}[2/9] Activating virtual environment...${NC}"
source venv/bin/activate

echo -e "${YELLOW}[3/9] Installing Python dependencies...${NC}"
pip install --upgrade pip
pip install -r requirements.txt

echo -e "${YELLOW}[4/9] Building React frontend...${NC}"
cd frontend
npm install
npm run build
cd ..

echo -e "${YELLOW}[5/9] Running database migrations...${NC}"
python manage.py migrate --settings=config.settings_production

echo -e "${YELLOW}[6/9] Collecting static files...${NC}"
python manage.py collectstatic --noinput --settings=config.settings_production

echo -e "${YELLOW}[7/9] Running Django checks...${NC}"
python manage.py check --settings=config.settings_production

echo -e "${YELLOW}[8/9] Restarting Gunicorn service...${NC}"
sudo systemctl restart gunicorn

echo -e "${YELLOW}[9/9] Restarting Nginx service...${NC}"
sudo systemctl restart nginx

# Check service status
echo ""
echo "========================================="
echo "Checking Service Status..."
echo "========================================="

if systemctl is-active --quiet gunicorn; then
    echo -e "${GREEN}✓ Gunicorn is running${NC}"
else
    echo -e "${RED}✗ Gunicorn is not running${NC}"
    echo "Check logs: sudo journalctl -u gunicorn -n 50"
fi

if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓ Nginx is running${NC}"
else
    echo -e "${RED}✗ Nginx is not running${NC}"
    echo "Check logs: sudo tail -f /var/log/nginx/error.log"
fi

echo ""
echo "========================================="
echo -e "${GREEN}Deployment Complete!${NC}"
echo "========================================="
echo ""
echo "Application URL: https://$DOMAIN_NAME"
echo ""
echo "Useful commands:"
echo "  - View logs: sudo journalctl -u gunicorn -f"
echo "  - Check status: sudo systemctl status gunicorn nginx"
echo "  - Django shell: python manage.py shell --settings=config.settings_production"
echo ""
