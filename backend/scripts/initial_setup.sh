#!/bin/bash

###############################################################################
# Initial Setup Script for EC2 Instance
# Run this script ONCE on a fresh EC2 instance
###############################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "========================================="
echo "Textile Inventory System - Initial Setup"
echo "========================================="
echo ""

# Check if running as ubuntu user
if [ "$USER" != "ubuntu" ]; then
    echo -e "${RED}Error: This script should be run as ubuntu user${NC}"
    echo "Run: sudo su - ubuntu"
    exit 1
fi

# Update system
echo -e "${BLUE}[1/12] Updating system packages...${NC}"
sudo apt update && sudo apt upgrade -y

# Install Python 3.11
echo -e "${BLUE}[2/12] Installing Python 3.11...${NC}"
sudo apt install -y python3.11 python3.11-venv python3-pip

# Install PostgreSQL client
echo -e "${BLUE}[3/12] Installing PostgreSQL client...${NC}"
sudo apt install -y postgresql-client libpq-dev

# Install Nginx
echo -e "${BLUE}[4/12] Installing Nginx...${NC}"
sudo apt install -y nginx

# Install Node.js 20.x
echo -e "${BLUE}[5/12] Installing Node.js...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Git
echo -e "${BLUE}[6/12] Installing Git...${NC}"
sudo apt install -y git

# Install system utilities
echo -e "${BLUE}[7/12] Installing system utilities...${NC}"
sudo apt install -y htop tmux curl wget unzip build-essential

# Configure firewall
echo -e "${BLUE}[8/12] Configuring UFW firewall...${NC}"
sudo ufw --force enable
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw status

# Create application directory
echo -e "${BLUE}[9/12] Creating application directory...${NC}"
sudo mkdir -p /var/www
sudo chown -R ubuntu:ubuntu /var/www

# Create logs directory
echo -e "${BLUE}[10/12] Creating logs directory...${NC}"
mkdir -p ~/logs

# Install Certbot for SSL
echo -e "${BLUE}[11/12] Installing Certbot...${NC}"
sudo apt install -y certbot python3-certbot-nginx

# System optimization
echo -e "${BLUE}[12/12] Applying system optimizations...${NC}"

# Increase file descriptors limit
echo "* soft nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "* hard nofile 65536" | sudo tee -a /etc/security/limits.conf

# Configure kernel parameters
echo "net.core.somaxconn = 1024" | sudo tee -a /etc/sysctl.conf
echo "net.ipv4.tcp_max_syn_backlog = 2048" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

echo ""
echo "========================================="
echo -e "${GREEN}Initial Setup Complete!${NC}"
echo "========================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Upload your application code:"
echo "   scp -i key.pem -r /local/path/inventory ubuntu@YOUR_EC2_IP:/var/www/"
echo ""
echo "2. Or clone from Git:"
echo "   cd /var/www"
echo "   git clone https://github.com/your-repo/inventory.git"
echo ""
echo "3. Configure environment:"
echo "   cd /var/www/inventory"
echo "   cp .env.production.template .env.production"
echo "   nano .env.production  # Fill in your values"
echo ""
echo "4. Setup Python environment:"
echo "   python3.11 -m venv venv"
echo "   source venv/bin/activate"
echo "   pip install -r requirements.txt"
echo ""
echo "5. Build frontend:"
echo "   cd frontend"
echo "   npm install"
echo "   npm run build"
echo ""
echo "6. Setup Django:"
echo "   cd /var/www/inventory"
echo "   export \$(cat .env.production | xargs)"
echo "   python manage.py migrate --settings=config.settings_production"
echo "   python manage.py collectstatic --noinput --settings=config.settings_production"
echo "   python manage.py createsuperuser --settings=config.settings_production"
echo ""
echo "7. Configure Gunicorn and Nginx:"
echo "   Follow DEPLOYMENT_GUIDE.md Phase 6 and Phase 7"
echo ""
echo "Reboot recommended to apply all changes:"
echo "   sudo reboot"
echo ""
