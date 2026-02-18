# Textile Inventory System - Production Deployment Guide

## Table of Contents
1. [Server Requirements](#server-requirements)
2. [Initial Server Setup](#initial-server-setup)
3. [Install System Dependencies](#install-system-dependencies)
4. [PostgreSQL Database Setup](#postgresql-database-setup)
5. [Application Deployment](#application-deployment)
6. [Nginx Configuration](#nginx-configuration)
7. [SSL Certificate Setup](#ssl-certificate-setup)
8. [Systemd Service Configuration](#systemd-service-configuration)
9. [Security Hardening](#security-hardening)
10. [Backup Strategy](#backup-strategy)
11. [Monitoring & Maintenance](#monitoring--maintenance)
12. [Troubleshooting](#troubleshooting)

---

## Server Requirements

### Minimum Specifications
- **CPU:** 2 vCPU cores
- **RAM:** 4 GB
- **Storage:** 40 GB SSD
- **OS:** Ubuntu 22.04 LTS (recommended)
- **Network:** Static IP address with open ports 80 (HTTP) and 443 (HTTPS)

### Recommended Specifications (for production)
- **CPU:** 4 vCPU cores
- **RAM:** 8 GB
- **Storage:** 80 GB SSD
- **Bandwidth:** Unmetered or at least 2 TB/month

---

## Initial Server Setup

### 1. Connect to Your VPC Server

```bash
ssh root@your_server_ip
```

### 2. Update System Packages

```bash
apt update && apt upgrade -y
```

### 3. Create Application User

```bash
# Create a dedicated user for the application
adduser textile --disabled-password --gecos ""

# Add user to sudo group
usermod -aG sudo textile

# Set password for the user
passwd textile
```

### 4. Configure SSH Access

```bash
# Copy SSH keys to new user (if using key-based auth)
rsync --archive --chown=textile:textile ~/.ssh /home/textile

# Test login as textile user in a new terminal
ssh textile@your_server_ip
```

### 5. Configure Firewall

```bash
# Install UFW (Uncomplicated Firewall)
apt install ufw -y

# Allow SSH, HTTP, and HTTPS
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp

# Enable firewall
ufw enable

# Check status
ufw status
```

---

## Install System Dependencies

### 1. Install Python 3.11

```bash
# Add deadsnakes PPA for latest Python
apt install software-properties-common -y
add-apt-repository ppa:deadsnakes/ppa -y
apt update

# Install Python 3.11
apt install python3.11 python3.11-venv python3.11-dev -y

# Set Python 3.11 as default
update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1
```

### 2. Install PostgreSQL

```bash
# Install PostgreSQL 15
apt install postgresql postgresql-contrib -y

# Start and enable PostgreSQL
systemctl start postgresql
systemctl enable postgresql
```

### 3. Install Nginx

```bash
apt install nginx -y
systemctl enable nginx
```

### 4. Install Node.js and npm

```bash
# Install Node.js 20.x LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install nodejs -y

# Verify installation
node --version  # Should show v20.x.x
npm --version
```

### 5. Install Additional Dependencies

```bash
# Install build essentials and other dependencies
apt install -y \
    build-essential \
    libpq-dev \
    git \
    supervisor \
    certbot \
    python3-certbot-nginx \
    libjpeg-dev \
    zlib1g-dev
```

---

## PostgreSQL Database Setup

### 1. Create Database and User

```bash
# Switch to postgres user
sudo -i -u postgres

# Create database
createdb textile_inventory

# Access PostgreSQL prompt
psql

# Inside psql prompt:
CREATE USER textile_user WITH PASSWORD 'your_secure_password_here';
ALTER USER textile_user CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE textile_inventory TO textile_user;
\c textile_inventory
GRANT ALL ON SCHEMA public TO textile_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO textile_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO textile_user;
ALTER DATABASE textile_inventory OWNER TO textile_user;
\q

# Exit postgres user
exit
```

### 2. Configure PostgreSQL for Remote Access (if needed)

```bash
# Edit postgresql.conf
nano /etc/postgresql/15/main/postgresql.conf

# Find and modify:
listen_addresses = 'localhost'  # Keep as localhost for security

# Edit pg_hba.conf for local connections
nano /etc/postgresql/15/main/pg_hba.conf

# Add this line if not present:
local   all             textile_user                            md5

# Restart PostgreSQL
systemctl restart postgresql
```

---

## Application Deployment

### 1. Clone Repository

```bash
# Switch to textile user
su - textile

# Create application directory
mkdir -p /home/textile/apps
cd /home/textile/apps

# Clone your repository
git clone <your-repository-url> textile-inventory
cd textile-inventory

# Or if deploying from local machine, use scp:
# scp -r /path/to/inventory textile@your_server_ip:/home/textile/apps/textile-inventory
```

### 2. Backend Setup

```bash
cd /home/textile/apps/textile-inventory/backend

# Create virtual environment
python3.11 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt

# If requirements.txt doesn't exist, install manually:
pip install django==4.2.28 \
    djangorestframework \
    django-cors-headers \
    django-filter \
    psycopg2-binary \
    pillow \
    reportlab \
    openpyxl \
    gunicorn
```

### 3. Configure Django Settings

```bash
# Create production settings file
nano /home/textile/apps/textile-inventory/backend/config/settings_production.py
```

Add the following content:

```python
from .settings import *

# SECURITY SETTINGS
DEBUG = False
ALLOWED_HOSTS = ['your-domain.com', 'www.your-domain.com', 'your_server_ip']

# Generate a new secret key
# python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
SECRET_KEY = 'your-generated-secret-key-here'

# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'textile_inventory',
        'USER': 'textile_user',
        'PASSWORD': 'your_secure_password_here',
        'HOST': 'localhost',
        'PORT': '5432',
        'CONN_MAX_AGE': 600,
        'OPTIONS': {
            'connect_timeout': 10,
        }
    }
}

# Static files
STATIC_URL = '/static/'
STATIC_ROOT = '/home/textile/apps/textile-inventory/backend/staticfiles'

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = '/home/textile/apps/textile-inventory/backend/media'

# CORS settings (update with your domain)
CORS_ALLOWED_ORIGINS = [
    'https://your-domain.com',
    'https://www.your-domain.com',
]
CORS_ALLOW_CREDENTIALS = True

# CSRF settings
CSRF_TRUSTED_ORIGINS = [
    'https://your-domain.com',
    'https://www.your-domain.com',
]
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_SAMESITE = 'Lax'

# Session settings
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'

# Security headers
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

# HTTPS redirect (enable after SSL is set up)
# SECURE_SSL_REDIRECT = True
# SECURE_HSTS_SECONDS = 31536000
# SECURE_HSTS_INCLUDE_SUBDOMAINS = True
# SECURE_HSTS_PRELOAD = True
```

### 4. Run Database Migrations

```bash
cd /home/textile/apps/textile-inventory/backend
source venv/bin/activate

# Set production settings
export DJANGO_SETTINGS_MODULE=config.settings_production

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Collect static files
python manage.py collectstatic --noinput
```

### 5. Load Initial Data (if migrating from existing database)

```bash
# If you have a backup from SQLite
python manage.py loaddata /path/to/data_backup.json
```

### 6. Frontend Setup

```bash
cd /home/textile/apps/textile-inventory/frontend

# Install dependencies
npm install

# Create production environment file
nano .env.production
```

Add the following:

```env
REACT_APP_API_URL=https://your-domain.com/api
REACT_APP_MEDIA_URL=https://your-domain.com/media
```

```bash
# Build the frontend
npm run build

# The build folder will contain the production-ready files
```

---

## Nginx Configuration

### 1. Create Nginx Configuration File

```bash
sudo nano /etc/nginx/sites-available/textile-inventory
```

Add the following configuration:

```nginx
# Upstream for Django application
upstream django_backend {
    server 127.0.0.1:8000;
}

# HTTP server (will redirect to HTTPS after SSL is set up)
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com www.your-domain.com;

    # Temporary: serve the site over HTTP
    # After SSL setup, this will redirect to HTTPS

    client_max_body_size 50M;

    # Serve React frontend
    location / {
        root /home/textile/apps/textile-inventory/frontend/build;
        try_files $uri $uri/ /index.html;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Django API
    location /api/ {
        proxy_pass http://django_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;

        # Timeouts for large file uploads
        proxy_connect_timeout 600;
        proxy_send_timeout 600;
        proxy_read_timeout 600;
    }

    # Django admin
    location /admin/ {
        proxy_pass http://django_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Django static files
    location /static/ {
        alias /home/textile/apps/textile-inventory/backend/staticfiles/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Django media files
    location /media/ {
        alias /home/textile/apps/textile-inventory/backend/media/;
        expires 1y;
        add_header Cache-Control "public";
    }

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

### 2. Enable the Site

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/textile-inventory /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## SSL Certificate Setup

### 1. Install SSL Certificate with Let's Encrypt

```bash
# Make sure your domain is pointing to your server IP
# Then run certbot
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Follow the prompts:
# - Enter your email address
# - Agree to terms of service
# - Choose to redirect HTTP to HTTPS (option 2)
```

### 2. Auto-renewal Test

```bash
# Test automatic renewal
sudo certbot renew --dry-run

# Certbot will automatically renew certificates before they expire
```

### 3. Update Django Settings for HTTPS

```bash
nano /home/textile/apps/textile-inventory/backend/config/settings_production.py
```

Uncomment these lines:

```python
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
```

---

## Systemd Service Configuration

### 1. Create Gunicorn Service

```bash
sudo nano /etc/systemd/system/textile-inventory.service
```

Add the following:

```ini
[Unit]
Description=Textile Inventory Django Application
After=network.target postgresql.service

[Service]
Type=notify
User=textile
Group=textile
WorkingDirectory=/home/textile/apps/textile-inventory/backend
Environment="DJANGO_SETTINGS_MODULE=config.settings_production"
Environment="PATH=/home/textile/apps/textile-inventory/backend/venv/bin"
ExecStart=/home/textile/apps/textile-inventory/backend/venv/bin/gunicorn \
    --workers 4 \
    --bind 127.0.0.1:8000 \
    --timeout 120 \
    --access-logfile /home/textile/apps/textile-inventory/logs/gunicorn-access.log \
    --error-logfile /home/textile/apps/textile-inventory/logs/gunicorn-error.log \
    --log-level info \
    config.wsgi:application

Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 2. Create Log Directory

```bash
# Create logs directory
mkdir -p /home/textile/apps/textile-inventory/logs
chown textile:textile /home/textile/apps/textile-inventory/logs
```

### 3. Start and Enable Service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Start the service
sudo systemctl start textile-inventory

# Enable service to start on boot
sudo systemctl enable textile-inventory

# Check status
sudo systemctl status textile-inventory
```

---

## Security Hardening

### 1. Configure SSH

```bash
sudo nano /etc/ssh/sshd_config
```

Update the following:

```bash
# Disable root login
PermitRootLogin no

# Use key-based authentication only
PasswordAuthentication no
PubkeyAuthentication yes

# Change default SSH port (optional but recommended)
Port 2222  # Use a non-standard port
```

```bash
# Restart SSH
sudo systemctl restart sshd

# Update firewall if you changed the port
sudo ufw allow 2222/tcp
sudo ufw delete allow 22/tcp
```

### 2. Configure Fail2Ban

```bash
# Install fail2ban
sudo apt install fail2ban -y

# Create local configuration
sudo nano /etc/fail2ban/jail.local
```

Add:

```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = 2222  # Use your SSH port
logpath = %(sshd_log)s

[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log
```

```bash
# Start and enable fail2ban
sudo systemctl start fail2ban
sudo systemctl enable fail2ban
```

### 3. Set Up Automatic Security Updates

```bash
sudo apt install unattended-upgrades -y
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

---

## Backup Strategy

### 1. Database Backup Script

```bash
# Create backup directory
mkdir -p /home/textile/backups

# Create backup script
nano /home/textile/backups/backup-database.sh
```

Add:

```bash
#!/bin/bash

# Configuration
BACKUP_DIR="/home/textile/backups/database"
DB_NAME="textile_inventory"
DB_USER="textile_user"
RETENTION_DAYS=30

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Generate timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Create backup
PGPASSWORD='your_secure_password_here' pg_dump -U $DB_USER -h localhost $DB_NAME | gzip > "$BACKUP_DIR/backup_$TIMESTAMP.sql.gz"

# Remove old backups
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

# Log
echo "$(date): Database backup completed: backup_$TIMESTAMP.sql.gz" >> /home/textile/backups/backup.log
```

```bash
# Make executable
chmod +x /home/textile/backups/backup-database.sh
```

### 2. Media Files Backup Script

```bash
nano /home/textile/backups/backup-media.sh
```

Add:

```bash
#!/bin/bash

# Configuration
BACKUP_DIR="/home/textile/backups/media"
MEDIA_DIR="/home/textile/apps/textile-inventory/backend/media"
RETENTION_DAYS=30

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Generate timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Create backup
tar -czf "$BACKUP_DIR/media_$TIMESTAMP.tar.gz" -C $(dirname $MEDIA_DIR) $(basename $MEDIA_DIR)

# Remove old backups
find $BACKUP_DIR -name "media_*.tar.gz" -mtime +$RETENTION_DAYS -delete

# Log
echo "$(date): Media files backup completed: media_$TIMESTAMP.tar.gz" >> /home/textile/backups/backup.log
```

```bash
# Make executable
chmod +x /home/textile/backups/backup-media.sh
```

### 3. Set Up Cron Jobs

```bash
crontab -e
```

Add:

```bash
# Daily database backup at 2 AM
0 2 * * * /home/textile/backups/backup-database.sh

# Weekly media backup every Sunday at 3 AM
0 3 * * 0 /home/textile/backups/backup-media.sh
```

---

## Monitoring & Maintenance

### 1. Monitor Application Logs

```bash
# Watch Gunicorn logs
tail -f /home/textile/apps/textile-inventory/logs/gunicorn-error.log

# Watch Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Check Django service status
sudo systemctl status textile-inventory
```

### 2. Monitor System Resources

```bash
# Install htop
sudo apt install htop -y

# Monitor resources
htop

# Check disk usage
df -h

# Check database size
sudo -u postgres psql -c "SELECT pg_size_pretty(pg_database_size('textile_inventory'));"
```

### 3. Update Application

```bash
# Script to update the application
nano /home/textile/update-app.sh
```

Add:

```bash
#!/bin/bash

echo "Starting application update..."

cd /home/textile/apps/textile-inventory

# Pull latest changes
git pull origin main

# Update backend
cd backend
source venv/bin/activate
pip install -r requirements.txt --upgrade
python manage.py migrate
python manage.py collectstatic --noinput
deactivate

# Update frontend
cd ../frontend
npm install
npm run build

# Restart services
sudo systemctl restart textile-inventory
sudo systemctl reload nginx

echo "Application updated successfully!"
```

```bash
# Make executable
chmod +x /home/textile/update-app.sh
```

---

## Troubleshooting

### Common Issues and Solutions

#### 1. 502 Bad Gateway Error

**Cause:** Gunicorn service not running

```bash
# Check service status
sudo systemctl status textile-inventory

# View logs
sudo journalctl -u textile-inventory -n 50

# Restart service
sudo systemctl restart textile-inventory
```

#### 2. Static Files Not Loading

```bash
# Re-collect static files
cd /home/textile/apps/textile-inventory/backend
source venv/bin/activate
python manage.py collectstatic --noinput

# Check permissions
sudo chown -R textile:textile /home/textile/apps/textile-inventory/backend/staticfiles
```

#### 3. Database Connection Error

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test database connection
sudo -u postgres psql -U textile_user -d textile_inventory -h localhost

# Check database credentials in settings_production.py
```

#### 4. Permission Denied Errors

```bash
# Fix ownership
sudo chown -R textile:textile /home/textile/apps/textile-inventory

# Fix media directory permissions
sudo chmod -R 755 /home/textile/apps/textile-inventory/backend/media
```

#### 5. High Memory Usage

```bash
# Reduce Gunicorn workers
sudo nano /etc/systemd/system/textile-inventory.service

# Change --workers 4 to --workers 2
# Then restart
sudo systemctl daemon-reload
sudo systemctl restart textile-inventory
```

---

## Performance Optimization

### 1. Enable Nginx Caching

```bash
sudo nano /etc/nginx/nginx.conf
```

Add inside http block:

```nginx
# Cache configuration
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=textile_cache:10m max_size=1g inactive=60m use_temp_path=off;
```

Update site configuration:

```nginx
location /api/ {
    proxy_cache textile_cache;
    proxy_cache_valid 200 10m;
    proxy_cache_bypass $http_pragma $http_authorization;
    # ... rest of proxy settings
}
```

### 2. Database Connection Pooling

Already configured in settings with `CONN_MAX_AGE = 600`

### 3. Enable Gzip Compression

```bash
sudo nano /etc/nginx/nginx.conf
```

Ensure these are uncommented:

```nginx
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;
gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;
```

---

## Post-Deployment Checklist

- [ ] Server accessible via SSH
- [ ] Firewall configured (ports 80, 443, SSH open)
- [ ] PostgreSQL installed and database created
- [ ] Django application running via Gunicorn
- [ ] Frontend built and served by Nginx
- [ ] SSL certificate installed and HTTPS working
- [ ] Domain pointing to server IP
- [ ] Systemd service enabled and running
- [ ] Database backups scheduled
- [ ] Media backups scheduled
- [ ] Fail2ban configured
- [ ] Application accessible via domain
- [ ] Admin panel accessible
- [ ] Test creating inward lot
- [ ] Test creating program
- [ ] Test generating bill
- [ ] Test exporting ledger
- [ ] Monitoring logs working

---

## Support and Maintenance

### Regular Maintenance Tasks

**Daily:**
- Check application logs for errors
- Monitor disk space

**Weekly:**
- Review access logs
- Check backup success
- Update system packages: `sudo apt update && sudo apt upgrade`

**Monthly:**
- Review fail2ban logs
- Test backup restoration
- Check SSL certificate expiry

**Quarterly:**
- Review and optimize database
- Update application dependencies
- Security audit

---

## Contact Information

For issues or questions:
- Application logs: `/home/textile/apps/textile-inventory/logs/`
- System logs: `/var/log/nginx/` and `journalctl -u textile-inventory`
- Database: `sudo -u postgres psql textile_inventory`

---

**Document Version:** 1.0
**Last Updated:** February 2026
**Maintained By:** Textile Inventory Team
