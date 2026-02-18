import base64
from rest_framework import serializers
from decimal import Decimal
from django.db import transaction
from .models import (
    SystemConfig, Party, QualityType, InwardLot,
    ProcessProgram, ProgramLotAllocation, Bill, PartyQualityRate, Notification
)


class SystemConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemConfig
        fields = ['id', 'key', 'value', 'description', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class PartySerializer(serializers.ModelSerializer):
    total_lots = serializers.IntegerField(source='total_inward_lots', read_only=True)
    total_programs = serializers.IntegerField(read_only=True)

    class Meta:
        model = Party
        fields = [
            'id', 'name', 'contact', 'address', 'is_active',
            'created_at', 'updated_at', 'total_lots', 'total_programs'
        ]
        read_only_fields = ['created_at', 'updated_at']


class QualityTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = QualityType
        fields = ['id', 'name', 'default_rate_per_meter', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class PartyQualityRateSerializer(serializers.ModelSerializer):
    party_name = serializers.CharField(source='party.name', read_only=True)
    quality_type_name = serializers.CharField(source='quality_type.name', read_only=True)

    class Meta:
        model = PartyQualityRate
        fields = [
            'id', 'party', 'party_name', 'quality_type', 'quality_type_name',
            'rate_per_meter', 'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class InwardLotSerializer(serializers.ModelSerializer):
    party_name = serializers.CharField(source='party.name', read_only=True)
    quality_name = serializers.CharField(source='quality_type.name', read_only=True)
    balance_percentage = serializers.SerializerMethodField()
    current_balance = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False,
        allow_null=True
    )

    class Meta:
        model = InwardLot
        fields = [
            'id', 'lot_number', 'party', 'party_name', 'quality_type', 'quality_name',
            'total_meters', 'current_balance', 'balance_percentage',
            'inward_date', 'fiscal_year', 'is_gstin_registered', 'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['lot_number', 'created_at', 'updated_at']

    def get_balance_percentage(self, obj):
        return float(obj.balance_percentage())

    def validate(self, data):
        if 'current_balance' in data and 'total_meters' in data:
            if data['current_balance'] > data['total_meters']:
                raise serializers.ValidationError("Current balance cannot exceed total meters")
            if data['current_balance'] < 0:
                raise serializers.ValidationError("Current balance cannot be negative")
        return data

    def create(self, validated_data):
        # If current_balance is not provided, set it equal to total_meters for new entries
        if 'current_balance' not in validated_data or validated_data['current_balance'] is None:
            validated_data['current_balance'] = validated_data['total_meters']
        return super().create(validated_data)


class ProgramLotAllocationSerializer(serializers.ModelSerializer):
    lot_number = serializers.CharField(source='lot.lot_number', read_only=True)
    lot_party = serializers.CharField(source='lot.party.name', read_only=True)

    class Meta:
        model = ProgramLotAllocation
        fields = [
            'id', 'lot', 'lot_number', 'lot_party',
            'allocated_meters', 'created_at'
        ]
        read_only_fields = ['created_at']

    def validate_allocated_meters(self, value):
        if value <= 0:
            raise serializers.ValidationError("Allocated meters must be positive")
        return value

    def validate(self, data):
        lot = data.get('lot')
        allocated_meters = data.get('allocated_meters')

        if lot and allocated_meters:
            if lot.current_balance < allocated_meters:
                raise serializers.ValidationError(
                    f"Insufficient balance in Lot {lot.lot_number}. "
                    f"Available: {lot.current_balance}m, Requested: {allocated_meters}m"
                )
        return data


class ProcessProgramSerializer(serializers.ModelSerializer):
    wastage_percentage = serializers.DecimalField(
        max_digits=5, decimal_places=2, read_only=True
    )
    total_amount = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    lot_allocations = ProgramLotAllocationSerializer(
        source='programlotallocation_set', many=True, read_only=True
    )
    design_photo_base64 = serializers.SerializerMethodField()
    is_wastage_high = serializers.BooleanField(read_only=True)
    is_gstin_registered = serializers.SerializerMethodField()
    is_billed = serializers.SerializerMethodField()
    bill_number = serializers.SerializerMethodField()

    class Meta:
        model = ProcessProgram
        fields = [
            'id', 'program_number', 'design_number', 'design_photo_name',
            'design_photo_base64', 'input_meters', 'wastage_meters',
            'output_meters', 'wastage_percentage', 'status',
            'rate_per_meter', 'tax_amount', 'total_amount',
            'created_at', 'updated_at', 'completed_at', 'created_by', 'notes',
            'lot_allocations', 'is_wastage_high', 'is_gstin_registered',
            'is_billed', 'bill_number'
        ]
        read_only_fields = [
            'program_number', 'wastage_meters', 'created_at', 'updated_at',
            'completed_at', 'created_by'
        ]

    def get_design_photo_base64(self, obj):
        if obj.design_photo:
            return base64.b64encode(bytes(obj.design_photo)).decode()
        return None

    def get_is_gstin_registered(self, obj):
        return obj.get_gstin_status()

    def get_is_billed(self, obj):
        """Check if program is included in any non-scrapped bill"""
        return obj.bills.exclude(payment_status='Scrap').exists()

    def get_bill_number(self, obj):
        """Get bill number if program is billed"""
        bill = obj.bills.exclude(payment_status='Scrap').first()
        return bill.bill_number if bill else None

    def validate(self, data):
        output_meters = data.get('output_meters')
        input_meters = data.get('input_meters')

        if output_meters and input_meters:
            if output_meters > input_meters:
                raise serializers.ValidationError("Output meters cannot exceed input meters")
            if input_meters < 0 or output_meters < 0:
                raise serializers.ValidationError("Meters cannot be negative")

        return data


class ProcessProgramCreateSerializer(serializers.ModelSerializer):
    lot_allocations = serializers.ListField(
        child=serializers.DictField(), write_only=True, required=False
    )
    design_photo_file = serializers.FileField(write_only=True, required=False)

    class Meta:
        model = ProcessProgram
        fields = [
            'id', 'program_number', 'design_number', 'input_meters', 'output_meters',
            'rate_per_meter', 'tax_amount', 'notes', 'status',
            'lot_allocations', 'design_photo_file', 'design_photo_name'
        ]
        read_only_fields = ['id', 'program_number']

    def validate_lot_allocations(self, value):
        if not value:
            # Only required for create, not update
            if not self.instance:
                raise serializers.ValidationError("At least one lot allocation is required")
            return value

        total_allocated = sum(Decimal(str(alloc['allocated_meters'])) for alloc in value)
        return value

    def validate(self, data):
        input_meters = data.get('input_meters', self.instance.input_meters if self.instance else None)
        lot_allocations = data.get('lot_allocations', [])

        # Validate lot allocations during create or update if provided
        if lot_allocations:
            total_allocated = sum(Decimal(str(alloc['allocated_meters'])) for alloc in lot_allocations)

            if abs(total_allocated - input_meters) > Decimal('0.01'):
                raise serializers.ValidationError(
                    f"Total allocated meters ({total_allocated}) must equal input meters ({input_meters})"
                )

            # GSTIN consistency validation
            lot_ids = [alloc['lot_id'] for alloc in lot_allocations]
            lots = InwardLot.objects.filter(id__in=lot_ids)

            gstin_statuses = set(lot.is_gstin_registered for lot in lots)
            if len(gstin_statuses) > 1:
                raise serializers.ValidationError({
                    'lot_allocations': 'All allocated lots must have the same GSTIN status. '
                                      'Cannot mix GSTIN-registered and non-GSTIN lots in one program.'
                })

        return data

    def create(self, validated_data):
        lot_allocations_data = validated_data.pop('lot_allocations', [])
        design_photo_file = validated_data.pop('design_photo_file', None)

        program = ProcessProgram.objects.create(**validated_data)

        if design_photo_file:
            program.design_photo = design_photo_file.read()
            program.design_photo_name = design_photo_file.name
            program.save()

        for allocation_data in lot_allocations_data:
            lot_id = allocation_data['lot_id']
            allocated_meters = Decimal(str(allocation_data['allocated_meters']))

            lot = InwardLot.objects.get(pk=lot_id)
            ProgramLotAllocation.objects.create(
                program=program,
                lot=lot,
                allocated_meters=allocated_meters
            )

        return program

    def update(self, instance, validated_data):
        lot_allocations_data = validated_data.pop('lot_allocations', None)
        design_photo_file = validated_data.pop('design_photo_file', None)

        with transaction.atomic():
            # Update fields
            for attr, value in validated_data.items():
                setattr(instance, attr, value)

            # Update photo if provided
            if design_photo_file:
                instance.design_photo = design_photo_file.read()
                instance.design_photo_name = design_photo_file.name

            # Save the instance first
            instance.save()

            # Update lot allocations if provided
            if lot_allocations_data is not None:
                # Delete existing allocations (this restores balance via the model's delete method)
                existing_allocations = list(instance.programlotallocation_set.all())
                for allocation in existing_allocations:
                    allocation.delete()

                # Create new allocations (this deducts balance via the model's save method)
                for allocation_data in lot_allocations_data:
                    lot_id = allocation_data['lot_id']
                    allocated_meters = Decimal(str(allocation_data['allocated_meters']))

                    lot = InwardLot.objects.get(pk=lot_id)
                    ProgramLotAllocation.objects.create(
                        program=instance,
                        lot=lot,
                        allocated_meters=allocated_meters
                    )

        return instance


class BillSerializer(serializers.ModelSerializer):
    party_name = serializers.CharField(source='party.name', read_only=True)
    program_count = serializers.IntegerField(
        source='programs.count', read_only=True
    )
    programs_detail = ProcessProgramSerializer(
        source='programs', many=True, read_only=True
    )
    days_since_sent = serializers.SerializerMethodField()

    class Meta:
        model = Bill
        fields = [
            'id', 'bill_number', 'party', 'party_name', 'bill_date',
            'programs', 'programs_detail', 'program_count',
            'subtotal', 'tax_total', 'grand_total',
            'payment_status', 'sent_date', 'days_since_sent',
            'created_at', 'updated_at', 'created_by'
        ]
        read_only_fields = [
            'bill_number', 'subtotal', 'tax_total', 'grand_total',
            'sent_date', 'days_since_sent',
            'created_at', 'updated_at', 'created_by'
        ]

    def get_days_since_sent(self, obj):
        if obj.sent_date:
            from django.utils import timezone
            return (timezone.now() - obj.sent_date).days
        return None


class BillCreateSerializer(serializers.ModelSerializer):
    program_ids = serializers.ListField(
        child=serializers.IntegerField(), write_only=True
    )

    class Meta:
        model = Bill
        fields = ['party', 'bill_date', 'program_ids']

    def validate_program_ids(self, value):
        if not value:
            raise serializers.ValidationError("At least one program is required")

        programs = ProcessProgram.objects.filter(pk__in=value, status='Completed')
        if programs.count() != len(value):
            raise serializers.ValidationError("All programs must be completed")

        parties = programs.values_list(
            'programlotallocation__lot__party', flat=True
        ).distinct()
        if len(set(parties)) > 1:
            raise serializers.ValidationError("All programs must belong to the same party")

        # GSTIN consistency validation
        gstin_statuses = set()
        for program in programs:
            gstin_status = program.get_gstin_status()
            if gstin_status is not None:
                gstin_statuses.add(gstin_status)

        if len(gstin_statuses) > 1:
            raise serializers.ValidationError(
                "All programs must have the same GSTIN status. "
                "Cannot mix GSTIN-registered and non-GSTIN programs in one bill."
            )

        # Program Exclusivity Validation - check if programs are already in non-scrapped bills
        for program in programs:
            existing_bills = program.bills.exclude(payment_status='Scrap')
            if existing_bills.exists():
                bill = existing_bills.first()
                raise serializers.ValidationError(
                    f"Program {program.program_number} is already in Bill "
                    f"{bill.bill_number} (Status: {bill.get_payment_status_display()}). "
                    f"Mark that bill as Scrap to reuse this program."
                )

        return value

    def create(self, validated_data):
        program_ids = validated_data.pop('program_ids')

        bill = Bill.objects.create(**validated_data)
        bill.programs.set(ProcessProgram.objects.filter(pk__in=program_ids))
        bill.calculate_totals()

        return bill


class NotificationSerializer(serializers.ModelSerializer):
    party_name = serializers.CharField(source='party.name', read_only=True)
    bill_number = serializers.CharField(source='bill.bill_number', read_only=True)
    bill_grand_total = serializers.DecimalField(
        source='bill.grand_total',
        max_digits=10,
        decimal_places=2,
        read_only=True
    )
    days_since_created = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            'id', 'notification_type', 'priority', 'title', 'message',
            'bill', 'bill_number', 'bill_grand_total',
            'party', 'party_name',
            'is_read', 'is_dismissed', 'read_at',
            'created_at', 'days_since_created'
        ]
        read_only_fields = ['created_at', 'read_at']

    def get_days_since_created(self, obj):
        from django.utils import timezone
        return (timezone.now() - obj.created_at).days
