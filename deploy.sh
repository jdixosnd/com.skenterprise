#!/bin/bash

################################################################################
# Textile Inventory System - Automated Deployment Script
# This script automates the deployment process on a fresh Ubuntu 22.04 server
################################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_error "Please do not run this script as root. Run as the textile user."
    exit 1
fi

################################################################################
# Configuration
################################################################################

print_info "Starting Textile Inventory deployment..."

# Prompt for configuration
read -p "Enter your domain name (e.g., example.com): " DOMAIN_NAME
read -p "Enter your email for SSL certificate: " SSL_EMAIL
read -sp "Enter PostgreSQL password for textile_user: " DB_PASSWORD
echo
read -p "Enter Django secret key (or press enter to generate): " SECRET_KEY

if [ -z "$SECRET_KEY" ]; then
    SECRET_KEY=$(python3 -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())")
    print_info "Generated secret key: $SECRET_KEY"
fi

APP_DIR="/home/textile/apps/textile-inventory"
BACKUP_DIR="/home/textile/backups"
LOGS_DIR="$APP_DIR/logs"

################################################################################
# Step 1: Update System
################################################################################

print_info "Step 1/10: Updating system packages..."
sudo apt update && sudo apt upgrade -y

################################################################################
# Step 2: Install Dependencies
################################################################################

print_info "Step 2/10: Installing system dependencies..."

# Install Python 3.11
sudo apt install software-properties-common -y
sudo add-apt-repository ppa:deadsnakes/ppa -y
sudo apt update
sudo apt install python3.11 python3.11-venv python3.11-dev -y

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Install Nginx
sudo apt install nginx -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install nodejs -y

# Install additional dependencies
sudo apt install -y \
    build-essential \
    libpq-dev \
    git \
    certbot \
    python3-certbot-nginx \
    libjpeg-dev \
    zlib1g-dev \
    fail2ban

print_info "All dependencies installed successfully"

################################################################################
# Step 3: Configure PostgreSQL
################################################################################

print_info "Step 3/10: Configuring PostgreSQL database..."

sudo -u postgres psql <<EOF
CREATE DATABASE textile_inventory;
CREATE USER textile_user WITH PASSWORD '$DB_PASSWORD';
ALTER USER textile_user CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE textile_inventory TO textile_user;
\c textile_inventory
GRANT ALL ON SCHEMA public TO textile_user;
ALTER DATABASE textile_inventory OWNER TO textile_user;
EOF

print_info "PostgreSQL database configured"

################################################################################
# Step 4: Setup Application Directories
################################################################################

print_info "Step 4/10: Setting up application directories..."

mkdir -p "$APP_DIR"
mkdir -p "$BACKUP_DIR"
mkdir -p "$LOGS_DIR"

print_info "Application directories created"

################################################################################
# Step 5: Backend Setup
################################################################################

print_info "Step 5/10: Setting up Django backend..."

cd "$APP_DIR/backend"

# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt

# Create production settings
cat > config/settings_production.py <<EOF
from .settings import *

DEBUG = False
ALLOWED_HOSTS = ['$DOMAIN_NAME', 'www.$DOMAIN_NAME']

SECRET_KEY = '$SECRET_KEY'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'textile_inventory',
        'USER': 'textile_user',
        'PASSWORD': '$DB_PASSWORD',
        'HOST': 'localhost',
        'PORT': '5432',
        'CONN_MAX_AGE': 600,
        'OPTIONS': {
            'connect_timeout': 10,
        }
    }
}

STATIC_URL = '/static/'
STATIC_ROOT = '$APP_DIR/backend/staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = '$APP_DIR/backend/media'

CORS_ALLOWED_ORIGINS = [
    'https://$DOMAIN_NAME',
    'https://www.$DOMAIN_NAME',
]
CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = [
    'https://$DOMAIN_NAME',
    'https://www.$DOMAIN_NAME',
]
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SECURE = True
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000
EOF

# Run migrations
export DJANGO_SETTINGS_MODULE=config.settings_production
python manage.py migrate

# Collect static files
python manage.py collectstatic --noinput

# Create superuser (interactive)
print_info "Please create a Django superuser account:"
python manage.py createsuperuser

deactivate

print_info "Backend setup complete"

################################################################################
# Step 6: Frontend Setup
################################################################################

print_info "Step 6/10: Setting up React frontend..."

cd "$APP_DIR/frontend"

# Install dependencies
npm install

# Create production environment
cat > .env.production <<EOF
REACT_APP_API_URL=https://$DOMAIN_NAME/api
REACT_APP_MEDIA_URL=https://$DOMAIN_NAME/media
EOF

# Build frontend
npm run build

print_info "Frontend setup complete"

################################################################################
# Step 7: Configure Nginx
################################################################################

print_info "Step 7/10: Configuring Nginx..."

sudo tee /etc/nginx/sites-available/textile-inventory > /dev/null <<'EOF'
upstream django_backend {
    server 127.0.0.1:8000;
}

server {
    listen 80;
    listen [::]:80;
    server_name DOMAIN_NAME_PLACEHOLDER www.DOMAIN_NAME_PLACEHOLDER;

    client_max_body_size 50M;

    location / {
        root APP_DIR_PLACEHOLDER/frontend/build;
        try_files $uri $uri/ /index.html;

        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    location /api/ {
        proxy_pass http://django_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
        proxy_connect_timeout 600;
        proxy_send_timeout 600;
        proxy_read_timeout 600;
    }

    location /admin/ {
        proxy_pass http://django_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /static/ {
        alias APP_DIR_PLACEHOLDER/backend/staticfiles/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /media/ {
        alias APP_DIR_PLACEHOLDER/backend/media/;
        expires 1y;
        add_header Cache-Control "public";
    }

    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
EOF

# Replace placeholders
sudo sed -i "s|DOMAIN_NAME_PLACEHOLDER|$DOMAIN_NAME|g" /etc/nginx/sites-available/textile-inventory
sudo sed -i "s|APP_DIR_PLACEHOLDER|$APP_DIR|g" /etc/nginx/sites-available/textile-inventory

# Enable site
sudo ln -sf /etc/nginx/sites-available/textile-inventory /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload Nginx
sudo nginx -t
sudo systemctl reload nginx

print_info "Nginx configured"

################################################################################
# Step 8: Setup Systemd Service
################################################################################

print_info "Step 8/10: Creating systemd service..."

sudo tee /etc/systemd/system/textile-inventory.service > /dev/null <<EOF
[Unit]
Description=Textile Inventory Django Application
After=network.target postgresql.service

[Service]
Type=notify
User=textile
Group=textile
WorkingDirectory=$APP_DIR/backend
Environment="DJANGO_SETTINGS_MODULE=config.settings_production"
Environment="PATH=$APP_DIR/backend/venv/bin"
ExecStart=$APP_DIR/backend/venv/bin/gunicorn \\
    --workers 4 \\
    --bind 127.0.0.1:8000 \\
    --timeout 120 \\
    --access-logfile $LOGS_DIR/gunicorn-access.log \\
    --error-logfile $LOGS_DIR/gunicorn-error.log \\
    --log-level info \\
    config.wsgi:application

Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Start and enable service
sudo systemctl daemon-reload
sudo systemctl start textile-inventory
sudo systemctl enable textile-inventory

# Check if service started successfully
if sudo systemctl is-active --quiet textile-inventory; then
    print_info "Systemd service started successfully"
else
    print_error "Service failed to start. Check logs with: sudo journalctl -u textile-inventory -n 50"
    exit 1
fi

################################################################################
# Step 9: Setup SSL Certificate
################################################################################

print_info "Step 9/10: Setting up SSL certificate..."

print_warning "Make sure your domain $DOMAIN_NAME points to this server's IP address"
read -p "Press enter to continue with SSL setup, or Ctrl+C to skip..."

sudo certbot --nginx -d "$DOMAIN_NAME" -d "www.$DOMAIN_NAME" --email "$SSL_EMAIL" --agree-tos --redirect

print_info "SSL certificate installed"

################################################################################
# Step 10: Setup Backups
################################################################################

print_info "Step 10/10: Setting up automated backups..."

# Create backup directories
mkdir -p "$BACKUP_DIR/database"
mkdir -p "$BACKUP_DIR/media"

# Database backup script
cat > "$BACKUP_DIR/backup-database.sh" <<EOF
#!/bin/bash
BACKUP_DIR="$BACKUP_DIR/database"
DB_NAME="textile_inventory"
DB_USER="textile_user"
RETENTION_DAYS=30

mkdir -p \$BACKUP_DIR
TIMESTAMP=\$(date +"%Y%m%d_%H%M%S")
PGPASSWORD='$DB_PASSWORD' pg_dump -U \$DB_USER -h localhost \$DB_NAME | gzip > "\$BACKUP_DIR/backup_\$TIMESTAMP.sql.gz"
find \$BACKUP_DIR -name "backup_*.sql.gz" -mtime +\$RETENTION_DAYS -delete
echo "\$(date): Database backup completed: backup_\$TIMESTAMP.sql.gz" >> $BACKUP_DIR/backup.log
EOF

# Media backup script
cat > "$BACKUP_DIR/backup-media.sh" <<EOF
#!/bin/bash
BACKUP_DIR="$BACKUP_DIR/media"
MEDIA_DIR="$APP_DIR/backend/media"
RETENTION_DAYS=30

mkdir -p \$BACKUP_DIR
TIMESTAMP=\$(date +"%Y%m%d_%H%M%S")
tar -czf "\$BACKUP_DIR/media_\$TIMESTAMP.tar.gz" -C \$(dirname \$MEDIA_DIR) \$(basename \$MEDIA_DIR)
find \$BACKUP_DIR -name "media_*.tar.gz" -mtime +\$RETENTION_DAYS -delete
echo "\$(date): Media files backup completed: media_\$TIMESTAMP.tar.gz" >> $BACKUP_DIR/backup.log
EOF

chmod +x "$BACKUP_DIR/backup-database.sh"
chmod +x "$BACKUP_DIR/backup-media.sh"

# Setup cron jobs
(crontab -l 2>/dev/null; echo "0 2 * * * $BACKUP_DIR/backup-database.sh") | crontab -
(crontab -l 2>/dev/null; echo "0 3 * * 0 $BACKUP_DIR/backup-media.sh") | crontab -

print_info "Backup scripts created and cron jobs scheduled"

################################################################################
# Configure Firewall
################################################################################

print_info "Configuring firewall..."

sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

################################################################################
# Configure Fail2Ban
################################################################################

print_info "Configuring fail2ban..."

sudo tee /etc/fail2ban/jail.local > /dev/null <<EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = 22
logpath = %(sshd_log)s

[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log
EOF

sudo systemctl restart fail2ban
sudo systemctl enable fail2ban

################################################################################
# Deployment Complete
################################################################################

print_info "============================================"
print_info "Deployment completed successfully!"
print_info "============================================"
echo ""
print_info "Application URL: https://$DOMAIN_NAME"
print_info "Admin Panel: https://$DOMAIN_NAME/admin/"
echo ""
print_info "Service management commands:"
echo "  sudo systemctl status textile-inventory"
echo "  sudo systemctl restart textile-inventory"
echo "  sudo systemctl stop textile-inventory"
echo ""
print_info "View logs:"
echo "  sudo journalctl -u textile-inventory -f"
echo "  tail -f $LOGS_DIR/gunicorn-error.log"
echo ""
print_info "Backup locations:"
echo "  Database: $BACKUP_DIR/database/"
echo "  Media: $BACKUP_DIR/media/"
echo ""
print_info "Next steps:"
echo "  1. Visit https://$DOMAIN_NAME to access the application"
echo "  2. Visit https://$DOMAIN_NAME/admin/ to access the admin panel"
echo "  3. Test creating an inward lot and program"
echo "  4. Verify backups are running (check tomorrow)"
echo ""
print_warning "Remember to save your credentials securely!"
echo ""
