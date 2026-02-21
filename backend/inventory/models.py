import io
from datetime import date
from decimal import Decimal
from django.db import models, transaction
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.utils import timezone
from PIL import Image


class SystemConfig(models.Model):
    key = models.CharField(max_length=100, unique=True, db_index=True)
    value = models.TextField()
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "System Configuration"
        verbose_name_plural = "System Configurations"
        ordering = ['key']

    def __str__(self):
        return f"{self.key}: {self.value}"

    @classmethod
    def get_config(cls, key, default=None):
        try:
            return cls.objects.get(key=key).value
        except cls.DoesNotExist:
            return default

    @classmethod
    def set_config(cls, key, value, description=None):
        config, created = cls.objects.update_or_create(
            key=key,
            defaults={'value': str(value), 'description': description}
        )
        return config


class Party(models.Model):
    name = models.CharField(max_length=200, unique=True, db_index=True)
    contact = models.CharField(max_length=100, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Party"
        verbose_name_plural = "Parties"
        ordering = ['name']

    def __str__(self):
        return self.name

    def total_inward_lots(self):
        return self.inwardlot_set.count()

    def total_programs(self):
        return ProcessProgram.objects.filter(
            programlotallocation__lot__party=self
        ).distinct().count()


class PartyQualityRate(models.Model):
    """
    Custom rate per meter for specific Party-QualityType combinations.
    Overrides QualityType.default_rate_per_meter when present.
    """
    party = models.ForeignKey(
        'Party',
        on_delete=models.CASCADE,
        related_name='quality_rates'
    )
    quality_type = models.ForeignKey(
        'QualityType',
        on_delete=models.CASCADE,
        related_name='party_rates'
    )
    rate_per_meter = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text="Custom rate for this party-quality combination"
    )
    notes = models.TextField(
        blank=True,
        help_text="Optional notes about this pricing"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'party_quality_rates'
        unique_together = [['party', 'quality_type']]
        ordering = ['party__name', 'quality_type__name']
        indexes = [
            models.Index(fields=['party', 'quality_type']),
        ]
        verbose_name = "Party Quality Rate"
        verbose_name_plural = "Party Quality Rates"

    def __str__(self):
        return f"{self.party.name} - {self.quality_type.name}: ₹{self.rate_per_meter}/m"

    def clean(self):
        if self.rate_per_meter <= 0:
            raise ValidationError("Rate must be greater than zero")


class QualityType(models.Model):
    name = models.CharField(max_length=100, unique=True, db_index=True)
    default_rate_per_meter = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Quality Type"
        verbose_name_plural = "Quality Types"
        ordering = ['name']

    def __str__(self):
        return f"{self.name} (₹{self.default_rate_per_meter}/m)"


class CompanyDetail(models.Model):
    """Company details for invoice generation, with quality-type-specific GST"""
    name = models.CharField(max_length=200)
    address = models.TextField()
    phone = models.CharField(max_length=20)
    email = models.EmailField()
    quality_type = models.OneToOneField(
        QualityType,
        on_delete=models.CASCADE,
        related_name='company_detail',
        help_text="Quality type for which this company detail applies"
    )
    gst_number = models.CharField(
        max_length=15,
        blank=True,
        null=True,
        help_text="GSTIN - leave blank if not applicable for this quality type"
    )
    logo = models.ImageField(
        upload_to='company_logos/',
        blank=True,
        null=True,
        help_text="Company logo for PDF invoices"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Company Detail"
        verbose_name_plural = "Company Details"
        ordering = ['quality_type__name']

    def __str__(self):
        return f"{self.name} - {self.quality_type.name}"



class InwardLot(models.Model):
    lot_number = models.CharField(max_length=50, unique=True, db_index=True)
    party = models.ForeignKey(Party, on_delete=models.PROTECT)
    quality_type = models.ForeignKey(QualityType, on_delete=models.PROTECT)
    total_meters = models.DecimalField(max_digits=10, decimal_places=2)
    current_balance = models.DecimalField(max_digits=10, decimal_places=2)
    inward_date = models.DateField(default=date.today)
    fiscal_year = models.IntegerField()
    is_gstin_registered = models.BooleanField(
        default=False,
        help_text="Whether this lot is for a GSTIN-registered transaction"
    )
    lr_number = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="LR (Lorry Receipt) Number - can be duplicated across lots"
    )
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Inward Lot"
        verbose_name_plural = "Inward Lots"
        ordering = ['-lot_number']

    def __str__(self):
        return f"{self.lot_number} - {self.party.name} ({self.quality_type.name})"

    def save(self, *args, **kwargs):
        if not self.pk:
            if not self.lot_number:
                self.lot_number = self.generate_next_lot_number(self.fiscal_year)
            if not self.current_balance:
                self.current_balance = self.total_meters
        super().save(*args, **kwargs)

    def clean(self):
        if self.current_balance > self.total_meters:
            raise ValidationError("Current balance cannot exceed total meters")
        if self.current_balance < 0:
            raise ValidationError("Current balance cannot be negative")

    @classmethod
    def generate_next_lot_number(cls, fiscal_year):
        prefix = f"LOT-{fiscal_year}-"
        last_lot = cls.objects.filter(
            lot_number__startswith=prefix
        ).order_by('-lot_number').first()

        if last_lot:
            last_number = int(last_lot.lot_number.split('-')[-1])
            next_number = last_number + 1
        else:
            next_number = 1

        return f"{prefix}{next_number:03d}"

    def balance_percentage(self):
        if self.total_meters > 0:
            return (self.current_balance / self.total_meters) * 100
        return 0


class ProcessProgram(models.Model):
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Completed', 'Completed'),
    ]

    program_number = models.CharField(max_length=50, unique=True, db_index=True)
    design_number = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    challan_no = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        unique=True,
        db_index=True,
        help_text="Challan number for this program (optional, must be unique)"
    )
    design_photo = models.BinaryField(blank=True, null=True)
    design_photo_name = models.CharField(max_length=255, blank=True, null=True)
    input_meters = models.DecimalField(max_digits=10, decimal_places=2)
    wastage_meters = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    output_meters = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')
    rate_per_meter = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        blank=True,
        null=True
    )
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(blank=True, null=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        blank=True,
        null=True
    )
    notes = models.TextField(blank=True, null=True)

    class Meta:
        verbose_name = "Process Program"
        verbose_name_plural = "Process Programs"
        ordering = ['-program_number']

    def __str__(self):
        return f"{self.program_number} - Design {self.design_number}"

    def save(self, *args, **kwargs):
        if not self.pk and not self.program_number:
            self.program_number = self.generate_next_program_number()

        if self.output_meters and self.input_meters:
            self.wastage_meters = self.input_meters - self.output_meters

        if self.design_photo and isinstance(self.design_photo, (bytes, memoryview)):
            self.design_photo = self.compress_image(self.design_photo)

        super().save(*args, **kwargs)

    def clean(self):
        if self.output_meters > self.input_meters:
            raise ValidationError("Output meters cannot exceed input meters")
        if self.input_meters < 0 or self.output_meters < 0:
            raise ValidationError("Meters cannot be negative")

        allocations = self.programlotallocation_set.all()
        if allocations.exists():
            total_allocated = sum(a.allocated_meters for a in allocations)
            if abs(total_allocated - self.input_meters) > Decimal('0.01'):
                raise ValidationError(
                    f"Total allocated meters ({total_allocated}) must equal input meters ({self.input_meters})"
                )

    @classmethod
    def generate_next_program_number(cls):
        from datetime import datetime
        current_year = datetime.now().year
        prefix = f"PRG-{current_year}-"

        last_program = cls.objects.filter(
            program_number__startswith=prefix
        ).order_by('-program_number').first()

        if last_program:
            last_number = int(last_program.program_number.split('-')[-1])
            next_number = last_number + 1
        else:
            next_number = 1

        return f"{prefix}{next_number:04d}"

    @staticmethod
    def get_rate_for_party_quality(party, quality_type):
        """
        Resolve rate for a party-quality combination.

        Priority:
        1. Party-specific rate (PartyQualityRate)
        2. Quality type default rate
        3. Decimal('0')

        Args:
            party: Party instance
            quality_type: QualityType instance

        Returns:
            Decimal: Rate per meter
        """
        # Try party-specific rate first
        try:
            party_rate = PartyQualityRate.objects.get(
                party=party,
                quality_type=quality_type
            )
            return party_rate.rate_per_meter
        except PartyQualityRate.DoesNotExist:
            pass

        # Fall back to quality type default
        if quality_type and quality_type.default_rate_per_meter:
            return quality_type.default_rate_per_meter

        # Last resort
        return Decimal('0')

    def get_effective_rate(self):
        """
        Get the effective rate for this program.

        Priority:
        1. Program's own rate_per_meter (if set)
        2. Party-specific rate
        3. Quality type default
        4. Decimal('0')
        """
        # If program has explicit rate, use it
        if self.rate_per_meter and self.rate_per_meter > 0:
            return self.rate_per_meter

        # Get first lot allocation to determine party and quality
        lots = self.get_lots()
        if not lots:
            return Decimal('0')

        first_lot = lots[0]
        party = first_lot.party
        quality_type = first_lot.quality_type

        # Use static helper for party-quality rate resolution
        return self.get_rate_for_party_quality(party, quality_type)

    @staticmethod
    def compress_image(image_data):
        try:
            if isinstance(image_data, memoryview):
                image_data = bytes(image_data)

            image = Image.open(io.BytesIO(image_data))

            if image.mode in ('RGBA', 'LA', 'P'):
                image = image.convert('RGB')

            if image.width > 1200:
                ratio = 1200 / image.width
                new_size = (1200, int(image.height * ratio))
                image = image.resize(new_size, Image.Resampling.LANCZOS)

            buffer = io.BytesIO()
            image.save(buffer, format='JPEG', quality=70, optimize=True)
            return buffer.getvalue()
        except Exception:
            return image_data

    @property
    def wastage_percentage(self):
        if self.input_meters > 0:
            return (self.wastage_meters / self.input_meters) * 100
        return Decimal('0')

    @property
    def total_amount(self):
        if self.rate_per_meter:
            return (self.output_meters * self.rate_per_meter) + self.tax_amount
        return Decimal('0')

    def is_wastage_high(self):
        threshold = Decimal(SystemConfig.get_config('WASTAGE_THRESHOLD_PERCENT', '15.00'))
        return self.wastage_percentage > threshold

    def get_lots(self):
        return InwardLot.objects.filter(programlotallocation__program=self).distinct()

    def get_gstin_status(self):
        """Returns the GSTIN status based on lot allocations"""
        lots = self.get_lots()
        if lots:
            return lots[0].is_gstin_registered
        return None

    def is_billed(self):
        """Check if program is included in any non-scrapped bill"""
        return self.bills.exclude(payment_status='Scrap').exists()

    def get_bill_number(self):
        """Get bill number if program is billed"""
        bill = self.bills.exclude(payment_status='Scrap').first()
        return bill.bill_number if bill else None


class ProgramLotAllocation(models.Model):
    program = models.ForeignKey(ProcessProgram, on_delete=models.CASCADE)
    lot = models.ForeignKey(InwardLot, on_delete=models.PROTECT)
    allocated_meters = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Program Lot Allocation"
        verbose_name_plural = "Program Lot Allocations"
        unique_together = [['program', 'lot']]
        ordering = ['program', '-created_at']

    def __str__(self):
        return f"{self.program.program_number} <- {self.lot.lot_number} ({self.allocated_meters}m)"

    def clean(self):
        if self.allocated_meters <= 0:
            raise ValidationError("Allocated meters must be positive")

        if not self.pk:
            if self.lot.current_balance < self.allocated_meters:
                raise ValidationError(
                    f"Insufficient balance in Lot {self.lot.lot_number}. "
                    f"Available: {self.lot.current_balance}m, Requested: {self.allocated_meters}m"
                )

        # GSTIN consistency validation
        if self.program_id:
            existing_allocations = ProgramLotAllocation.objects.filter(
                program=self.program
            ).exclude(pk=self.pk)

            if existing_allocations.exists():
                first_lot = existing_allocations.first().lot
                if first_lot.is_gstin_registered != self.lot.is_gstin_registered:
                    raise ValidationError(
                        f"GSTIN mismatch: All lots in a program must have the same GSTIN status. "
                        f"Existing lots are {'GSTIN registered' if first_lot.is_gstin_registered else 'non-GSTIN'}, "
                        f"but selected lot {self.lot.lot_number} is {'GSTIN registered' if self.lot.is_gstin_registered else 'non-GSTIN'}."
                    )

    def save(self, *args, **kwargs):
        self.full_clean()

        with transaction.atomic():
            if not self.pk:
                self.lot.current_balance -= self.allocated_meters
                self.lot.save()
            else:
                old_allocation = ProgramLotAllocation.objects.get(pk=self.pk)
                difference = self.allocated_meters - old_allocation.allocated_meters
                self.lot.current_balance -= difference
                self.lot.save()

            super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        with transaction.atomic():
            self.lot.current_balance += self.allocated_meters
            self.lot.save()
            super().delete(*args, **kwargs)


class Bill(models.Model):
    PAYMENT_STATUS_CHOICES = [
        ('Draft', 'Draft'),           # Generated but not sent
        ('Sent', 'Sent'),             # Sent to party
        ('Paid', 'Paid'),             # Payment received
        ('Outstanding', 'Outstanding'), # >30 days unpaid
        ('Scrap', 'Scrap'),           # Cancelled/discarded
    ]

    bill_number = models.CharField(max_length=50, unique=True, db_index=True)
    party = models.ForeignKey(Party, on_delete=models.PROTECT)
    bill_date = models.DateField(default=date.today)
    programs = models.ManyToManyField(ProcessProgram, related_name='bills')
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    tax_total = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    grand_total = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    pdf_file = models.BinaryField(blank=True, null=True)
    payment_status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS_CHOICES,
        default='Draft',
        db_index=True,
        help_text="Current payment/billing status"
    )
    sent_date = models.DateTimeField(
        blank=True,
        null=True,
        help_text="Date when bill was sent to party"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        blank=True,
        null=True
    )

    class Meta:
        verbose_name = "Bill"
        verbose_name_plural = "Bills"
        ordering = ['-bill_number']

    def __str__(self):
        return f"{self.bill_number} - {self.party.name} (₹{self.grand_total})"

    def save(self, *args, **kwargs):
        if not self.pk and not self.bill_number:
            self.bill_number = self.generate_next_bill_number()
        super().save(*args, **kwargs)

    @classmethod
    def generate_next_bill_number(cls):
        from datetime import datetime
        current_year = datetime.now().year
        prefix = f"BILL-{current_year}-"

        last_bill = cls.objects.filter(
            bill_number__startswith=prefix
        ).order_by('-bill_number').first()

        if last_bill:
            last_number = int(last_bill.bill_number.split('-')[-1])
            next_number = last_number + 1
        else:
            next_number = 1

        return f"{prefix}{next_number:04d}"

    @property
    def days_since_sent(self):
        """Calculate days since bill was sent"""
        if self.sent_date:
            return (timezone.now() - self.sent_date).days
        return 0

    def create_notification(self, notification_type, priority='medium'):
        """
        Create a notification for this bill

        Args:
            notification_type: Type of notification (bill_due_soon, bill_overdue, etc.)
            priority: Priority level (low, medium, high, urgent)
        """
        from datetime import timedelta

        # Define notification messages
        messages = {
            'bill_sent': {
                'title': f'Bill {self.bill_number} sent to {self.party.name}',
                'message': f'Bill #{self.bill_number} for ₹{self.grand_total:.2f} has been sent to {self.party.name}.',
                'priority': 'low'
            },
            'bill_due_soon': {
                'title': f'Payment due soon: {self.bill_number}',
                'message': f'Bill #{self.bill_number} for {self.party.name} (₹{self.grand_total:.2f}) was sent {self.days_since_sent} days ago. Payment expected soon.',
                'priority': 'medium'
            },
            'bill_due_urgent': {
                'title': f'Payment overdue in 5 days: {self.bill_number}',
                'message': f'Bill #{self.bill_number} for {self.party.name} (₹{self.grand_total:.2f}) was sent {self.days_since_sent} days ago. Payment overdue in 5 days.',
                'priority': 'high'
            },
            'bill_overdue': {
                'title': f'Payment OVERDUE: {self.bill_number}',
                'message': f'Bill #{self.bill_number} for {self.party.name} (₹{self.grand_total:.2f}) is now {self.days_since_sent} days overdue. Immediate action required.',
                'priority': 'urgent'
            },
            'bill_paid': {
                'title': f'Payment received: {self.bill_number}',
                'message': f'Payment of ₹{self.grand_total:.2f} received from {self.party.name} for bill #{self.bill_number}.',
                'priority': 'low'
            },
        }

        config = messages.get(notification_type)
        if not config:
            return None

        # Check if similar notification already exists (avoid duplicates)
        existing = Notification.objects.filter(
            bill=self,
            notification_type=notification_type,
            is_dismissed=False,
            created_at__gte=timezone.now() - timedelta(days=1)  # Within last 24 hours
        ).exists()

        if existing:
            return None

        # Create notification
        notification = Notification.objects.create(
            notification_type=notification_type,
            priority=config.get('priority', priority),
            title=config['title'],
            message=config['message'],
            bill=self,
            party=self.party
        )

        return notification

    def update_outstanding_status(self):
        """Auto-update status to Outstanding if Sent and >30 days old"""
        from datetime import timedelta
        if self.payment_status == 'Sent' and self.sent_date:
            days = (timezone.now() - self.sent_date).days

            # Check for notification thresholds
            if days == 20:
                self.create_notification('bill_due_soon', priority='medium')
            elif days == 25:
                self.create_notification('bill_due_urgent', priority='high')
            elif days >= 30:
                if self.payment_status == 'Sent':
                    self.payment_status = 'Outstanding'
                    self.save(update_fields=['payment_status', 'updated_at'])
                    self.create_notification('bill_overdue', priority='urgent')
                    return True
        return False

    def mark_as_sent(self):
        """Transition to Sent and set sent_date"""
        if self.payment_status not in ['Draft', 'Outstanding']:
            raise ValidationError(f"Cannot mark as Sent from status: {self.payment_status}")
        self.payment_status = 'Sent'
        self.sent_date = timezone.now()
        self.save(update_fields=['payment_status', 'sent_date', 'updated_at'])
        # Create notification
        self.create_notification('bill_sent', priority='low')

    def mark_as_paid(self):
        """Transition to Paid"""
        if self.payment_status not in ['Sent', 'Outstanding']:
            raise ValidationError(f"Cannot mark as Paid from status: {self.payment_status}")
        self.payment_status = 'Paid'
        self.save(update_fields=['payment_status', 'updated_at'])
        # Create notification
        self.create_notification('bill_paid', priority='low')

    def mark_as_scrap(self):
        """Transition to Scrap (only from Draft/Sent/Outstanding)"""
        if self.payment_status == 'Paid':
            raise ValidationError("Cannot scrap a paid bill")
        self.payment_status = 'Scrap'
        self.save(update_fields=['payment_status', 'updated_at'])

    def calculate_totals(self):
        programs_list = self.programs.all()
        subtotal = Decimal('0')

        # Determine GSTIN status from first program
        is_gstin_bill = False
        if programs_list:
            first_program = programs_list[0]
            gstin_status = first_program.get_gstin_status()
            is_gstin_bill = gstin_status if gstin_status is not None else False

        for p in programs_list:
            # Use centralized rate resolution
            rate = p.get_effective_rate()
            subtotal += (p.output_meters * rate)

        self.subtotal = subtotal

        # Calculate GST only if GSTIN-registered
        if is_gstin_bill:
            gst_rate = Decimal(SystemConfig.get_config('GST_RATE', '5.00'))
            self.tax_total = (subtotal * gst_rate) / Decimal('100')
        else:
            self.tax_total = Decimal('0')

        self.grand_total = self.subtotal + self.tax_total
        self.save()


class Notification(models.Model):
    """
    System notifications for bills, payments, and other alerts
    """
    NOTIFICATION_TYPES = [
        ('bill_due_soon', 'Bill Due Soon'),           # 20 days after sent
        ('bill_due_urgent', 'Bill Due Urgent'),       # 25 days after sent
        ('bill_overdue', 'Bill Overdue'),             # 30+ days (Outstanding)
        ('bill_sent', 'Bill Sent'),                   # When bill sent to party
        ('bill_paid', 'Bill Paid'),                   # Payment received
        ('low_stock', 'Low Stock Alert'),             # Inventory alert
        ('high_wastage', 'High Wastage Alert'),       # Production alert
    ]

    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('urgent', 'Urgent'),
    ]

    notification_type = models.CharField(max_length=50, choices=NOTIFICATION_TYPES, db_index=True)
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='medium', db_index=True)
    title = models.CharField(max_length=200)
    message = models.TextField()

    # Related objects
    bill = models.ForeignKey(
        Bill,
        on_delete=models.CASCADE,
        related_name='notifications',
        null=True,
        blank=True
    )
    party = models.ForeignKey(
        Party,
        on_delete=models.CASCADE,
        related_name='notifications',
        null=True,
        blank=True
    )

    # Notification state
    is_read = models.BooleanField(default=False, db_index=True)
    is_dismissed = models.BooleanField(default=False, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='notifications_created'
    )

    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['notification_type', 'is_read']),
            models.Index(fields=['priority', '-created_at']),
            models.Index(fields=['party', '-created_at']),
        ]
        verbose_name = "Notification"
        verbose_name_plural = "Notifications"

    def __str__(self):
        return f"{self.get_priority_display()}: {self.title}"

    def mark_as_read(self):
        """Mark notification as read"""
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=['is_read', 'read_at'])

    def dismiss(self):
        """Dismiss notification"""
        self.is_dismissed = True
        self.save(update_fields=['is_dismissed'])
