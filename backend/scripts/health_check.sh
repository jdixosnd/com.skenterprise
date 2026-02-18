#!/bin/bash

###############################################################################
# Health Check Script for Textile Inventory System
# Run this to verify all services are running correctly
###############################################################################

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "System Health Check"
echo "========================================="
echo ""

# Check if running on EC2
if [ -f /var/www/inventory/.env.production ]; then
    cd /var/www/inventory
    export $(cat .env.production | xargs)
else
    echo -e "${YELLOW}Note: Not running in production environment${NC}"
fi

# 1. Check Gunicorn Service
echo -n "Gunicorn Service:    "
if systemctl is-active --quiet gunicorn; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not Running${NC}"
    echo "  Fix: sudo systemctl start gunicorn"
fi

# 2. Check Nginx Service
echo -n "Nginx Service:       "
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not Running${NC}"
    echo "  Fix: sudo systemctl start nginx"
fi

# 3. Check Socket File
echo -n "Gunicorn Socket:     "
if [ -S /run/gunicorn.sock ]; then
    echo -e "${GREEN}✓ Exists${NC}"
else
    echo -e "${RED}✗ Not Found${NC}"
    echo "  Fix: sudo systemctl restart gunicorn.socket"
fi

# 4. Check Database Connection
echo -n "Database Connection: "
if [ -n "$RDS_HOSTNAME" ]; then
    if timeout 5 bash -c "cat < /dev/null > /dev/tcp/$RDS_HOSTNAME/$RDS_PORT" 2>/dev/null; then
        echo -e "${GREEN}✓ Connected${NC}"
    else
        echo -e "${RED}✗ Cannot Connect${NC}"
        echo "  Check: RDS security group, hostname, network"
    fi
else
    echo -e "${YELLOW}○ Not configured (using SQLite?)${NC}"
fi

# 5. Check Disk Space
echo -n "Disk Space:          "
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 80 ]; then
    echo -e "${GREEN}✓ ${DISK_USAGE}% used${NC}"
elif [ "$DISK_USAGE" -lt 90 ]; then
    echo -e "${YELLOW}⚠ ${DISK_USAGE}% used (Warning)${NC}"
else
    echo -e "${RED}✗ ${DISK_USAGE}% used (Critical!)${NC}"
fi

# 6. Check Memory Usage
echo -n "Memory Usage:        "
MEM_USAGE=$(free | awk 'NR==2 {printf "%.0f", $3*100/$2}')
if [ "$MEM_USAGE" -lt 80 ]; then
    echo -e "${GREEN}✓ ${MEM_USAGE}% used${NC}"
elif [ "$MEM_USAGE" -lt 90 ]; then
    echo -e "${YELLOW}⚠ ${MEM_USAGE}% used (Warning)${NC}"
else
    echo -e "${RED}✗ ${MEM_USAGE}% used (Critical!)${NC}"
fi

# 7. Check CPU Load
echo -n "CPU Load (1min):     "
CPU_LOAD=$(uptime | awk -F'load average:' '{print $2}' | cut -d',' -f1 | xargs)
echo -e "${GREEN}${CPU_LOAD}${NC}"

# 8. Check SSL Certificate (if domain configured)
if [ -n "$DOMAIN_NAME" ] && [ "$DOMAIN_NAME" != "localhost" ]; then
    echo -n "SSL Certificate:     "
    if command -v openssl &> /dev/null; then
        CERT_DAYS=$(echo | openssl s_client -servername $DOMAIN_NAME -connect $DOMAIN_NAME:443 2>/dev/null | openssl x509 -noout -checkend 0 2>/dev/null)
        if [ $? -eq 0 ]; then
            EXPIRY=$(echo | openssl s_client -servername $DOMAIN_NAME -connect $DOMAIN_NAME:443 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
            echo -e "${GREEN}✓ Valid (expires: $EXPIRY)${NC}"
        else
            echo -e "${RED}✗ Expired or Invalid${NC}"
            echo "  Fix: sudo certbot renew"
        fi
    else
        echo -e "${YELLOW}○ Cannot check (openssl not found)${NC}"
    fi
fi

# 9. Check Application Endpoint
if [ -n "$DOMAIN_NAME" ]; then
    echo -n "API Endpoint:        "
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/ 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" == "200" ]; then
        echo -e "${GREEN}✓ Responding (HTTP $HTTP_CODE)${NC}"
    elif [ "$HTTP_CODE" == "000" ]; then
        echo -e "${RED}✗ Cannot connect${NC}"
    else
        echo -e "${YELLOW}⚠ HTTP $HTTP_CODE${NC}"
    fi
fi

# 10. Check Recent Errors
echo ""
echo "========================================="
echo "Recent Errors (last 10 lines)"
echo "========================================="

if [ -f /var/www/inventory/logs/gunicorn-error.log ]; then
    ERRORS=$(tail -n 10 /var/www/inventory/logs/gunicorn-error.log | grep -i error | wc -l)
    if [ "$ERRORS" -gt 0 ]; then
        echo -e "${YELLOW}Found $ERRORS error(s) in Gunicorn logs:${NC}"
        tail -n 10 /var/www/inventory/logs/gunicorn-error.log | grep -i error
    else
        echo -e "${GREEN}No recent errors in Gunicorn logs${NC}"
    fi
else
    echo -e "${YELLOW}Gunicorn error log not found${NC}"
fi

echo ""
echo "========================================="
echo "Health Check Complete"
echo "========================================="
echo ""
echo "Detailed logs:"
echo "  Gunicorn:  tail -f /var/www/inventory/logs/gunicorn-error.log"
echo "  Nginx:     tail -f /var/log/nginx/error.log"
echo "  System:    journalctl -u gunicorn -f"
echo ""
