# Textile Inventory - Quick Deployment Guide

This is a condensed version of the full deployment guide. For detailed instructions, see `DEPLOYMENT.md`.

## Prerequisites

- Fresh Ubuntu 22.04 VPS/Server
- Domain name pointing to server IP
- Root/sudo access
- Email address for SSL certificate

## Option 1: Automated Deployment (Recommended)

```bash
# 1. SSH into server as root
ssh root@your_server_ip

# 2. Create textile user
adduser textile --disabled-password --gecos ""
usermod -aG sudo textile
passwd textile

# 3. Copy your repository to the server
# On your local machine:
scp -r /home/sohel/code/inventory textile@your_server_ip:/home/textile/apps/textile-inventory

# 4. SSH as textile user
ssh textile@your_server_ip

# 5. Run automated deployment script
cd /home/textile/apps/textile-inventory
chmod +x deploy.sh
./deploy.sh

# The script will prompt you for:
# - Domain name
# - Email for SSL
# - Database password
# - Django secret key (or auto-generate)
```

That's it! The script handles everything automatically.

---

## Option 2: Manual Deployment

### Step 1: Initial Server Setup (5 min)

```bash
# SSH as root
ssh root@your_server_ip

# Update system
apt update && apt upgrade -y

# Create textile user
adduser textile --disabled-password --gecos ""
usermod -aG sudo textile
passwd textile

# Configure firewall
apt install ufw -y
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### Step 2: Install Dependencies (10 min)

```bash
# Switch to textile user
su - textile

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

# Install additional tools
sudo apt install -y build-essential libpq-dev git certbot python3-certbot-nginx libjpeg-dev zlib1g-dev fail2ban
```

### Step 3: Setup Database (3 min)

```bash
# Create database and user
sudo -u postgres psql <<EOF
CREATE DATABASE textile_inventory;
CREATE USER textile_user WITH PASSWORD 'your_secure_password';
ALTER USER textile_user CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE textile_inventory TO textile_user;
\c textile_inventory
GRANT ALL ON SCHEMA public TO textile_user;
ALTER DATABASE textile_inventory OWNER TO textile_user;
EOF
```

### Step 4: Deploy Application (10 min)

```bash
# Create app directory
mkdir -p /home/textile/apps
cd /home/textile/apps

# Copy your application files here (use scp from local machine)
# scp -r /home/sohel/code/inventory textile@your_server_ip:/home/textile/apps/textile-inventory

cd textile-inventory/backend

# Setup Python environment
python3.11 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Create production settings (see DEPLOYMENT.md section 5.3 for full content)
nano config/settings_production.py
# Copy settings from DEPLOYMENT.md

# Run migrations
export DJANGO_SETTINGS_MODULE=config.settings_production
python manage.py migrate
python manage.py createsuperuser
python manage.py collectstatic --noinput

# Build frontend
cd ../frontend
npm install
echo "REACT_APP_API_URL=https://your-domain.com/api" > .env.production
echo "REACT_APP_MEDIA_URL=https://your-domain.com/media" >> .env.production
npm run build
```

### Step 5: Configure Nginx (5 min)

```bash
# Create Nginx config (see DEPLOYMENT.md section 6.1 for full content)
sudo nano /etc/nginx/sites-available/textile-inventory
# Copy config from DEPLOYMENT.md

# Enable site
sudo ln -s /etc/nginx/sites-available/textile-inventory /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### Step 6: Setup Systemd Service (3 min)

```bash
# Create service file (see DEPLOYMENT.md section 8.1 for full content)
sudo nano /etc/systemd/system/textile-inventory.service
# Copy config from DEPLOYMENT.md

# Start service
sudo systemctl daemon-reload
sudo systemctl start textile-inventory
sudo systemctl enable textile-inventory
sudo systemctl status textile-inventory
```

### Step 7: Install SSL Certificate (2 min)

```bash
# Make sure your domain points to server IP first!
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Follow prompts and choose to redirect HTTP to HTTPS
```

### Step 8: Setup Backups (5 min)

```bash
# Create backup scripts (see DEPLOYMENT.md section 10 for full scripts)
mkdir -p /home/textile/backups/{database,media}

# Create backup-database.sh and backup-media.sh
# (see DEPLOYMENT.md for script contents)

chmod +x /home/textile/backups/*.sh

# Schedule with cron
crontab -e
# Add:
# 0 2 * * * /home/textile/backups/backup-database.sh
# 0 3 * * 0 /home/textile/backups/backup-media.sh
```

---

## Post-Deployment Verification

```bash
# Check services
sudo systemctl status textile-inventory
sudo systemctl status nginx
sudo systemctl status postgresql

# Check logs
tail -f /home/textile/apps/textile-inventory/logs/gunicorn-error.log
sudo tail -f /var/log/nginx/error.log

# Test application
curl https://your-domain.com
curl https://your-domain.com/api/csrf/

# Access in browser
https://your-domain.com
https://your-domain.com/admin/
```

---

## Common Commands

### Service Management
```bash
# Restart application
sudo systemctl restart textile-inventory

# View application logs
sudo journalctl -u textile-inventory -f
tail -f /home/textile/apps/textile-inventory/logs/gunicorn-error.log

# Restart Nginx
sudo systemctl restart nginx
```

### Application Updates
```bash
cd /home/textile/apps/textile-inventory

# Update backend
cd backend
source venv/bin/activate
git pull
pip install -r requirements.txt --upgrade
python manage.py migrate
python manage.py collectstatic --noinput
deactivate

# Update frontend
cd ../frontend
git pull
npm install
npm run build

# Restart services
sudo systemctl restart textile-inventory
sudo systemctl reload nginx
```

### Database Operations
```bash
# Backup database manually
sudo -u postgres pg_dump textile_inventory | gzip > backup_$(date +%Y%m%d).sql.gz

# Restore database
gunzip -c backup_20260218.sql.gz | sudo -u postgres psql textile_inventory

# Connect to database
sudo -u postgres psql textile_inventory
```

### Monitoring
```bash
# Check disk space
df -h

# Check memory usage
free -h

# Check running processes
htop

# Check database size
sudo -u postgres psql -c "SELECT pg_size_pretty(pg_database_size('textile_inventory'));"
```

---

## Troubleshooting Quick Fixes

### 502 Bad Gateway
```bash
sudo systemctl status textile-inventory
sudo journalctl -u textile-inventory -n 50
sudo systemctl restart textile-inventory
```

### Static Files Not Loading
```bash
cd /home/textile/apps/textile-inventory/backend
source venv/bin/activate
python manage.py collectstatic --noinput
sudo chown -R textile:textile staticfiles
```

### Database Connection Error
```bash
sudo systemctl status postgresql
sudo -u postgres psql textile_inventory
# Check settings_production.py credentials
```

### SSL Certificate Renewal
```bash
# Test renewal
sudo certbot renew --dry-run

# Force renewal
sudo certbot renew --force-renewal
```

---

## Security Checklist

- [ ] Changed default SSH port (optional but recommended)
- [ ] Disabled root SSH login
- [ ] Configured UFW firewall
- [ ] Installed fail2ban
- [ ] SSL certificate installed
- [ ] HTTPS redirect enabled
- [ ] Strong database password
- [ ] Django DEBUG = False
- [ ] Backups scheduled and tested
- [ ] Security headers configured in Nginx

---

## Support

For detailed information, see:
- Full deployment guide: `DEPLOYMENT.md`
- Application logs: `/home/textile/apps/textile-inventory/logs/`
- System logs: `/var/log/nginx/` and `sudo journalctl -u textile-inventory`

---

**Total Deployment Time:**
- Automated: ~20-30 minutes
- Manual: ~45-60 minutes

**Deployment Date:** _____________
**Domain:** _____________
**Server IP:** _____________
**SSL Email:** _____________
