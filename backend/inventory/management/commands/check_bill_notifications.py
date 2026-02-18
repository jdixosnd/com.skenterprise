from django.core.management.base import BaseCommand
from django.utils import timezone
from inventory.models import Bill

class Command(BaseCommand):
    help = 'Check all bills and generate notifications for payment reminders'

    def handle(self, *args, **options):
        # Get all Sent bills
        sent_bills = Bill.objects.filter(payment_status='Sent', sent_date__isnull=False)

        notifications_created = 0
        status_updates = 0

        for bill in sent_bills:
            # Update outstanding status (will create notifications)
            if bill.update_outstanding_status():
                status_updates += 1
                self.stdout.write(
                    self.style.WARNING(f'Bill {bill.bill_number} marked as Outstanding')
                )

        self.stdout.write(
            self.style.SUCCESS(
                f'Notification check complete. {status_updates} bills updated to Outstanding.'
            )
        )
