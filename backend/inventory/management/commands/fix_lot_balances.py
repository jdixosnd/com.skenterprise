from django.core.management.base import BaseCommand
from inventory.models import InwardLot


class Command(BaseCommand):
    help = 'Fix InwardLot entries with NULL current_balance by setting them equal to total_meters'

    def handle(self, *args, **options):
        # Find all lots with NULL current_balance
        lots_with_null_balance = InwardLot.objects.filter(current_balance__isnull=True)
        count = lots_with_null_balance.count()
        
        if count == 0:
            self.stdout.write(self.style.SUCCESS('No lots with NULL current_balance found.'))
            return
        
        self.stdout.write(f'Found {count} lot(s) with NULL current_balance.')
        
        # Update each lot
        updated_count = 0
        for lot in lots_with_null_balance:
            lot.current_balance = lot.total_meters
            lot.save()
            updated_count += 1
            self.stdout.write(f'  Fixed {lot.lot_number}: set current_balance to {lot.total_meters}')
        
        self.stdout.write(self.style.SUCCESS(f'\nSuccessfully updated {updated_count} lot(s).'))
