# Complete AWS Deployment Guide

## Overview

This guide will help you deploy the Textile Inventory System to AWS with:
- **EC2** for application hosting
- **RDS PostgreSQL** for database
- **Nginx** as reverse proxy
- **Gunicorn** as WSGI server
- **Let's Encrypt** for SSL certificate
- **PM2** for process management (optional)

**Estimated Monthly Cost:** $48-52 (or $10-15 with AWS Free Tier)

---

## Phase 1: AWS Account Setup

### 1.1 Create AWS Account

1. Go to https://aws.amazon.com/
2. Click "Create an AWS Account"
3. Follow the registration process (requires credit card)
4. Enable MFA (Multi-Factor Authentication) for security

### 1.2 Set Up Billing Alerts

1. Go to AWS Billing Dashboard
2. Set up a billing alarm for $50/month to avoid surprises
3. Enable cost allocation tags

---

## Phase 2: Create RDS PostgreSQL Database

### 2.1 Launch RDS Instance

1. Go to **AWS Console → RDS → Create Database**

2. **Choose Database Creation Method:**
   - Select: **Standard Create**

3. **Engine Options:**
   - Engine type: **PostgreSQL**
   - Version: **PostgreSQL 14.x** or latest stable

4. **Templates:**
   - Select: **Free tier** (if eligible) OR **Production** (for better performance)

5. **Settings:**
   - DB instance identifier: `textile-inventory-db`
   - Master username: `admin`
   - Master password: Create a strong password (save it!)
   - Confirm password

6. **DB Instance Class:**
   - **Free Tier:** db.t3.micro (1 vCPU, 1 GB RAM)
   - **Production:** db.t3.small (2 vCPU, 2 GB RAM) - ~$30/month

7. **Storage:**
   - Storage type: General Purpose SSD (gp3)
   - Allocated storage: **20 GB** (minimum)
   - Enable storage autoscaling: Yes
   - Maximum storage threshold: 100 GB

8. **Connectivity:**
   - Virtual Private Cloud (VPC): Default VPC
   - Public access: **Yes** (we'll restrict by security group)
   - VPC security group: Create new → `rds-postgres-sg`
   - Availability Zone: No preference

9. **Database Authentication:**
   - Password authentication

10. **Additional Configuration:**
    - Initial database name: `textile_inventory`
    - Backup retention: 7 days (recommended)
    - Enable automated backups: Yes
    - Backup window: Choose off-peak hours

11. Click **Create Database** (takes 5-10 minutes)

### 2.2 Configure RDS Security Group

1. Go to **EC2 → Security Groups → rds-postgres-sg**
2. Edit **Inbound Rules**:
   - Type: PostgreSQL
   - Protocol: TCP
   - Port: 5432
   - Source: Custom → (We'll add EC2 security group after EC2 creation)
   - Description: Allow PostgreSQL from EC2

3. **Save the RDS Endpoint:**
   - Go to RDS → Databases → textile-inventory-db
   - Copy the **Endpoint** (e.g., `textile-inventory-db.xxxxx.ap-south-1.rds.amazonaws.com`)
   - Save this for `.env.production` file

---

## Phase 3: Create EC2 Instance

### 3.1 Launch EC2 Instance

1. Go to **AWS Console → EC2 → Launch Instance**

2. **Name and Tags:**
   - Name: `textile-inventory-app`

3. **Application and OS Images (AMI):**
   - Quick Start: **Ubuntu**
   - Version: **Ubuntu Server 22.04 LTS** (free tier eligible)

4. **Instance Type:**
   - **Free Tier:** t2.micro (1 vCPU, 1 GB RAM) - Limited for production
   - **Recommended:** t3.small (2 vCPU, 2 GB RAM) - ~$15/month
   - **Better Performance:** t3.medium (2 vCPU, 4 GB RAM) - ~$30/month

5. **Key Pair (login):**
   - Click "Create new key pair"
   - Key pair name: `textile-inventory-key`
   - Key pair type: RSA
   - Private key format: `.pem` (for Mac/Linux) or `.ppk` (for Windows PuTTY)
   - Click "Create key pair"
   - **IMPORTANT:** Save the `.pem` file securely - you can't download it again!

6. **Network Settings:**
   - VPC: Default VPC
   - Subnet: No preference
   - Auto-assign public IP: **Enable**
   - Firewall (Security Groups): **Create new**
     - Security group name: `textile-inventory-sg`
     - Description: Allow HTTP, HTTPS, SSH
     - Inbound rules:
       - SSH (22) - Your IP (for security)
       - HTTP (80) - Anywhere (0.0.0.0/0)
       - HTTPS (443) - Anywhere (0.0.0.0/0)
       - Custom TCP (8000) - Anywhere (for initial testing, remove later)

7. **Configure Storage:**
   - Size: **20 GB** (minimum, 30 GB recommended)
   - Volume type: gp3 (General Purpose SSD)

8. **Advanced Details:**
   - Leave defaults

9. Click **Launch Instance**

### 3.2 Allocate Elastic IP (Recommended)

1. Go to **EC2 → Elastic IPs → Allocate Elastic IP address**
2. Click **Allocate**
3. Select the new IP → **Actions → Associate Elastic IP address**
4. Select your instance: `textile-inventory-app`
5. Click **Associate**

**Why?** Elastic IP ensures your public IP doesn't change on instance restart.

### 3.3 Update RDS Security Group

1. Go to **EC2 → Security Groups → rds-postgres-sg**
2. Edit **Inbound Rules**:
   - Add rule:
     - Type: PostgreSQL
     - Source: Custom → Select `textile-inventory-sg` (EC2 security group)
3. Save rules

---

## Phase 4: Connect to EC2 and Install Dependencies

### 4.1 Connect via SSH

**Mac/Linux:**
```bash
# Set correct permissions on key file
chmod 400 ~/Downloads/textile-inventory-key.pem

# Connect to EC2
ssh -i ~/Downloads/textile-inventory-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

**Windows (PuTTY):**
1. Convert `.pem` to `.ppk` using PuTTYgen
2. Open PuTTY
3. Host Name: `ubuntu@YOUR_EC2_PUBLIC_IP`
4. Connection → SSH → Auth → Browse for `.ppk` file
5. Click Open

### 4.2 Update System and Install Dependencies

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Python 3.11 and pip
sudo apt install -y python3.11 python3.11-venv python3-pip

# Install PostgreSQL client
sudo apt install -y postgresql-client libpq-dev

# Install Nginx
sudo apt install -y nginx

# Install Node.js and npm (for React build)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Git
sudo apt install -y git

# Install system utilities
sudo apt install -y htop tmux curl wget unzip
```

### 4.3 Configure Firewall (UFW)

```bash
# Enable firewall
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable

# Check status
sudo ufw status
```

---

## Phase 5: Deploy Application Code

### 5.1 Clone Repository and Setup

```bash
# Create app directory
sudo mkdir -p /var/www
sudo chown -R ubuntu:ubuntu /var/www
cd /var/www

# Clone your repository (replace with your repo URL)
# Option 1: If using Git
git clone https://github.com/your-username/inventory.git
cd inventory

# Option 2: If uploading manually
# Use SCP from your local machine:
# scp -i textile-inventory-key.pem -r /home/sohel/code/inventory ubuntu@YOUR_EC2_IP:/var/www/
```

### 5.2 Create Production Environment File

```bash
cd /var/www/inventory

# Copy template
cp .env.production.template .env.production

# Edit with your actual values
nano .env.production
```

**Fill in these values:**
```bash
DJANGO_SECRET_KEY=generate-new-secret-key-here
DJANGO_SETTINGS_MODULE=config.settings_production

DOMAIN_NAME=your-domain.com  # or use EC2 IP for testing
EC2_PUBLIC_IP=your-ec2-elastic-ip

RDS_DB_NAME=textile_inventory
RDS_USERNAME=admin
RDS_PASSWORD=your-rds-master-password
RDS_HOSTNAME=textile-inventory-db.xxxxx.ap-south-1.rds.amazonaws.com
RDS_PORT=5432

DJANGO_SUPERUSER_USERNAME=admin
DJANGO_SUPERUSER_EMAIL=admin@yourdomain.com
DJANGO_SUPERUSER_PASSWORD=your-chosen-admin-password
```

**Generate Secret Key:**
```bash
python3 -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'
```

### 5.3 Install Python Dependencies

```bash
# Create virtual environment
python3.11 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install requirements
pip install -r requirements.txt

# Install additional production packages
pip install gunicorn whitenoise psycopg2-binary
```

### 5.4 Build React Frontend

```bash
cd frontend

# Install dependencies
npm install

# Create production build
npm run build

# Verify build created
ls -la dist/
```

### 5.5 Setup Django Application

```bash
cd /var/www/inventory
source venv/bin/activate

# Load environment variables
export $(cat .env.production | xargs)

# Create logs directory
mkdir -p logs

# Collect static files
python manage.py collectstatic --noinput --settings=config.settings_production

# Run migrations
python manage.py migrate --settings=config.settings_production

# Create superuser (uses environment variables)
python manage.py createsuperuser --noinput --settings=config.settings_production

# Test database connection
python manage.py check --settings=config.settings_production
```

### 5.6 Test Application Locally

```bash
# Run Gunicorn to test
gunicorn config.wsgi:application --bind 0.0.0.0:8000 --settings=config.settings_production

# In another terminal, test:
curl http://localhost:8000/api/
```

If successful, you'll see JSON response. Press `Ctrl+C` to stop.

---

## Phase 6: Configure Gunicorn Service

### 6.1 Create Gunicorn Socket File

```bash
sudo nano /etc/systemd/system/gunicorn.socket
```

Paste:
```ini
[Unit]
Description=gunicorn socket

[Socket]
ListenStream=/run/gunicorn.sock

[Install]
WantedBy=sockets.target
```

### 6.2 Create Gunicorn Service File

```bash
sudo nano /etc/systemd/system/gunicorn.service
```

Paste:
```ini
[Unit]
Description=gunicorn daemon for textile inventory
Requires=gunicorn.socket
After=network.target

[Service]
Type=notify
User=ubuntu
Group=www-data
WorkingDirectory=/var/www/inventory
EnvironmentFile=/var/www/inventory/.env.production
ExecStart=/var/www/inventory/venv/bin/gunicorn \
          --access-logfile /var/www/inventory/logs/gunicorn-access.log \
          --error-logfile /var/www/inventory/logs/gunicorn-error.log \
          --workers 3 \
          --bind unix:/run/gunicorn.sock \
          config.wsgi:application

[Install]
WantedBy=multi-user.target
```

### 6.3 Start and Enable Gunicorn

```bash
# Start and enable socket
sudo systemctl start gunicorn.socket
sudo systemctl enable gunicorn.socket

# Check socket status
sudo systemctl status gunicorn.socket

# Test socket activation
curl --unix-socket /run/gunicorn.sock http://localhost/api/

# Start gunicorn service
sudo systemctl start gunicorn
sudo systemctl enable gunicorn

# Check service status
sudo systemctl status gunicorn

# View logs if issues
sudo journalctl -u gunicorn -f
```

---

## Phase 7: Configure Nginx

### 7.1 Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/textile_inventory
```

Paste (replace `your-domain.com` with your actual domain or EC2 IP):
```nginx
# Upstream to Gunicorn
upstream textile_app {
    server unix:/run/gunicorn.sock fail_timeout=0;
}

# HTTP Server (will redirect to HTTPS after SSL setup)
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;  # Replace with your domain or EC2 IP

    client_max_body_size 20M;  # Allow up to 20MB uploads (for design photos)

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Static files
    location /static/ {
        alias /var/www/inventory/staticfiles/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Media files (uploaded images)
    location /media/ {
        alias /var/www/inventory/media/;
        expires 7d;
        add_header Cache-Control "public";
    }

    # API endpoints
    location /api/ {
        proxy_pass http://textile_app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
    }

    # Django admin
    location /admin/ {
        proxy_pass http://textile_app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
    }

    # React frontend - serve index.html for all other routes
    location / {
        root /var/www/inventory/frontend/dist;
        try_files $uri $uri/ /index.html;
        expires 1h;
        add_header Cache-Control "public";
    }

    # Error pages
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
    }
}
```

### 7.2 Enable Site and Test Configuration

```bash
# Create symbolic link to enable site
sudo ln -s /etc/nginx/sites-available/textile_inventory /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Check status
sudo systemctl status nginx
```

### 7.3 Test Application

Open browser and navigate to:
- `http://YOUR_EC2_IP` - Should show React frontend
- `http://YOUR_EC2_IP/api/` - Should show API root
- `http://YOUR_EC2_IP/admin/` - Should show Django admin

---

## Phase 8: Setup Domain and SSL Certificate

### 8.1 Register Domain (Optional)

**Option 1: AWS Route 53**
1. Go to **Route 53 → Registered domains → Register domain**
2. Search for domain name
3. Complete registration (~$12/year for .com)

**Option 2: External Registrar**
- Use Namecheap, GoDaddy, etc.
- Point nameservers to AWS Route 53 (if using Route 53 for DNS)

### 8.2 Configure DNS (Route 53)

1. Go to **Route 53 → Hosted zones → Create hosted zone**
2. Domain name: `your-domain.com`
3. Type: Public hosted zone
4. Click **Create**

5. Create **A Record:**
   - Record name: (leave empty for root domain)
   - Record type: A
   - Value: Your EC2 Elastic IP
   - TTL: 300
   - Click **Create record**

6. Create **WWW Record:**
   - Record name: `www`
   - Record type: A
   - Value: Your EC2 Elastic IP
   - TTL: 300
   - Click **Create record**

7. **Update nameservers at your registrar** (if domain registered elsewhere):
   - Copy the 4 NS records from Route 53
   - Update at your domain registrar
   - Wait 24-48 hours for propagation

### 8.3 Install SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate (replace with your domain)
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Follow prompts:
# - Enter email address
# - Agree to Terms of Service
# - Choose whether to redirect HTTP to HTTPS (select Yes)

# Test auto-renewal
sudo certbot renew --dry-run
```

**Certbot automatically:**
- Obtains SSL certificate
- Configures Nginx for HTTPS
- Sets up auto-renewal cron job

### 8.4 Update Django Settings

```bash
# Edit .env.production
nano /var/www/inventory/.env.production

# Update DOMAIN_NAME
DOMAIN_NAME=your-domain.com
```

```bash
# Restart Gunicorn
sudo systemctl restart gunicorn

# Restart Nginx
sudo systemctl restart nginx
```

### 8.5 Test HTTPS

Visit: `https://your-domain.com`

Check SSL: https://www.ssllabs.com/ssltest/

---

## Phase 9: Setup Cron Job for Notifications

### 9.1 Create Management Command Wrapper

```bash
nano /var/www/inventory/scripts/check_notifications.sh
```

Paste:
```bash
#!/bin/bash
cd /var/www/inventory
source venv/bin/activate
export $(cat .env.production | xargs)
python manage.py check_bill_notifications --settings=config.settings_production
```

Make executable:
```bash
chmod +x /var/www/inventory/scripts/check_notifications.sh
```

### 9.2 Add Cron Job

```bash
crontab -e
```

Add this line (runs daily at 9 AM IST):
```
0 9 * * * /var/www/inventory/scripts/check_notifications.sh >> /var/www/inventory/logs/notifications.log 2>&1
```

---

## Phase 10: Backup Strategy

### 10.1 Database Backups (RDS)

**Automated Backups** (already configured):
- RDS automatically creates daily snapshots
- Retention: 7 days
- To restore: RDS → Snapshots → Restore

**Manual Backup Script:**
```bash
nano /var/www/inventory/scripts/backup_db.sh
```

Paste:
```bash
#!/bin/bash
BACKUP_DIR="/var/www/inventory/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/db_backup_$TIMESTAMP.sql"

mkdir -p $BACKUP_DIR

# Load environment variables
export $(cat /var/www/inventory/.env.production | xargs)

# Dump database
PGPASSWORD=$RDS_PASSWORD pg_dump -h $RDS_HOSTNAME -U $RDS_USERNAME -d $RDS_DB_NAME > $BACKUP_FILE

# Compress
gzip $BACKUP_FILE

# Delete backups older than 30 days
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE.gz"
```

Make executable:
```bash
chmod +x /var/www/inventory/scripts/backup_db.sh
```

Add to cron (weekly on Sunday at 2 AM):
```bash
crontab -e
```

Add:
```
0 2 * * 0 /var/www/inventory/scripts/backup_db.sh >> /var/www/inventory/logs/backups.log 2>&1
```

### 10.2 Media Files Backup

```bash
# Option 1: Sync to S3 (recommended)
aws s3 sync /var/www/inventory/media/ s3://your-backup-bucket/media/

# Option 2: Rsync to another server
rsync -avz /var/www/inventory/media/ user@backup-server:/backups/media/
```

---

## Phase 11: Monitoring and Maintenance

### 11.1 Monitor Application Logs

```bash
# Gunicorn access logs
tail -f /var/www/inventory/logs/gunicorn-access.log

# Gunicorn error logs
tail -f /var/www/inventory/logs/gunicorn-error.log

# Django errors
tail -f /var/www/inventory/logs/django_errors.log

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

### 11.2 Monitor System Resources

```bash
# Real-time system monitor
htop

# Disk usage
df -h

# Memory usage
free -m

# Check running processes
ps aux | grep gunicorn
```

### 11.3 CloudWatch Monitoring (AWS)

1. Go to **CloudWatch → Dashboards → Create dashboard**
2. Add widgets for:
   - EC2 CPU Utilization
   - RDS Database Connections
   - Network In/Out
   - Disk Usage

3. Set up alarms:
   - CPU > 80%
   - Disk > 85%
   - Database connections > 80

### 11.4 Update Application

```bash
# Pull latest code
cd /var/www/inventory
git pull origin main

# Activate virtualenv
source venv/bin/activate

# Update dependencies
pip install -r requirements.txt

# Rebuild frontend
cd frontend
npm install
npm run build

# Run migrations
cd ..
export $(cat .env.production | xargs)
python manage.py migrate --settings=config.settings_production

# Collect static files
python manage.py collectstatic --noinput --settings=config.settings_production

# Restart services
sudo systemctl restart gunicorn
sudo systemctl restart nginx
```

---

## Troubleshooting

### Issue: Can't connect to EC2

**Solution:**
```bash
# Check security group allows SSH from your IP
# Check key permissions: chmod 400 key.pem
# Try: ssh -vvv -i key.pem ubuntu@IP (verbose mode)
```

### Issue: Can't connect to RDS

**Solution:**
```bash
# Test from EC2:
psql -h YOUR_RDS_ENDPOINT -U admin -d textile_inventory

# Check RDS security group allows EC2 security group
# Check RDS is publicly accessible
# Check VPC and subnets match
```

### Issue: 502 Bad Gateway

**Solution:**
```bash
# Check Gunicorn is running
sudo systemctl status gunicorn

# Check socket exists
ls -l /run/gunicorn.sock

# Restart services
sudo systemctl restart gunicorn nginx
```

### Issue: Static files not loading

**Solution:**
```bash
# Collect static files again
python manage.py collectstatic --noinput --settings=config.settings_production

# Check Nginx static file path in config
# Check file permissions
sudo chown -R ubuntu:www-data /var/www/inventory/staticfiles
sudo chmod -R 755 /var/www/inventory/staticfiles
```

### Issue: Permission denied on media uploads

**Solution:**
```bash
sudo chown -R ubuntu:www-data /var/www/inventory/media
sudo chmod -R 775 /var/www/inventory/media
```

---

## Cost Optimization Tips

1. **Use AWS Free Tier** (first 12 months):
   - t2.micro EC2
   - db.t2.micro RDS
   - 5GB S3 storage

2. **Reserved Instances** (1-3 year commitment):
   - Save up to 40% on EC2 and RDS

3. **Spot Instances** (non-production):
   - Use for development/testing
   - Up to 90% savings

4. **Auto Scaling**:
   - Scale down during off-hours
   - Scale up during business hours

5. **CloudWatch Alarms**:
   - Monitor and stop unused resources
   - Set billing alarms

6. **S3 Lifecycle Policies**:
   - Move old files to cheaper storage tiers
   - Glacier for long-term archives

---

## Security Checklist

- [ ] Changed default SSH port (optional but recommended)
- [ ] Disabled password authentication (key-based only)
- [ ] Configured UFW firewall
- [ ] Restricted RDS security group to EC2 only
- [ ] Set up SSL/HTTPS with Let's Encrypt
- [ ] Changed Django SECRET_KEY
- [ ] Set DEBUG=False in production
- [ ] Configured ALLOWED_HOSTS properly
- [ ] Set up regular database backups
- [ ] Enabled MFA on AWS root account
- [ ] Created IAM users instead of using root
- [ ] Regular security updates: `sudo apt update && sudo apt upgrade`

---

## Next Steps After Deployment

1. **Test all features thoroughly**
2. **Create initial data** (Parties, Quality Types, etc.)
3. **Train users** on the system
4. **Monitor logs** for first few days
5. **Set up monitoring alerts**
6. **Document any custom configurations**
7. **Plan regular maintenance windows**

---

## Support and Resources

- **Django Docs:** https://docs.djangoproject.com/
- **AWS Docs:** https://docs.aws.amazon.com/
- **Nginx Docs:** https://nginx.org/en/docs/
- **Let's Encrypt:** https://letsencrypt.org/docs/
- **Gunicorn Docs:** https://docs.gunicorn.org/

---

**Deployment completed!** 🎉

Your application should now be live at: `https://your-domain.com`
