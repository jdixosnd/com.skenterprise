# Server Startup Guide

## Your System Configuration
- **IP Address:** 192.168.1.21
- **Backend (Django):** http://192.168.1.21:8000
- **Frontend (React):** http://192.168.1.21:3000
- **Django Admin:** http://192.168.1.21:8000/admin

## Quick Start Commands

### Option 1: Run Backend and Frontend Separately

**Terminal 1 - Backend (Django):**
```bash
cd /home/sohel/code/inventory
python manage.py runserver 0.0.0.0:8000
```

**Terminal 2 - Frontend (React):**
```bash
cd /home/sohel/code/inventory/frontend
npm run dev -- --host 0.0.0.0 --port 3000
```

### Option 2: Use the Startup Script (Recommended)

I've created a startup script for you. Just run:
```bash
cd /home/sohel/code/inventory
bash start_servers.sh
```

## Access URLs

Once both servers are running, you can access:

1. **Frontend Application:**
   - From your computer: http://192.168.1.21:3000
   - From other devices on network: http://192.168.1.21:3000

2. **Django Admin:**
   - From your computer: http://192.168.1.21:8000/admin
   - From other devices on network: http://192.168.1.21:8000/admin

3. **API Endpoints:**
   - http://192.168.1.21:8000/api/

## Default Login Credentials

If you don't have a user account yet, create one:

```bash
cd /home/sohel/code/inventory
python manage.py createsuperuser
```

Follow the prompts to create:
- Username: (your choice)
- Email: (optional)
- Password: (your choice)

## Troubleshooting

### Issue: "Connection refused" or cannot access server

**Solution 1:** Check firewall
```bash
sudo ufw allow 8000
sudo ufw allow 3000
```

**Solution 2:** Verify servers are running
```bash
# Check if Django is running
curl http://192.168.1.21:8000/api/

# Check if frontend is running
curl http://192.168.1.21:3000/
```

**Solution 3:** Check if ports are in use
```bash
sudo netstat -tulpn | grep :8000
sudo netstat -tulpn | grep :3000
```

### Issue: "CSRF verification failed"

**Solution:** Clear browser cookies and cache, then refresh the page.

### Issue: Frontend shows "Network Error"

**Solution:** Make sure backend is running first, then start frontend.

### Issue: Login not working

**Possible causes:**
1. No user account created yet → Run `python manage.py createsuperuser`
2. Wrong credentials → Check username/password
3. Backend not running → Start backend server first
4. CSRF issues → Clear cookies and try again

## Stop Servers

Press `Ctrl + C` in each terminal window to stop the servers.

## Checking Server Status

**Backend Status:**
```bash
curl http://192.168.1.21:8000/api/
# Should return JSON response
```

**Frontend Status:**
```bash
curl http://192.168.1.21:3000/
# Should return HTML
```

## Network Access

To access from other devices on the same network:
1. Make sure both devices are on the same WiFi/network
2. Use the URL: http://192.168.1.21:3000
3. If blocked, check firewall settings

## Notes

- `0.0.0.0` means "bind to all network interfaces" - this allows access from your IP
- Your `.env` file is already configured correctly
- Django settings already allow your IP address
- CORS is enabled for cross-origin requests
