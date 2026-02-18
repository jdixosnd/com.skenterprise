#!/bin/bash

# Textile Inventory Backup Script
# This script creates periodic backups of all database tables

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
BACKUP_BASE_DIR="backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$BACKUP_BASE_DIR/$TIMESTAMP"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  Textile Inventory Database Backup${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR"
echo -e "${GREEN}✓${NC} Created backup directory: $BACKUP_DIR"

# Function to backup a model
backup_model() {
    local model_name=$1
    local display_name=$2
    echo -n "  Backing up $display_name... "
    if python3 manage.py dumpdata inventory.$model_name --indent 2 > "$BACKUP_DIR/$model_name.json" 2>/dev/null; then
        echo -e "${GREEN}✓${NC}"
        return 0
    else
        echo -e "${RED}✗${NC}"
        return 1
    fi
}

# Backup all models
echo ""
echo "Backing up individual models:"

backup_model "systemconfig" "System Config"
backup_model "party" "Parties"
backup_model "qualitytype" "Quality Types"
backup_model "partyqualityrate" "Party Quality Rates"
backup_model "companydetail" "Company Details"
backup_model "inwardlot" "Inward Lots"
backup_model "processprogram" "Process Programs"
backup_model "programlotallocation" "Program Lot Allocations"
backup_model "bill" "Bills"
backup_model "notification" "Notifications"

# Create a combined backup
echo ""
echo -n "Creating combined backup... "
if python3 manage.py dumpdata inventory --indent 2 > "$BACKUP_DIR/full_backup.json" 2>/dev/null; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
fi

# Create a README for this backup
cat > "$BACKUP_DIR/README.txt" << EOF
Textile Inventory Database Backup
==================================

Backup Date: $(date)
Backup Location: $BACKUP_DIR

Contents:
---------
- systemconfig.json       : System configuration settings
- party.json             : Party/client information
- qualitytype.json       : Quality types and default rates
- partyqualityrate.json  : Custom party-quality rates
- companydetail.json     : Company details for invoices
- inwardlot.json         : Inward lot entries
- processprogram.json    : Process programs/jobs
- programlotallocation.json : Program-lot allocations
- bill.json              : Bills and invoices
- notification.json      : System notifications
- full_backup.json       : Combined backup of all tables

Restore Instructions:
--------------------
To restore this backup:

1. Ensure database and migrations are up to date:
   python3 manage.py migrate

2. Load data in dependency order:
   python3 manage.py loaddata systemconfig.json
   python3 manage.py loaddata party.json
   python3 manage.py loaddata qualitytype.json
   python3 manage.py loaddata partyqualityrate.json
   python3 manage.py loaddata companydetail.json
   python3 manage.py loaddata inwardlot.json
   python3 manage.py loaddata processprogram.json
   python3 manage.py loaddata programlotallocation.json
   python3 manage.py loaddata bill.json
   python3 manage.py loaddata notification.json

Or restore all at once:
   python3 manage.py loaddata full_backup.json

For more information, see DATA_BACKUP_GUIDE.md
EOF

# Calculate backup size
BACKUP_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Backup Completed Successfully!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "Backup Location: $BACKUP_DIR"
echo "Backup Size: $BACKUP_SIZE"
echo ""
echo "To restore this backup, run:"
echo -e "${BLUE}python3 manage.py loaddata $BACKUP_DIR/full_backup.json${NC}"
echo ""

# Keep only last 30 backups
echo "Cleaning old backups (keeping last 30)..."
cd "$BACKUP_BASE_DIR" 2>/dev/null
if [ $? -eq 0 ]; then
    ls -t | tail -n +31 | xargs -r rm -rf
    REMAINING=$(ls | wc -l)
    echo -e "${GREEN}✓${NC} Backup count: $REMAINING"
    cd - > /dev/null
fi

echo ""
echo "Done! 🎉"
