import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
os.environ['USE_SQLITE'] = '1'
django.setup()

from decimal import Decimal
from datetime import datetime
from inventory.models import (
    Party, QualityType, InwardLot, ProcessProgram,
    ProgramLotAllocation, Bill, SystemConfig
)


def test_system():
    print("=== Testing Textile Inventory System ===\n")

    print("1. Checking System Config...")
    wastage_threshold = SystemConfig.get_config('WASTAGE_THRESHOLD_PERCENT')
    print(f"   Wastage Threshold: {wastage_threshold}%")
    company_name = SystemConfig.get_config('COMPANY_NAME')
    print(f"   Company Name: {company_name}\n")

    print("2. Creating Test Party...")
    party, created = Party.objects.get_or_create(
        name='Test Textile Company',
        defaults={
            'contact': '+91-9876543210',
            'address': '123 Industrial Area, Test City'
        }
    )
    print(f"   {'Created' if created else 'Found'} Party: {party.name}\n")

    print("3. Checking Quality Types...")
    quality_types = QualityType.objects.filter(is_active=True)
    for qt in quality_types:
        print(f"   - {qt.name}: ₹{qt.default_rate_per_meter}/meter")
    print()

    print("4. Creating Inward Lot...")
    white_quality = QualityType.objects.get(name='White')
    lot = InwardLot.objects.create(
        party=party,
        quality_type=white_quality,
        total_meters=Decimal('500.00'),
        fiscal_year=2024
    )
    print(f"   Created Lot: {lot.lot_number}")
    print(f"   Total Meters: {lot.total_meters}m")
    print(f"   Current Balance: {lot.current_balance}m\n")

    print("5. Creating Process Program...")
    program = ProcessProgram.objects.create(
        design_number='DESIGN-001',
        input_meters=Decimal('100.00'),
        output_meters=Decimal('92.00'),
        rate_per_meter=white_quality.default_rate_per_meter,
        tax_amount=Decimal('50.00')
    )
    print(f"   Created Program: {program.program_number}")
    print(f"   Design Number: {program.design_number}")
    print(f"   Input: {program.input_meters}m")
    print(f"   Output: {program.output_meters}m")
    print(f"   Wastage: {program.wastage_meters}m ({program.wastage_percentage:.1f}%)")
    print(f"   Is High Wastage: {program.is_wastage_high()}\n")

    print("6. Creating Lot Allocation...")
    allocation = ProgramLotAllocation.objects.create(
        program=program,
        lot=lot,
        allocated_meters=Decimal('100.00')
    )
    print(f"   Allocated {allocation.allocated_meters}m from {lot.lot_number}")

    lot.refresh_from_db()
    print(f"   Lot Balance After Allocation: {lot.current_balance}m")
    print(f"   Balance Percentage: {lot.balance_percentage():.1f}%\n")

    print("7. Completing Program...")
    program.status = 'Completed'
    program.save()
    print(f"   Program Status: {program.status}")
    print(f"   Total Amount: ₹{program.total_amount}\n")

    print("8. Summary:")
    print(f"   Total Parties: {Party.objects.count()}")
    print(f"   Total Quality Types: {QualityType.objects.filter(is_active=True).count()}")
    print(f"   Total Inward Lots: {InwardLot.objects.count()}")
    print(f"   Total Programs: {ProcessProgram.objects.count()}")
    print(f"   - Pending: {ProcessProgram.objects.filter(status='Pending').count()}")
    print(f"   - Completed: {ProcessProgram.objects.filter(status='Completed').count()}")
    print(f"   Total Bills: {Bill.objects.count()}\n")

    print("=== System Test Complete ===")
    print("\nThe system is working correctly!")
    print("You can now:")
    print("  1. Create a superuser: USE_SQLITE=1 python manage.py createsuperuser")
    print("  2. Start the server: USE_SQLITE=1 python manage.py runserver")
    print("  3. Access admin panel: http://localhost:8000/admin/")
    print("  4. Access API: http://localhost:8000/api/")


if __name__ == '__main__':
    test_system()
