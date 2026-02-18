# Data Backup & Restore Guide

## Overview

All models in the Django Admin now have **Import/Export** functionality powered by `django-import-export`. This allows you to:
- **Backup** all database tables periodically
- **Restore** data if you ever lose it
- **Transfer** data between environments (dev, staging, production)
- **Audit** data changes using exported files

---

## Features Added

### Models with Import/Export Buttons

Every admin model now has import/export buttons in the top-right corner:

1. **SystemConfig** - System configuration settings
2. **Party** - Client/party information
3. **QualityType** - Fabric quality types
4. **PartyQualityRate** - Custom rates per party-quality combination
5. **CompanyDetail** - Company details for invoices
6. **InwardLot** - Inward lot entries
7. **ProcessProgram** - Process programs/jobs
8. **ProgramLotAllocation** - Program-lot allocations
9. **Bill** - Bills/invoices
10. **Notification** - System notifications

---

## How to Export Data (Backup)

### Export Single Table

1. Go to Django Admin: `http://localhost:8000/admin/`
2. Navigate to the model you want to backup (e.g., "Parties")
3. Click the **"Export"** button in the top-right corner
4. Choose format:
   - **CSV** - Simple format, good for viewing in Excel
   - **Excel (XLSX)** - Best for Excel users
   - **JSON** - Complete data with relationships
   - **YAML** - Human-readable format
5. Click **"Export"** to download the file

### Export All Tables (Full Backup)

To backup the entire database, export each table individually:

```bash
# From backend directory
python manage.py dumpdata inventory --indent 2 > full_backup_$(date +%Y%m%d_%H%M%S).json
```

Or use the provided backup script:

```bash
# Create a backup script
cat > backup_all_data.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup all tables
python3 manage.py dumpdata inventory.systemconfig --indent 2 > "$BACKUP_DIR/systemconfig.json"
python3 manage.py dumpdata inventory.party --indent 2 > "$BACKUP_DIR/party.json"
python3 manage.py dumpdata inventory.qualitytype --indent 2 > "$BACKUP_DIR/qualitytype.json"
python3 manage.py dumpdata inventory.partyqualityrate --indent 2 > "$BACKUP_DIR/partyqualityrate.json"
python3 manage.py dumpdata inventory.companydetail --indent 2 > "$BACKUP_DIR/companydetail.json"
python3 manage.py dumpdata inventory.inwardlot --indent 2 > "$BACKUP_DIR/inwardlot.json"
python3 manage.py dumpdata inventory.processprogram --indent 2 > "$BACKUP_DIR/processprogram.json"
python3 manage.py dumpdata inventory.programlotallocation --indent 2 > "$BACKUP_DIR/programlotallocation.json"
python3 manage.py dumpdata inventory.bill --indent 2 > "$BACKUP_DIR/bill.json"
python3 manage.py dumpdata inventory.notification --indent 2 > "$BACKUP_DIR/notification.json"

echo "Backup completed in $BACKUP_DIR"
EOF

chmod +x backup_all_data.sh
./backup_all_data.sh
```

---

## How to Import Data (Restore)

### Import Single Table

1. Go to Django Admin
2. Navigate to the model you want to restore
3. Click the **"Import"** button in the top-right corner
4. **Select format** (CSV, Excel, JSON, YAML)
5. **Choose file** to upload
6. Click **"Submit"** to preview the import
7. Review the preview:
   - ✅ Green = Will be added/updated successfully
   - ❌ Red = Errors (will be skipped)
8. Click **"Confirm import"** to apply the changes

### Important Notes for Import

- **Foreign Key Relationships**: The import/export system handles relationships automatically
  - For Party → uses party name
  - For QualityType → uses quality type name
  - For InwardLot → uses lot_number
  - For ProcessProgram → uses program_number
  - For Bill → uses bill_number

- **Binary Fields Excluded**: The following fields are NOT exported/imported:
  - ProcessProgram.design_photo (use design_photo_name only)
  - Bill.pdf_file (regenerate bills after import)
  - CompanyDetail.logo (re-upload manually if needed)

- **Import Order**: When restoring full database, import in this order:
  1. SystemConfig
  2. Party
  3. QualityType
  4. PartyQualityRate
  5. CompanyDetail
  6. InwardLot
  7. ProcessProgram
  8. ProgramLotAllocation
  9. Bill
  10. Notification

---

## Backup Best Practices

### 1. Periodic Backups

Create a cron job for automated backups:

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * cd /path/to/inventory/backend && ./backup_all_data.sh

# Add weekly backup on Sundays at 3 AM
0 3 * * 0 cd /path/to/inventory/backend && ./backup_all_data.sh
```

### 2. Backup Before Major Changes

Always export data before:
- Database migrations
- Major version upgrades
- Bulk data operations
- Deployment to production

### 3. Store Backups Securely

```bash
# Copy backups to external location
rsync -avz backups/ /mnt/backup_drive/inventory_backups/

# Or upload to cloud storage
# rclone copy backups/ remote:inventory-backups/
```

### 4. Test Your Backups

Periodically test restore process:
```bash
# 1. Create test database
createdb textile_inventory_test

# 2. Update settings to use test database
# 3. Run migrations
python3 manage.py migrate

# 4. Import your backup files
# 5. Verify data integrity
```

---

## Restore Process (Disaster Recovery)

### If Database is Corrupted or Lost

1. **Create fresh database**:
```bash
# Drop and recreate (CAREFUL!)
sudo -u postgres psql
DROP DATABASE textile_inventory;
CREATE DATABASE textile_inventory OWNER textile_user;
\q
```

2. **Run migrations**:
```bash
python3 manage.py migrate
```

3. **Create superuser**:
```bash
python3 manage.py createsuperuser
```

4. **Import data in correct order** (see Import Order above)

5. **Verify data**:
```bash
python3 manage.py shell
>>> from inventory.models import Party, InwardLot, ProcessProgram, Bill
>>> print(f"Parties: {Party.objects.count()}")
>>> print(f"Lots: {InwardLot.objects.count()}")
>>> print(f"Programs: {ProcessProgram.objects.count()}")
>>> print(f"Bills: {Bill.objects.count()}")
```

---

## Export Formats

### CSV
- **Best for**: Simple data viewing in Excel/Google Sheets
- **Limitations**: May have issues with special characters, binary data excluded

### Excel (XLSX)
- **Best for**: Business users, sharing with non-technical staff
- **Advantages**: Multiple sheets, formatting preserved

### JSON
- **Best for**: Complete backups, technical users
- **Advantages**: Preserves all data types, relationships, best for restore

### YAML
- **Best for**: Configuration files, human-readable backups
- **Advantages**: Easy to read and edit manually

---

## Troubleshooting

### Import Fails with Foreign Key Errors

**Problem**: Foreign key relationship not found
```
Error: Party with name "ABC Textiles" does not exist
```

**Solution**: Import parent table first
1. Import Party table first
2. Then import dependent tables (InwardLot, etc.)

### Import Shows Duplicate Key Error

**Problem**: Record already exists
```
Error: Duplicate key value violates unique constraint
```

**Solution**: Use update mode
- In import preview, check "Update existing records"
- Or delete existing records first

### Large File Import Timeout

**Problem**: Import takes too long and times out

**Solution**: Split into smaller files
```python
# Split CSV into chunks
import pandas as pd

df = pd.read_csv('large_file.csv')
chunk_size = 1000

for i, chunk in enumerate(df.groupby(df.index // chunk_size)):
    chunk[1].to_csv(f'chunk_{i}.csv', index=False)
```

---

## Security Considerations

1. **Access Control**: Only admin users can import/export
2. **Sensitive Data**: Be careful with exported files containing:
   - Party contact information
   - Financial data (bills, rates)
   - Consider encrypting backup files

3. **Encrypt Backups**:
```bash
# Encrypt backup
tar -czf - backups/ | gpg --symmetric --cipher-algo AES256 > backup_encrypted.tar.gz.gpg

# Decrypt backup
gpg --decrypt backup_encrypted.tar.gz.gpg | tar -xzf -
```

---

## Quick Reference Commands

```bash
# Full database backup
python3 manage.py dumpdata inventory --indent 2 > backup.json

# Full database restore
python3 manage.py loaddata backup.json

# Backup specific model
python3 manage.py dumpdata inventory.party --indent 2 > party.json

# Check Django for errors
python3 manage.py check

# Show database statistics
python3 manage.py shell
>>> from django.apps import apps
>>> for model in apps.get_app_config('inventory').get_models():
...     print(f"{model.__name__}: {model.objects.count()}")
```

---

## Support

For issues or questions:
1. Check Django admin logs
2. Review Django documentation: https://docs.djangoproject.com/
3. Django import-export docs: https://django-import-export.readthedocs.io/

---

**Last Updated**: 2026-02-18
**Version**: 1.0
