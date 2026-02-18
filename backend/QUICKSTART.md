# Textile Inventory System - Quick Start Guide

## Getting Started in 5 Minutes

### 1. Setup (First Time Only)

```bash
# Activate virtual environment
source venv/bin/activate

# The database is already set up with:
# - User groups (Supervisor, Floor Staff, Admin)
# - System configuration
# - Quality types (White, Rayon)
# - Test data (1 party, 1 lot, 1 program)
```

### 2. Create Admin User

```bash
USE_SQLITE=1 python manage.py createsuperuser
```

Follow the prompts to create your admin account.

### 3. Start the Server

```bash
USE_SQLITE=1 python manage.py runserver
```

### 4. Access the System

**Admin Panel**: http://localhost:8000/admin/
- Login with your superuser credentials
- Manage all data through the admin interface

**API Endpoints**: http://localhost:8000/api/
- Browse the RESTful API
- Test API endpoints

**API Authentication**: http://localhost:8000/api-auth/login/
- Login to access protected endpoints

## Common Workflows

### Adding a New Inward Lot

1. Go to Admin → Inward Lots → Add Inward Lot
2. Select Party and Quality Type
3. Enter total meters and fiscal year
4. Lot number will be auto-generated (e.g., LOT-2024-001)
5. Save

### Creating a Process Program

1. Go to Admin → Process Programs → Add Process Program
2. Enter design number
3. Enter input meters and output meters
4. Wastage will be calculated automatically
5. Add lot allocations (which lots to pull material from)
6. Program number will be auto-generated (e.g., PRG-2026-0001)
7. Save

### Generating a Bill

1. Go to Admin → Process Programs
2. Filter by Status = "Completed"
3. Select multiple completed programs from the same party
4. Choose "Generate Bill (PDF)" from Actions dropdown
5. Click "Go"
6. Bill will be downloaded automatically

### Exporting Party Ledger

1. Go to Admin → Bills
2. Select any bill
3. Choose "Export Party Ledger (Excel)" from Actions
4. Select party and date range
5. Click Submit
6. Excel file will be downloaded

## Test Data Available

The system already contains:

- **Party**: Test Textile Company
- **Quality Types**: White (₹50/m), Rayon (₹65/m)
- **Inward Lot**: LOT-2024-001 (500m total, 400m remaining)
- **Program**: PRG-2026-0001 (100m input, 92m output, 8m wastage)

## Key Features to Explore

### 1. Color-Coded Displays
- **Inward Lots**: Balance shown in red (<10%), orange (10-50%), green (>50%)
- **Process Programs**: Wastage shown in red if exceeds threshold (>15%)

### 2. Auto-Generation
- Lot numbers reset per fiscal year
- Program numbers auto-increment
- Bill numbers auto-increment

### 3. Business Rules
- Cannot edit/delete completed programs
- Lot allocations must not exceed available balance
- Total allocations must equal program input meters

### 4. Image Compression
- Upload design photos (any format)
- Automatic conversion to JPEG
- Compression to 70% quality
- Resize to max 1200px width

## API Quick Reference

### Authentication
```bash
curl -X POST http://localhost:8000/api-auth/login/ \
  -d "username=admin&password=yourpassword"
```

### List Parties
```bash
curl http://localhost:8000/api/parties/ \
  -u admin:yourpassword
```

### Create Inward Lot
```bash
curl -X POST http://localhost:8000/api/inward-lots/ \
  -u admin:yourpassword \
  -H "Content-Type: application/json" \
  -d '{
    "party": 1,
    "quality_type": 1,
    "total_meters": "1000.00",
    "fiscal_year": 2024
  }'
```

### Create Program with Allocations
```bash
curl -X POST http://localhost:8000/api/programs/ \
  -u admin:yourpassword \
  -H "Content-Type: application/json" \
  -d '{
    "design_number": "DESIGN-002",
    "input_meters": "150.00",
    "output_meters": "138.00",
    "rate_per_meter": "50.00",
    "tax_amount": "75.00",
    "lot_allocations": [
      {"lot_id": 1, "allocated_meters": "150.00"}
    ]
  }'
```

### Generate Bill
```bash
curl -X POST http://localhost:8000/api/bills/generate/ \
  -u admin:yourpassword \
  -H "Content-Type: application/json" \
  -d '{
    "party": 1,
    "bill_date": "2024-02-14",
    "program_ids": [1, 2, 3]
  }' \
  --output bill.pdf
```

## Configuration

Modify system settings via Admin → System Configurations:

- `WASTAGE_THRESHOLD_PERCENT`: Alert threshold (default: 15.00)
- `COMPANY_NAME`: Your company name for bills
- `COMPANY_ADDRESS`: Your company address for bills
- `FISCAL_YEAR_START_MONTH`: Fiscal year start (1-12, default: 4 = April)

## Troubleshooting

### "Insufficient balance" Error
Check that the lot has enough remaining balance before allocating.

### "Cannot update completed program" Error
Programs are locked after completion. Create a new program instead.

### Lot Numbers Not Sequential
Lot numbers are per fiscal year. Each year starts from 001.

### Photos Not Displaying
Ensure Pillow is installed: `pip install Pillow`

## Next Steps

1. **Add Your Parties**: Go to Admin → Parties → Add Party
2. **Configure Quality Types**: Update prices in Admin → Quality Types
3. **Add Real Lots**: Create your actual inventory lots
4. **Set Up Users**: Create users and assign to groups (Supervisor/Floor Staff/Admin)
5. **Customize Company Info**: Update SystemConfig for your company details

## Support

For the full documentation, see README.md in the project root.

For detailed API documentation, visit http://localhost:8000/api/ after starting the server.
