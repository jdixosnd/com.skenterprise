# Textile Inventory & Billing System

A comprehensive Django-based system for managing textile inventory, processing programs, and billing operations for textile manufacturing units.

## Features

- **Inventory Management**: Track raw fabric from inward receipt to finished dispatch
- **Multi-Lot Allocation**: Support for complex jobs pulling material from multiple lots
- **Wastage Tracking**: Manual recording and alerting of processing wastage
- **Design Photo Management**: Automatic image compression and storage
- **Bill Generation**: PDF bill generation with full lot traceability
- **Ledger Export**: Excel export for party-wise financial reconciliation
- **Role-Based Access**: Supervisor, Floor Staff, and Admin roles
- **Headless API**: RESTful API for frontend integration

## Tech Stack

- **Backend**: Django 4.2 with Django REST Framework
- **Database**: PostgreSQL (with SQLite fallback for development)
- **Image Processing**: Pillow for automatic compression
- **PDF Generation**: ReportLab
- **Excel Export**: OpenPyXL

## Installation

### Prerequisites

- Python 3.8+
- PostgreSQL (optional, SQLite used by default in development)

### Setup

1. Clone the repository and navigate to the project directory:

```bash
cd inventory
```

2. Create and activate virtual environment:

```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:

```bash
pip install -r requirements.txt
```

4. Run migrations:

```bash
USE_SQLITE=1 python manage.py migrate
```

5. Set up initial data (groups, system config, quality types):

```bash
USE_SQLITE=1 python manage.py setup_initial_data
```

6. Create a superuser:

```bash
USE_SQLITE=1 python manage.py createsuperuser
```

7. Run the development server:

```bash
USE_SQLITE=1 python manage.py runserver
```

8. Access the admin panel at: http://localhost:8000/admin/

## Project Structure

```
inventory/
├── config/                 # Django project settings
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── inventory/              # Main application
│   ├── models.py          # Data models
│   ├── admin.py           # Django admin customizations
│   ├── serializers.py     # DRF serializers
│   ├── views.py           # API views
│   ├── permissions.py     # Custom permission classes
│   ├── reports.py         # PDF/Excel generation
│   ├── urls.py            # API URL routing
│   └── management/        # Management commands
├── requirements.txt
└── README.md
```

## Data Models

### SystemConfig
System-wide configuration settings (wastage threshold, company details, etc.)

### Party
Customer/supplier information with contact details

### QualityType
Fabric quality types (White, Rayon, etc.) with default pricing

### InwardLot
Inventory pool for each inward fabric shipment with:
- Auto-generated lot numbers (LOT-YYYY-###)
- Balance tracking
- Fiscal year management

### ProcessProgram
Processing job records with:
- Auto-generated program numbers (PRG-YYYY-####)
- Design photos with automatic compression
- Wastage calculation
- Multi-lot allocation support
- Read-only after completion

### ProgramLotAllocation
Junction table linking programs to multiple lots with allocated meters

### Bill
Invoice records with:
- Auto-generated bill numbers (BILL-YYYY-####)
- PDF generation
- Automatic total calculation

## API Endpoints

### Authentication
```
POST /api-auth/login/
POST /api-auth/logout/
```

### Parties
```
GET    /api/parties/
POST   /api/parties/
GET    /api/parties/{id}/
PUT    /api/parties/{id}/
DELETE /api/parties/{id}/  (soft delete)
```

### Quality Types
```
GET    /api/quality-types/
POST   /api/quality-types/
GET    /api/quality-types/{id}/
PUT    /api/quality-types/{id}/
```

### Inward Lots
```
GET    /api/inward-lots/
POST   /api/inward-lots/
GET    /api/inward-lots/{id}/
PUT    /api/inward-lots/{id}/
GET    /api/inward-lots/{id}/available-balance/
GET    /api/inward-lots/available-lots/?min_balance=X&quality_type=Y
```

### Process Programs
```
GET    /api/programs/
POST   /api/programs/  (with nested lot_allocations)
GET    /api/programs/{id}/
PUT    /api/programs/{id}/  (only if status=Pending)
POST   /api/programs/{id}/upload-photo/
POST   /api/programs/{id}/complete/
GET    /api/programs/high-wastage/
```

### Bills
```
GET    /api/bills/
POST   /api/bills/generate/  (create bill + download PDF)
GET    /api/bills/{id}/
GET    /api/bills/{id}/pdf/
POST   /api/bills/export-ledger/
```

### System Config
```
GET    /api/config/
GET    /api/config/get_config/?key=KEY
POST   /api/config/set_config/
```

## Business Logic

### Lot Numbering
- Format: `LOT-YYYY-###` (e.g., LOT-2024-001)
- Auto-increments within fiscal year
- Manual reset functionality available

### Wastage Calculation
- Formula: `wastage_meters = input_meters - output_meters`
- Percentage: `(wastage_meters / input_meters) × 100`
- Configurable threshold for alerts (default: 15%)

### Image Compression
- Automatic conversion to JPEG format
- Resize to max 1200px width
- 70% quality compression
- Executed during `ProcessProgram.save()`

### Multi-Lot Allocation
- Programs can pull material from multiple lots
- Balance validation before allocation
- Automatic lot balance updates via transactions
- Restoration of balance on allocation deletion

### Pricing Logic
- Default rate from `QualityType.default_rate_per_meter`
- Override available on individual `ProcessProgram`
- Manual tax entry support
- Total = `(output_meters × rate_per_meter) + tax_amount`

## Admin Panel Features

### SystemConfig Admin
- Key-value configuration editor

### Party Admin
- List with total lots and programs
- Search by name, contact, address
- Soft delete support

### QualityType Admin
- Inline editing of quality types
- Active/inactive filtering

### InwardLot Admin
- Color-coded balance display (red < 10%, orange 10-50%, green > 50%)
- Fiscal year filtering
- Manual balance adjustment
- Reset lot counter action

### ProcessProgram Admin
- Photo thumbnails in list view
- Red wastage alerts for high wastage
- Inline lot allocation editing
- Read-only after completion
- Admin actions:
  - Mark as Completed
  - Generate Bill (PDF)

### Bill Admin
- Program-wise breakdown
- Admin actions:
  - Download PDF
  - Export Ledger (Excel)

## User Roles & Permissions

### Supervisor
- Create InwardLots
- View all data
- Cannot access billing functions

### Floor Staff
- Create/edit ProcessPrograms (Pending only)
- Upload design photos
- Cannot delete records

### Admin
- Full access to all features
- Billing operations
- System configuration
- User management

## Development

### Running Tests
```bash
USE_SQLITE=1 python manage.py test
```

### Creating Migrations
```bash
USE_SQLITE=1 python manage.py makemigrations
```

### Accessing Django Shell
```bash
USE_SQLITE=1 python manage.py shell
```

## Production Deployment

1. Update `config/settings.py`:
   - Set `DEBUG = False`
   - Configure `ALLOWED_HOSTS`
   - Set up PostgreSQL database
   - Configure static/media file serving
   - Use environment variables for secrets

2. Collect static files:
```bash
python manage.py collectstatic
```

3. Use production WSGI server (Gunicorn, uWSGI)

4. Set up reverse proxy (Nginx, Apache)

5. Configure SSL/TLS certificates

## API Usage Example

### Creating a Process Program with Multi-Lot Allocation

```python
import requests

# Login
session = requests.Session()
session.post('http://localhost:8000/api-auth/login/', data={
    'username': 'admin',
    'password': 'password'
})

# Create program
response = session.post('http://localhost:8000/api/programs/', json={
    'design_number': 'DESIGN-001',
    'input_meters': 100.00,
    'output_meters': 92.00,
    'rate_per_meter': 50.00,
    'tax_amount': 100.00,
    'notes': 'Test program',
    'lot_allocations': [
        {'lot_id': 1, 'allocated_meters': 60.00},
        {'lot_id': 2, 'allocated_meters': 40.00}
    ]
})

print(response.json())
```

### Generating a Bill

```python
# Generate bill for completed programs
response = session.post('http://localhost:8000/api/bills/generate/', json={
    'party': 1,
    'bill_date': '2024-02-14',
    'program_ids': [1, 2, 3]
})

# Save PDF
with open('bill.pdf', 'wb') as f:
    f.write(response.content)
```

## Configuration

Default system configurations can be modified via:

1. Django Admin: SystemConfig model
2. API: `/api/config/set_config/`
3. Management command: Update `setup_initial_data.py`

Key configurations:
- `WASTAGE_THRESHOLD_PERCENT`: Wastage alert threshold (default: 15.00)
- `COMPANY_NAME`: Company name for bills
- `COMPANY_ADDRESS`: Company address for bills
- `FISCAL_YEAR_START_MONTH`: Fiscal year start (1-12, default: 4 = April)

## Troubleshooting

### BinaryField Image Issues
If design photos don't display, ensure Pillow is installed and images are JPEG format.

### Lot Balance Errors
Check that allocations don't exceed available lot balance. Use transactions for atomic operations.

### PDF Generation Errors
Ensure ReportLab is installed and has write permissions to the media directory.

## License

Proprietary - All rights reserved

## Support

For issues and feature requests, contact the development team.
