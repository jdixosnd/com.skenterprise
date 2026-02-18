# 📱 User Guide - Textile Inventory System

## 🚀 Quick Start

### Option 1: Django Admin Panel (Fully Working!)
**Best for: Full functionality right now**

1. **Open**: http://localhost:8000/admin/
2. **Login**: `admin` / `admin123`
3. **Full access to all features**

### Option 2: React Frontend (Demo Mode)
**Best for: Testing mobile-friendly UI**

1. **Open**: http://localhost:3000
2. **Enter your name** (optional, no password needed in demo mode)
3. **Click "Enter System"** to access the unified dashboard
4. **Use tabs to switch between features**:
   - 📦 **Inward Log** - Record incoming stock
   - 🏭 **Program Entry** - Create processing jobs with camera
   - 💰 **Billing & Reports** - Generate bills and export ledgers

---

## 📊 How to Navigate - Django Admin

### Main Menu (Left Sidebar):
- **Parties** - Manage customers/suppliers
- **Quality Types** - Fabric types (White, Rayon)
- **Inward Lots** - Incoming stock
- **Process Programs** - Processing jobs
- **Bills** - Generated invoices
- **System Configurations** - Settings

### Navigation:
- Click any item to see list view
- Click **"Add [Item] +"** button to create new
- Click on existing item to edit
- Use **filters** (right sidebar) to search

---

## 📝 How to Record Details

### 1️⃣ Create Inward Lot (Raw Stock Entry)

**Steps:**
1. Go to **Inward Lots** → **Add Inward Lot +**
2. Fill in:
   - **Party**: Select from dropdown (Test Textile Company)
   - **Quality Type**: White or Rayon
   - **Total Meters**: e.g., 1000.00
   - **Fiscal Year**: 2024
   - **Notes**: Optional
3. Click **Save**
4. ✅ System generates: **LOT-2024-002**

**Result:**
- New lot created with full balance
- Appears in recent lots table
- Available for program allocation

---

### 2️⃣ Create Process Program (Job Entry)

**Steps:**
1. Go to **Process Programs** → **Add Process Program +**
2. Fill in:
   - **Design Number**: DESIGN-002
   - **Input Meters**: 150.00
   - **Output Meters**: 140.00
   - **Wastage**: Auto-calculated (10.00m in this case)
   - **Rate per Meter**: 50.00 (or leave blank for default)
   - **Tax Amount**: 0.00

3. **Scroll Down to "Program Lot Allocations"**
4. Click **"Add another Program Lot Allocation"**
5. Fill in:
   - **Lot**: Select LOT-2024-001 from dropdown
   - **Allocated Meters**: 150.00 (must equal input!)

6. Click **Save**
7. ✅ System generates: **PRG-2026-0002**

**Result:**
- Program created
- Lot balance automatically reduced
- Wastage calculated and displayed
- Ready for completion

---

### 3️⃣ Mark Program as Completed

**Steps:**
1. Go to **Process Programs**
2. Find your program in list
3. Check the checkbox next to it
4. Select **"Mark selected as Completed"** from Actions dropdown
5. Click **Go**
6. ✅ Status changes to "Completed"

**Result:**
- Program locked (read-only)
- Ready for billing

---

### 4️⃣ Generate Bill (Create Invoice)

**Steps:**
1. Go to **Process Programs**
2. Use filter to show **Status = Completed**
3. Check multiple programs (from same party!)
4. Select **"Generate Bill (PDF)"** from Actions dropdown
5. Click **Go**
6. ✅ PDF downloads automatically!

**Result:**
- Bill created with auto number: **BILL-2026-0001**
- PDF includes:
  - All program details
  - Lot traceability
  - Totals and tax
  - Company header

---

### 5️⃣ Export Ledger (Excel Report)

**Steps:**
1. Go to **Bills**
2. Select any bill
3. Choose **"Export Party Ledger (Excel)"** from Actions
4. Select:
   - **Party**: Test Textile Company
   - **Start Date**: 2024-01-01
   - **End Date**: 2024-12-31
5. Click **Submit**
6. ✅ Excel file downloads!

**Result:**
- Multi-sheet Excel workbook
- Sheet 1: Inward lots
- Sheet 2: Programs
- Sheet 3: Summary statistics

---

## 🎨 React Frontend Navigation (Demo Mode)

### Unified Dashboard - All Features in One Place

After entering the system, you'll see a **tabbed interface** with three main sections:

#### **📦 Inward Log Tab**
- **Create New Inward Lot Form:**
  - Select party from dropdown
  - Select quality type
  - Enter total meters
  - Set fiscal year (auto-filled)
  - Add optional notes
  - Submit → Auto-generates lot number (LOT-YYYY-###)
- **Recent Lots Table:**
  - Shows lot number, party, quality, total meters, balance
  - Color-coded balance percentages
  - Green = healthy (>50%), Orange = medium (10-50%), Red = low (<10%)

#### **🏭 Program Entry Tab**
- **Camera Feature:** 📷 Take Photo button
  - Opens camera modal for mobile
  - Capture live photo or upload from gallery
  - Switch between front/rear camera
  - Preview before confirming
- **Program Form:**
  - Design Number (required)
  - Input/Output meters (required)
  - Wastage auto-calculated (Input - Output)
  - Lot allocation section (multi-lot support)
    - Add multiple lots with "+ Add Another Lot"
    - Shows available balance for each lot
    - Total must equal input meters
  - Rate per meter (optional override)
  - Tax amount (default 0.00)
  - Optional notes
- **Recent Programs Table:**
  - Shows program number, design, input/output, wastage %, status
  - Red highlight for high wastage (>15%)

#### **💰 Billing & Reports Tab**
- **Filter Controls:**
  - Select party (required for bill generation)
  - Status filter (Pending/Completed)
  - Date range picker (for ledger export)
- **Action Buttons:**
  - **Generate Bill** - Select completed programs → Downloads PDF
  - **Export Ledger** - Downloads Excel with lot/program data
- **Programs Table:**
  - Checkbox selection (only completed programs can be selected)
  - Full program details with amounts
  - Filter by party automatically
- **Summary Statistics:**
  - Total programs count
  - Selected programs count
  - Total input/output meters

---

## 🔄 Complete Workflow Example

### Scenario: Process 100m of White fabric

**Step 1: Receive Raw Material**
```
Admin Panel → Inward Lots → Add
- Party: Test Textile Company
- Quality: White
- Total Meters: 500.00
- Fiscal Year: 2024
→ Creates: LOT-2024-003 with 500m balance
```

**Step 2: Create Processing Job**
```
Admin Panel → Process Programs → Add
- Design: DESIGN-003
- Input: 100.00m
- Output: 92.00m (8m wastage)
- Allocate from: LOT-2024-003 (100m)
→ Creates: PRG-2026-0003
→ LOT-2024-003 balance: 500m → 400m
```

**Step 3: Complete the Job**
```
Process Programs → Check PRG-2026-0003
→ Actions: "Mark as Completed"
→ Status: Pending → Completed
```

**Step 4: Generate Bill**
```
Process Programs → Filter: Completed
→ Check PRG-2026-0003
→ Actions: "Generate Bill"
→ Downloads: BILL-2026-0001.pdf
```

**Step 5: Monthly Report**
```
Bills → Select party
→ Actions: "Export Ledger"
→ Date range: Jan-Dec 2024
→ Downloads: Ledger_TestTextileCompany.xlsx
```

---

## 📱 Mobile Usage (React Frontend)

### Camera Feature:
1. Open **Floor Staff Dashboard** on mobile
2. Tap **📷 Take Photo**
3. **Allow camera access** when prompted
4. **Capture photo** or **choose from gallery**
5. **Switch camera** (front/rear)
6. **Preview** → **Confirm** → Photo attached!

### Touch Optimizations:
- Large buttons (44px minimum)
- Easy-to-tap controls
- Swipe-friendly tables
- Responsive layouts

---

## 🎯 Key Features

### Auto-Generation
- ✅ Lot numbers: LOT-YYYY-###
- ✅ Program numbers: PRG-YYYY-####
- ✅ Bill numbers: BILL-YYYY-####

### Auto-Calculation
- ✅ Wastage: Input - Output
- ✅ Wastage %: (Wastage / Input) × 100
- ✅ Balance updates: Automatic on allocation

### Validation
- ✅ Can't allocate more than lot balance
- ✅ Total allocations must equal input
- ✅ Completed programs are read-only
- ✅ Output can't exceed input

### Visual Alerts
- 🔴 Red: High wastage (>15%), Low balance (<10%)
- 🟢 Green: Normal operations
- 🟠 Orange: Medium balance (10-50%)

---

## 🔍 Tips & Tricks

### Quick Search:
- Use **search box** in admin list views
- Type lot number, design number, or party name
- Instant filtering

### Filters:
- Right sidebar in admin
- Filter by status, date, party, quality
- Combine multiple filters

### Bulk Operations:
- Select multiple items
- Use Actions dropdown
- Apply to all at once

### Keyboard Shortcuts (Admin):
- **Tab**: Move between fields
- **Enter**: Submit form
- **Esc**: Close popups

---

## 🐛 Troubleshooting

### Can't Create Program?
- ✅ Check lot has sufficient balance
- ✅ Ensure total allocations = input meters
- ✅ All required fields filled

### Can't Generate Bill?
- ✅ Programs must be "Completed" status
- ✅ All programs must be from same party
- ✅ At least one program selected

### Camera Not Working?
- ✅ Use HTTPS in production
- ✅ Check browser permissions
- ✅ Fallback: Use gallery upload

### Balance Seems Wrong?
- ✅ Check program allocations
- ✅ Admin can manually adjust if needed
- ✅ All changes are logged

---

## 📞 Quick Reference

**URLs:**
- Admin Panel: http://localhost:8000/admin/
- React Frontend: http://localhost:3000
- API Docs: http://localhost:8000/api/

**Login:**
- Username: `admin`
- Password: `admin123`

**Demo Mode:**
- Single unified interface with all features
- No role restrictions - access everything from one dashboard
- Switch between features using tabs (Inward Log, Program Entry, Billing)

---

## 🎓 Next Steps

1. **Create test data:**
   - Add 2-3 parties
   - Create 5-10 lots
   - Process 10-15 programs
   - Generate 2-3 bills

2. **Test workflows:**
   - Full material lifecycle
   - Multi-lot programs
   - Billing for multiple programs

3. **Try mobile:**
   - Access from phone
   - Test camera feature
   - Check responsiveness

4. **Explore reports:**
   - Generate various bills
   - Export ledgers
   - View statistics

Enjoy your Textile Inventory System! 🎉
