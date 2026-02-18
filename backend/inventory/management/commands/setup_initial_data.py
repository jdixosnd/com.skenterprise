from django.core.management.base import BaseCommand
from django.contrib.auth.models import Group, User
from inventory.models import SystemConfig, QualityType


class Command(BaseCommand):
    help = 'Sets up initial data including groups, system config, and quality types'

    def handle(self, *args, **options):
        self.stdout.write('Setting up initial data...')

        supervisor_group, created = Group.objects.get_or_create(name='Supervisor')
        if created:
            self.stdout.write(self.style.SUCCESS('Created Supervisor group'))

        floor_staff_group, created = Group.objects.get_or_create(name='Floor Staff')
        if created:
            self.stdout.write(self.style.SUCCESS('Created Floor Staff group'))

        admin_group, created = Group.objects.get_or_create(name='Admin')
        if created:
            self.stdout.write(self.style.SUCCESS('Created Admin group'))

        SystemConfig.set_config(
            'WASTAGE_THRESHOLD_PERCENT',
            '15.00',
            'Wastage percentage threshold for red-flag alerts'
        )
        self.stdout.write(self.style.SUCCESS('Set wastage threshold config'))

        SystemConfig.set_config(
            'COMPANY_NAME',
            'ABC Textiles',
            'Company name for bills and reports'
        )
        self.stdout.write(self.style.SUCCESS('Set company name config'))

        SystemConfig.set_config(
            'COMPANY_ADDRESS',
            'Industrial Area, City - 123456',
            'Company address for bills and reports'
        )
        self.stdout.write(self.style.SUCCESS('Set company address config'))

        SystemConfig.set_config(
            'FISCAL_YEAR_START_MONTH',
            '4',
            'Fiscal year start month (1-12, where 4 = April)'
        )
        self.stdout.write(self.style.SUCCESS('Set fiscal year start month config'))

        white_quality, created = QualityType.objects.get_or_create(
            name='White',
            defaults={'default_rate_per_meter': 50.00}
        )
        if created:
            self.stdout.write(self.style.SUCCESS('Created White quality type'))

        rayon_quality, created = QualityType.objects.get_or_create(
            name='Rayon',
            defaults={'default_rate_per_meter': 65.00}
        )
        if created:
            self.stdout.write(self.style.SUCCESS('Created Rayon quality type'))

        self.stdout.write(self.style.SUCCESS('Initial data setup complete!'))
        self.stdout.write('\nTo create a superuser, run: python manage.py createsuperuser')
