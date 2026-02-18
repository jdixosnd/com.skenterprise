#!/bin/bash

################################################################################
# Textile Inventory System - Deployment Verification Script
# Run this after deployment to verify all components are working correctly
################################################################################

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
}

print_test() {
    echo -e "${YELLOW}[TEST]${NC} $1"
}

print_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED++))
}

print_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED++))
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    ((WARNINGS++))
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

################################################################################
# System Checks
################################################################################

print_header "SYSTEM CHECKS"

# Check if running as textile user
print_test "Checking current user..."
if [ "$USER" = "textile" ]; then
    print_pass "Running as textile user"
else
    print_warn "Not running as textile user (current: $USER)"
fi

# Check Python version
print_test "Checking Python version..."
PYTHON_VERSION=$(python3 --version 2>&1 | grep -oP '\d+\.\d+')
if [ "$(echo "$PYTHON_VERSION >= 3.11" | bc)" -eq 1 ]; then
    print_pass "Python $PYTHON_VERSION installed"
else
    print_fail "Python 3.11+ not found (found: $PYTHON_VERSION)"
fi

# Check Node.js version
print_test "Checking Node.js version..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_pass "Node.js $NODE_VERSION installed"
else
    print_fail "Node.js not installed"
fi

# Check PostgreSQL
print_test "Checking PostgreSQL service..."
if sudo systemctl is-active --quiet postgresql; then
    print_pass "PostgreSQL is running"
else
    print_fail "PostgreSQL is not running"
fi

# Check Nginx
print_test "Checking Nginx service..."
if sudo systemctl is-active --quiet nginx; then
    print_pass "Nginx is running"
else
    print_fail "Nginx is not running"
fi

################################################################################
# Database Checks
################################################################################

print_header "DATABASE CHECKS"

# Check database exists
print_test "Checking if textile_inventory database exists..."
if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw textile_inventory; then
    print_pass "Database textile_inventory exists"

    # Check database size
    DB_SIZE=$(sudo -u postgres psql -t -c "SELECT pg_size_pretty(pg_database_size('textile_inventory'));" | xargs)
    print_info "Database size: $DB_SIZE"
else
    print_fail "Database textile_inventory not found"
fi

# Check database user
print_test "Checking textile_user database user..."
if sudo -u postgres psql -t -c "SELECT 1 FROM pg_roles WHERE rolname='textile_user'" | grep -q 1; then
    print_pass "User textile_user exists"
else
    print_fail "User textile_user not found"
fi

################################################################################
# Application Checks
################################################################################

print_header "APPLICATION CHECKS"

# Check application directory
print_test "Checking application directory..."
APP_DIR="/home/textile/apps/textile-inventory"
if [ -d "$APP_DIR" ]; then
    print_pass "Application directory exists: $APP_DIR"
else
    print_fail "Application directory not found: $APP_DIR"
fi

# Check backend virtual environment
print_test "Checking backend virtual environment..."
if [ -d "$APP_DIR/backend/venv" ]; then
    print_pass "Virtual environment exists"
else
    print_fail "Virtual environment not found"
fi

# Check backend dependencies
print_test "Checking Django installation..."
if [ -f "$APP_DIR/backend/venv/bin/django-admin" ]; then
    DJANGO_VERSION=$("$APP_DIR/backend/venv/bin/python" -c "import django; print(django.get_version())" 2>/dev/null)
    if [ $? -eq 0 ]; then
        print_pass "Django $DJANGO_VERSION installed"
    else
        print_fail "Django not installed in virtual environment"
    fi
else
    print_fail "Django not found in virtual environment"
fi

# Check frontend build
print_test "Checking frontend build..."
if [ -d "$APP_DIR/frontend/build" ]; then
    BUILD_SIZE=$(du -sh "$APP_DIR/frontend/build" 2>/dev/null | cut -f1)
    print_pass "Frontend build exists (size: $BUILD_SIZE)"
else
    print_fail "Frontend build directory not found"
fi

# Check static files
print_test "Checking Django static files..."
if [ -d "$APP_DIR/backend/staticfiles" ]; then
    STATIC_SIZE=$(du -sh "$APP_DIR/backend/staticfiles" 2>/dev/null | cut -f1)
    print_pass "Static files collected (size: $STATIC_SIZE)"
else
    print_warn "Static files directory not found - run collectstatic"
fi

# Check media directory
print_test "Checking media directory..."
if [ -d "$APP_DIR/backend/media" ]; then
    print_pass "Media directory exists"
else
    print_warn "Media directory not found"
fi

# Check logs directory
print_test "Checking logs directory..."
if [ -d "$APP_DIR/logs" ]; then
    print_pass "Logs directory exists"
else
    print_warn "Logs directory not found"
fi

################################################################################
# Service Checks
################################################################################

print_header "SERVICE CHECKS"

# Check textile-inventory service
print_test "Checking textile-inventory systemd service..."
if sudo systemctl is-active --quiet textile-inventory; then
    print_pass "textile-inventory service is running"

    # Check service uptime
    UPTIME=$(sudo systemctl show textile-inventory --property=ActiveEnterTimestamp --value)
    print_info "Service started: $UPTIME"
else
    print_fail "textile-inventory service is not running"
fi

# Check if service is enabled
print_test "Checking if service is enabled on boot..."
if sudo systemctl is-enabled --quiet textile-inventory; then
    print_pass "Service is enabled"
else
    print_warn "Service is not enabled - run: sudo systemctl enable textile-inventory"
fi

# Check Gunicorn process
print_test "Checking Gunicorn workers..."
GUNICORN_COUNT=$(pgrep -f "gunicorn.*config.wsgi" | wc -l)
if [ "$GUNICORN_COUNT" -gt 0 ]; then
    print_pass "Found $GUNICORN_COUNT Gunicorn processes"
else
    print_fail "No Gunicorn processes found"
fi

################################################################################
# Network Checks
################################################################################

print_header "NETWORK CHECKS"

# Check if Gunicorn is listening
print_test "Checking if Gunicorn is listening on port 8000..."
if sudo netstat -tuln 2>/dev/null | grep -q ":8000"; then
    print_pass "Gunicorn listening on port 8000"
else
    if command -v ss &> /dev/null; then
        if sudo ss -tuln | grep -q ":8000"; then
            print_pass "Gunicorn listening on port 8000"
        else
            print_fail "Gunicorn not listening on port 8000"
        fi
    else
        print_warn "Cannot verify port 8000 (netstat/ss not available)"
    fi
fi

# Check if Nginx is listening
print_test "Checking if Nginx is listening on ports 80/443..."
NGINX_80=$(sudo netstat -tuln 2>/dev/null | grep ":80" || sudo ss -tuln 2>/dev/null | grep ":80")
NGINX_443=$(sudo netstat -tuln 2>/dev/null | grep ":443" || sudo ss -tuln 2>/dev/null | grep ":443")

if [ -n "$NGINX_80" ]; then
    print_pass "Nginx listening on port 80"
else
    print_fail "Nginx not listening on port 80"
fi

if [ -n "$NGINX_443" ]; then
    print_pass "Nginx listening on port 443"
else
    print_warn "Nginx not listening on port 443 (SSL not configured?)"
fi

################################################################################
# Configuration Checks
################################################################################

print_header "CONFIGURATION CHECKS"

# Check Nginx configuration
print_test "Checking Nginx configuration..."
if sudo nginx -t 2>&1 | grep -q "successful"; then
    print_pass "Nginx configuration is valid"
else
    print_fail "Nginx configuration has errors"
fi

# Check if site is enabled
print_test "Checking if textile-inventory site is enabled..."
if [ -L "/etc/nginx/sites-enabled/textile-inventory" ]; then
    print_pass "Site is enabled in Nginx"
else
    print_fail "Site is not enabled in Nginx"
fi

# Check production settings
print_test "Checking Django production settings..."
if [ -f "$APP_DIR/backend/config/settings_production.py" ]; then
    print_pass "Production settings file exists"

    # Check DEBUG setting
    if grep -q "DEBUG = False" "$APP_DIR/backend/config/settings_production.py"; then
        print_pass "DEBUG is set to False"
    else
        print_warn "DEBUG is not set to False in production settings"
    fi
else
    print_warn "Production settings file not found"
fi

################################################################################
# SSL/HTTPS Checks
################################################################################

print_header "SSL/HTTPS CHECKS"

# Check if certbot is installed
print_test "Checking if certbot is installed..."
if command -v certbot &> /dev/null; then
    print_pass "Certbot is installed"

    # Check SSL certificates
    print_test "Checking SSL certificates..."
    CERT_COUNT=$(sudo certbot certificates 2>/dev/null | grep -c "Certificate Name:")
    if [ "$CERT_COUNT" -gt 0 ]; then
        print_pass "Found $CERT_COUNT SSL certificate(s)"

        # Check expiry
        EXPIRY=$(sudo certbot certificates 2>/dev/null | grep "Expiry Date:" | head -1)
        if [ -n "$EXPIRY" ]; then
            print_info "$EXPIRY"
        fi
    else
        print_warn "No SSL certificates found"
    fi
else
    print_warn "Certbot not installed"
fi

################################################################################
# Security Checks
################################################################################

print_header "SECURITY CHECKS"

# Check firewall
print_test "Checking UFW firewall..."
if command -v ufw &> /dev/null; then
    if sudo ufw status | grep -q "Status: active"; then
        print_pass "UFW firewall is active"
    else
        print_warn "UFW firewall is inactive"
    fi
else
    print_warn "UFW not installed"
fi

# Check fail2ban
print_test "Checking fail2ban..."
if command -v fail2ban-client &> /dev/null; then
    if sudo systemctl is-active --quiet fail2ban; then
        print_pass "fail2ban is running"
    else
        print_warn "fail2ban is installed but not running"
    fi
else
    print_warn "fail2ban not installed"
fi

################################################################################
# Backup Checks
################################################################################

print_header "BACKUP CHECKS"

# Check backup directory
print_test "Checking backup directory..."
BACKUP_DIR="/home/textile/backups"
if [ -d "$BACKUP_DIR" ]; then
    print_pass "Backup directory exists: $BACKUP_DIR"

    # Check backup scripts
    if [ -f "$BACKUP_DIR/backup-database.sh" ]; then
        print_pass "Database backup script exists"
    else
        print_warn "Database backup script not found"
    fi

    if [ -f "$BACKUP_DIR/backup-media.sh" ]; then
        print_pass "Media backup script exists"
    else
        print_warn "Media backup script not found"
    fi

    # Check for recent backups
    LATEST_DB_BACKUP=$(find "$BACKUP_DIR/database" -name "backup_*.sql.gz" -type f -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)
    if [ -n "$LATEST_DB_BACKUP" ]; then
        BACKUP_DATE=$(stat -c %y "$LATEST_DB_BACKUP" 2>/dev/null | cut -d' ' -f1)
        print_info "Latest database backup: $BACKUP_DATE"
    else
        print_warn "No database backups found"
    fi
else
    print_warn "Backup directory not found: $BACKUP_DIR"
fi

# Check cron jobs
print_test "Checking backup cron jobs..."
CRON_COUNT=$(crontab -l 2>/dev/null | grep -c "backup")
if [ "$CRON_COUNT" -gt 0 ]; then
    print_pass "Found $CRON_COUNT backup cron job(s)"
else
    print_warn "No backup cron jobs found"
fi

################################################################################
# Application Health Checks
################################################################################

print_header "APPLICATION HEALTH CHECKS"

# Check application logs for errors
print_test "Checking recent application errors..."
if [ -f "$APP_DIR/logs/gunicorn-error.log" ]; then
    ERROR_COUNT=$(grep -i "error\|exception\|traceback" "$APP_DIR/logs/gunicorn-error.log" 2>/dev/null | wc -l)
    if [ "$ERROR_COUNT" -eq 0 ]; then
        print_pass "No recent errors in application logs"
    else
        print_warn "Found $ERROR_COUNT error entries in logs (check logs for details)"
    fi
else
    print_warn "Application error log not found"
fi

# Test API endpoint (if curl is available)
print_test "Testing API endpoint..."
if command -v curl &> /dev/null; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/csrf/ 2>/dev/null)
    if [ "$HTTP_CODE" = "200" ]; then
        print_pass "API responding (HTTP $HTTP_CODE)"
    else
        print_warn "API returned HTTP $HTTP_CODE (expected 200)"
    fi
else
    print_warn "curl not available - skipping API test"
fi

################################################################################
# Disk Space Checks
################################################################################

print_header "DISK SPACE CHECKS"

print_test "Checking disk usage..."
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 80 ]; then
    print_pass "Disk usage: ${DISK_USAGE}% (healthy)"
elif [ "$DISK_USAGE" -lt 90 ]; then
    print_warn "Disk usage: ${DISK_USAGE}% (consider cleanup)"
else
    print_fail "Disk usage: ${DISK_USAGE}% (critical - cleanup required)"
fi

# Check available memory
print_test "Checking available memory..."
if command -v free &> /dev/null; then
    MEM_AVAILABLE=$(free -m | awk 'NR==2 {printf "%.0f", $7}')
    MEM_TOTAL=$(free -m | awk 'NR==2 {print $2}')
    MEM_PERCENT=$((100 * MEM_AVAILABLE / MEM_TOTAL))

    if [ "$MEM_PERCENT" -gt 20 ]; then
        print_pass "Available memory: ${MEM_AVAILABLE}MB (${MEM_PERCENT}% free)"
    else
        print_warn "Available memory: ${MEM_AVAILABLE}MB (${MEM_PERCENT}% free - low)"
    fi
fi

################################################################################
# Summary
################################################################################

print_header "VERIFICATION SUMMARY"

TOTAL=$((PASSED + FAILED + WARNINGS))

echo ""
echo -e "${GREEN}Passed:${NC}   $PASSED / $TOTAL"
echo -e "${RED}Failed:${NC}   $FAILED / $TOTAL"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS / $TOTAL"
echo ""

if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}✓ All critical checks passed!${NC}"
    if [ "$WARNINGS" -gt 0 ]; then
        echo -e "${YELLOW}⚠ There are $WARNINGS warnings to review${NC}"
    fi
    exit 0
else
    echo -e "${RED}✗ $FAILED critical check(s) failed${NC}"
    echo -e "${YELLOW}Please review and fix the failed checks before going to production${NC}"
    exit 1
fi
