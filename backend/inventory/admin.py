import base64
from django.contrib import admin
from django.utils.html import format_html
from django.urls import path
from django.shortcuts import render, redirect
from django.contrib import messages
from django.http import HttpResponse
from django.db.models import Sum, Q
from decimal import Decimal
from import_export import resources
from import_export.admin import ImportExportModelAdmin
from import_export.fields import Field
from import_export.widgets import ForeignKeyWidget, ManyToManyWidget
from .models import (
    SystemConfig, Party, QualityType, InwardLot,
    ProcessProgram, ProgramLotAllocation, Bill, CompanyDetail, PartyQualityRate, Notification
)


# ============================================================================
# Import/Export Resources - For data backup and restore
# ============================================================================

class SystemConfigResource(resources.ModelResource):
    class Meta:
        model = SystemConfig
        import_id_fields = ['key']
        fields = ('key', 'value', 'description', 'created_at', 'updated_at')


class PartyResource(resources.ModelResource):
    class Meta:
        model = Party
        import_id_fields = ['id']
        fields = ('id', 'name', 'contact', 'address', 'is_active', 'created_at', 'updated_at')


class QualityTypeResource(resources.ModelResource):
    class Meta:
        model = QualityType
        import_id_fields = ['id']
        fields = ('id', 'name', 'default_rate_per_meter', 'is_active', 'created_at', 'updated_at')


class PartyQualityRateResource(resources.ModelResource):
    party = Field(
        column_name='party',
        attribute='party',
        widget=ForeignKeyWidget(Party, 'name')
    )
    quality_type = Field(
        column_name='quality_type',
        attribute='quality_type',
        widget=ForeignKeyWidget(QualityType, 'name')
    )

    class Meta:
        model = PartyQualityRate
        import_id_fields = ['id']
        fields = ('id', 'party', 'quality_type', 'rate_per_meter', 'notes', 'created_at', 'updated_at')


class CompanyDetailResource(resources.ModelResource):
    quality_type = Field(
        column_name='quality_type',
        attribute='quality_type',
        widget=ForeignKeyWidget(QualityType, 'name')
    )

    class Meta:
        model = CompanyDetail
        import_id_fields = ['id']
        fields = ('id', 'name', 'address', 'phone', 'email', 'quality_type', 'gst_number', 'created_at', 'updated_at')
        exclude = ('logo',)  # Exclude binary fields


class InwardLotResource(resources.ModelResource):
    party = Field(
        column_name='party',
        attribute='party',
        widget=ForeignKeyWidget(Party, 'name')
    )
    quality_type = Field(
        column_name='quality_type',
        attribute='quality_type',
        widget=ForeignKeyWidget(QualityType, 'name')
    )

    class Meta:
        model = InwardLot
        import_id_fields = ['lot_number']
        fields = (
            'lot_number', 'party', 'quality_type', 'total_meters', 'current_balance',
            'inward_date', 'fiscal_year', 'is_gstin_registered', 'notes', 'created_at', 'updated_at'
        )


class ProcessProgramResource(resources.ModelResource):
    created_by = Field(
        column_name='created_by',
        attribute='created_by',
        widget=ForeignKeyWidget(model='auth.User', field='username')
    )

    class Meta:
        model = ProcessProgram
        import_id_fields = ['program_number']
        fields = (
            'program_number', 'design_number', 'design_photo_name',
            'input_meters', 'wastage_meters', 'output_meters', 'status',
            'rate_per_meter', 'tax_amount', 'created_at', 'updated_at',
            'completed_at', 'created_by', 'notes'
        )
        exclude = ('design_photo',)  # Exclude binary fields


class ProgramLotAllocationResource(resources.ModelResource):
    program = Field(
        column_name='program',
        attribute='program',
        widget=ForeignKeyWidget(ProcessProgram, 'program_number')
    )
    lot = Field(
        column_name='lot',
        attribute='lot',
        widget=ForeignKeyWidget(InwardLot, 'lot_number')
    )

    class Meta:
        model = ProgramLotAllocation
        import_id_fields = ['id']
        fields = ('id', 'program', 'lot', 'allocated_meters', 'created_at', 'updated_at')


class BillResource(resources.ModelResource):
    party = Field(
        column_name='party',
        attribute='party',
        widget=ForeignKeyWidget(Party, 'name')
    )
    programs = Field(
        column_name='programs',
        attribute='programs',
        widget=ManyToManyWidget(ProcessProgram, field='program_number', separator='|')
    )
    created_by = Field(
        column_name='created_by',
        attribute='created_by',
        widget=ForeignKeyWidget(model='auth.User', field='username')
    )

    class Meta:
        model = Bill
        import_id_fields = ['bill_number']
        fields = (
            'bill_number', 'party', 'bill_date', 'programs', 'subtotal',
            'tax_total', 'grand_total', 'payment_status', 'sent_date',
            'created_at', 'updated_at', 'created_by'
        )
        exclude = ('pdf_file',)  # Exclude binary fields


class NotificationResource(resources.ModelResource):
    bill = Field(
        column_name='bill',
        attribute='bill',
        widget=ForeignKeyWidget(Bill, 'bill_number')
    )
    party = Field(
        column_name='party',
        attribute='party',
        widget=ForeignKeyWidget(Party, 'name')
    )
    created_by = Field(
        column_name='created_by',
        attribute='created_by',
        widget=ForeignKeyWidget(model='auth.User', field='username')
    )

    class Meta:
        model = Notification
        import_id_fields = ['id']
        fields = (
            'id', 'notification_type', 'priority', 'title', 'message',
            'bill', 'party', 'is_read', 'is_dismissed', 'read_at',
            'created_at', 'created_by'
        )


# ============================================================================
# Admin Classes
# ============================================================================

@admin.register(SystemConfig)
class SystemConfigAdmin(ImportExportModelAdmin):
    resource_class = SystemConfigResource
    list_display = ['key', 'value', 'description', 'updated_at']
    search_fields = ['key', 'value', 'description']
    readonly_fields = ['created_at', 'updated_at']


class PartyQualityRateInline(admin.TabularInline):
    """Inline admin for managing party-specific rates"""
    model = PartyQualityRate
    extra = 1
    fields = ['quality_type', 'rate_per_meter', 'notes']
    autocomplete_fields = ['quality_type']
    verbose_name = "Custom Rate"
    verbose_name_plural = "Custom Quality Rates"

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('quality_type').order_by('quality_type__name')


@admin.register(Party)
class PartyAdmin(ImportExportModelAdmin):
    resource_class = PartyResource
    list_display = ['name', 'contact', 'is_active', 'lot_count', 'program_count', 'created_at', 'updated_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['name', 'contact', 'address']
    readonly_fields = ['created_at', 'updated_at']
    inlines = [PartyQualityRateInline]

    def lot_count(self, obj):
        return obj.total_inward_lots()
    lot_count.short_description = 'Total Lots'

    def program_count(self, obj):
        return obj.total_programs()
    program_count.short_description = 'Total Programs'


@admin.register(QualityType)
class QualityTypeAdmin(ImportExportModelAdmin):
    resource_class = QualityTypeResource
    list_display = ['name', 'default_rate_per_meter', 'custom_rate_count', 'is_active', 'created_at', 'updated_at']
    list_filter = ['is_active']
    search_fields = ['name']
    readonly_fields = ['created_at', 'updated_at']

    def custom_rate_count(self, obj):
        """Show how many parties have custom rates"""
        count = obj.party_rates.count()
        if count == 0:
            return "-"
        return format_html(
            '<span style="color: #28a745; font-weight: bold;">{} custom</span>',
            count
        )
    custom_rate_count.short_description = "Party Overrides"


@admin.register(CompanyDetail)
class CompanyDetailAdmin(ImportExportModelAdmin):
    resource_class = CompanyDetailResource
    list_display = ['name', 'quality_type', 'phone', 'email', 'gst_number', 'has_logo']
    list_filter = ['quality_type']
    search_fields = ['name', 'email', 'gst_number']
    readonly_fields = ['created_at', 'updated_at']
    autocomplete_fields = ['quality_type']
    
    fieldsets = (
        ('Company Information', {
            'fields': ('name', 'quality_type', 'address')
        }),
        ('Contact Details', {
            'fields': ('phone', 'email')
        }),
        ('Tax & Branding', {
            'fields': ('gst_number', 'logo')
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def has_logo(self, obj):
        return bool(obj.logo)
    has_logo.boolean = True
    has_logo.short_description = 'Logo'



class ProgramLotAllocationInline(admin.TabularInline):
    model = ProgramLotAllocation
    extra = 1
    readonly_fields = ['created_at']
    autocomplete_fields = ['lot']

    def get_readonly_fields(self, request, obj=None):
        if obj and obj.status == 'Completed':
            return ['program', 'lot', 'allocated_meters', 'created_at']
        return self.readonly_fields


@admin.register(InwardLot)
class InwardLotAdmin(ImportExportModelAdmin):
    resource_class = InwardLotResource
    list_display = [
        'lot_number', 'party', 'quality_type', 'total_meters',
        'balance_display', 'gstin_badge', 'inward_date', 'fiscal_year'
    ]
    list_filter = ['fiscal_year', 'quality_type', 'party', 'is_gstin_registered', 'inward_date']
    search_fields = ['lot_number', 'party__name', 'notes']
    autocomplete_fields = ['party', 'quality_type']
    readonly_fields = ['lot_number', 'created_at', 'updated_at']
    date_hierarchy = 'inward_date'

    fieldsets = (
        ('Basic Information', {
            'fields': ('lot_number', 'party', 'quality_type', 'fiscal_year', 'is_gstin_registered')
        }),
        ('Quantity Details', {
            'fields': ('total_meters', 'current_balance', 'inward_date')
        }),
        ('Additional Information', {
            'fields': ('notes', 'created_at'),
            'classes': ('collapse',)
        }),
    )

    def balance_display(self, obj):
        percentage = obj.balance_percentage()
        color = 'red' if percentage < 10 else 'green' if percentage > 50 else 'orange'
        balance_str = f"{float(obj.current_balance):.2f}"
        percentage_str = f"{float(percentage):.1f}"
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}m ({}%)</span>',
            color, balance_str, percentage_str
        )
    balance_display.short_description = 'Current Balance'

    def gstin_badge(self, obj):
        if obj.is_gstin_registered:
            return format_html(
                '<span style="background-color: #28a745; color: white; padding: 3px 8px; '
                'border-radius: 3px; font-size: 11px; font-weight: bold;">GST</span>'
            )
        return format_html(
            '<span style="background-color: #6c757d; color: white; padding: 3px 8px; '
            'border-radius: 3px; font-size: 11px;">Non-GST</span>'
        )
    gstin_badge.short_description = 'GSTIN'

    actions = ['reset_lot_counter']

    def reset_lot_counter(self, request, queryset):
        if request.method == 'POST':
            fiscal_year = request.POST.get('fiscal_year')
            if fiscal_year:
                messages.success(
                    request,
                    f"Note: Lot counter for FY {fiscal_year} will start from 001 for new lots"
                )
                return redirect(request.get_full_path())

        selected = queryset.values_list('pk', flat=True)
        return render(request, 'admin/reset_lot_counter.html', {
            'items': queryset,
            'title': 'Reset Lot Counter'
        })

    reset_lot_counter.short_description = "Reset Lot Counter for Fiscal Year"


@admin.register(ProcessProgram)
class ProcessProgramAdmin(ImportExportModelAdmin):
    resource_class = ProcessProgramResource
    list_display = [
        'program_number', 'design_number', 'photo_thumbnail',
        'input_meters', 'output_meters', 'wastage_display',
        'status', 'created_at'
    ]
    list_filter = [
        'status', 'created_at'
    ]
    search_fields = ['program_number', 'design_number', 'notes']
    readonly_fields = [
        'program_number', 'wastage_meters', 'wastage_percentage',
        'total_amount', 'created_at', 'updated_at', 'completed_at', 'photo_preview'
    ]
    inlines = [ProgramLotAllocationInline]
    date_hierarchy = 'created_at'

    fieldsets = (
        ('Program Information', {
            'fields': ('program_number', 'design_number', 'status')
        }),
        ('Design Photo', {
            'fields': ('design_photo_name', 'photo_preview'),
            'classes': ('collapse',)
        }),
        ('Quantity Details', {
            'fields': (
                'input_meters', 'output_meters', 'wastage_meters',
                'wastage_percentage'
            )
        }),
        ('Pricing', {
            'fields': ('rate_per_meter', 'tax_amount', 'total_amount')
        }),
        ('Additional Information', {
            'fields': ('notes', 'created_by', 'created_at', 'completed_at'),
            'classes': ('collapse',)
        }),
    )

    def photo_thumbnail(self, obj):
        if obj.design_photo:
            img_data = base64.b64encode(bytes(obj.design_photo)).decode()
            return format_html(
                '<img src="data:image/jpeg;base64,{}" style="max-width:50px;max-height:50px;"/>',
                img_data
            )
        return "-"
    photo_thumbnail.short_description = 'Photo'

    def photo_preview(self, obj):
        if obj.design_photo:
            img_data = base64.b64encode(bytes(obj.design_photo)).decode()
            return format_html(
                '<img src="data:image/jpeg;base64,{}" style="max-width:400px;"/>',
                img_data
            )
        return "No photo uploaded"
    photo_preview.short_description = 'Design Photo Preview'

    def wastage_display(self, obj):
        percentage = obj.wastage_percentage
        color = 'red' if obj.is_wastage_high() else 'green'
        wastage_str = f"{float(obj.wastage_meters):.2f}"
        percentage_str = f"{float(percentage):.1f}"
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}m ({}%)</span>',
            color, wastage_str, percentage_str
        )
    wastage_display.short_description = 'Wastage'

    def has_change_permission(self, request, obj=None):
        if obj and obj.status == 'Completed':
            return False
        return super().has_change_permission(request, obj)

    def has_delete_permission(self, request, obj=None):
        if obj and obj.status == 'Completed':
            return False
        return super().has_delete_permission(request, obj)

    actions = ['mark_as_completed', 'generate_bill_action']

    def mark_as_completed(self, request, queryset):
        from django.utils import timezone
        updated = 0
        for program in queryset:
            if program.status != 'Completed':
                program.status = 'Completed'
                program.completed_at = timezone.now()
                program.save()
                updated += 1
        self.message_user(request, f"{updated} program(s) marked as completed")
    mark_as_completed.short_description = "Mark selected as Completed"

    def generate_bill_action(self, request, queryset):
        from .reports import generate_bill_pdf

        completed_programs = queryset.filter(status='Completed')
        if not completed_programs.exists():
            self.message_user(
                request,
                "Please select only completed programs",
                level=messages.ERROR
            )
            return

        parties = completed_programs.values_list('programlotallocation__lot__party', flat=True).distinct()
        if len(set(parties)) > 1:
            self.message_user(
                request,
                "Selected programs belong to different parties",
                level=messages.ERROR
            )
            return

        party_id = list(set(parties))[0]
        party = Party.objects.get(pk=party_id)

        bill = Bill.objects.create(
            party=party,
            created_by=request.user
        )
        bill.programs.set(completed_programs)
        bill.calculate_totals()

        pdf_content = generate_bill_pdf(bill)
        bill.pdf_file = pdf_content
        bill.save()

        response = HttpResponse(pdf_content, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{bill.bill_number}.pdf"'
        return response

    generate_bill_action.short_description = "Generate Bill (PDF)"


@admin.register(Bill)
class BillAdmin(ImportExportModelAdmin):
    resource_class = BillResource
    list_display = [
        'bill_number', 'party', 'bill_date', 'program_count',
        'payment_status_badge', 'subtotal', 'grand_total',
        'sent_date_display', 'created_at', 'created_by'
    ]
    list_filter = ['bill_date', 'party', 'created_by', 'payment_status']
    search_fields = ['bill_number', 'party__name']
    readonly_fields = [
        'bill_number', 'subtotal', 'tax_total', 'grand_total',
        'sent_date', 'created_at', 'updated_at', 'created_by'
    ]
    filter_horizontal = ['programs']
    date_hierarchy = 'bill_date'

    fieldsets = (
        ('Bill Information', {
            'fields': ('bill_number', 'party', 'bill_date')
        }),
        ('Payment Status', {
            'fields': ('payment_status', 'sent_date')
        }),
        ('Programs', {
            'fields': ('programs',)
        }),
        ('Amounts', {
            'fields': ('subtotal', 'tax_total', 'grand_total')
        }),
        ('Metadata', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def program_count(self, obj):
        return obj.programs.count()
    program_count.short_description = 'Programs'

    def payment_status_badge(self, obj):
        """Color-coded status badge"""
        colors = {
            'Draft': '#6c757d',
            'Sent': '#007bff',
            'Paid': '#28a745',
            'Outstanding': '#dc3545',
            'Scrap': '#6c757d'
        }
        color = colors.get(obj.payment_status, '#000')
        icon = '⚠️ ' if obj.payment_status == 'Outstanding' else ''

        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 8px; '
            'border-radius: 3px; font-size: 11px; font-weight: bold;">{}{}</span>',
            color, icon, obj.get_payment_status_display()
        )
    payment_status_badge.short_description = 'Payment Status'

    def sent_date_display(self, obj):
        """Show sent date with days elapsed"""
        if obj.sent_date:
            from django.utils import timezone
            days = (timezone.now() - obj.sent_date).days
            return format_html(
                '{}<br><small>{} days ago</small>',
                obj.sent_date.strftime('%d %b %Y'),
                days
            )
        return '-'
    sent_date_display.short_description = 'Sent Date'

    def save_model(self, request, obj, form, change):
        if not obj.pk:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)
        obj.calculate_totals()

    actions = ['download_pdf', 'export_ledger', 'mark_as_sent', 'mark_as_paid', 'mark_as_scrap']

    def mark_as_sent(self, request, queryset):
        """Mark selected bills as Sent"""
        from django.core.exceptions import ValidationError
        updated = 0
        errors = []
        for bill in queryset:
            try:
                bill.mark_as_sent()
                updated += 1
            except ValidationError as e:
                errors.append(f"{bill.bill_number}: {str(e)}")

        if updated:
            self.message_user(request, f"{updated} bill(s) marked as Sent")
        if errors:
            self.message_user(request, f"Errors: {'; '.join(errors)}", level=messages.ERROR)

    mark_as_sent.short_description = "Mark as Sent"

    def mark_as_paid(self, request, queryset):
        """Mark selected bills as Paid"""
        from django.core.exceptions import ValidationError
        updated = 0
        errors = []
        for bill in queryset:
            try:
                bill.mark_as_paid()
                updated += 1
            except ValidationError as e:
                errors.append(f"{bill.bill_number}: {str(e)}")

        if updated:
            self.message_user(request, f"{updated} bill(s) marked as Paid")
        if errors:
            self.message_user(request, f"Errors: {'; '.join(errors)}", level=messages.ERROR)

    mark_as_paid.short_description = "Mark as Paid"

    def mark_as_scrap(self, request, queryset):
        """Mark selected bills as Scrap (cancelled/discarded)"""
        from django.core.exceptions import ValidationError
        updated = 0
        errors = []
        for bill in queryset:
            try:
                bill.mark_as_scrap()
                updated += 1
            except ValidationError as e:
                errors.append(f"{bill.bill_number}: {str(e)}")

        if updated:
            self.message_user(request, f"{updated} bill(s) marked as Scrap")
        if errors:
            self.message_user(request, f"Errors: {'; '.join(errors)}", level=messages.ERROR)

    mark_as_scrap.short_description = "Mark as Scrap"

    def download_pdf(self, request, queryset):
        if queryset.count() != 1:
            self.message_user(
                request,
                "Please select exactly one bill",
                level=messages.ERROR
            )
            return

        bill = queryset.first()
        if bill.pdf_file:
            response = HttpResponse(bytes(bill.pdf_file), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{bill.bill_number}.pdf"'
            return response
        else:
            from .reports import generate_bill_pdf
            pdf_content = generate_bill_pdf(bill)
            response = HttpResponse(pdf_content, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{bill.bill_number}.pdf"'
            return response

    download_pdf.short_description = "Download PDF"

    def export_ledger(self, request, queryset):
        from .reports import generate_ledger_excel
        from datetime import datetime

        if request.method == 'POST':
            party_id = request.POST.get('party')
            start_date = request.POST.get('start_date')
            end_date = request.POST.get('end_date')

            if party_id and start_date and end_date:
                party = Party.objects.get(pk=party_id)
                excel_content = generate_ledger_excel(party, start_date, end_date)

                response = HttpResponse(
                    excel_content,
                    content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                )
                filename = f"Ledger_{party.name}_{start_date}_to_{end_date}.xlsx"
                response['Content-Disposition'] = f'attachment; filename="{filename}"'
                return response

        parties = Party.objects.filter(is_active=True)
        return render(request, 'admin/export_ledger.html', {
            'parties': parties,
            'title': 'Export Ledger'
        })

    export_ledger.short_description = "Export Party Ledger (Excel)"


@admin.register(ProgramLotAllocation)
class ProgramLotAllocationAdmin(ImportExportModelAdmin):
    resource_class = ProgramLotAllocationResource
    list_display = ['program', 'lot', 'allocated_meters', 'created_at', 'updated_at']
    list_filter = ['created_at']
    search_fields = ['program__program_number', 'lot__lot_number']
    autocomplete_fields = ['program', 'lot']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Notification)
class NotificationAdmin(ImportExportModelAdmin):
    resource_class = NotificationResource
    list_display = ['title', 'notification_type', 'priority', 'party', 'bill', 'is_read', 'is_dismissed', 'created_at']
    list_filter = ['notification_type', 'priority', 'is_read', 'is_dismissed', 'created_at']
    search_fields = ['title', 'message', 'party__name', 'bill__bill_number']
    readonly_fields = ['created_at', 'read_at', 'created_by']
    autocomplete_fields = ['bill', 'party', 'created_by']

    fieldsets = (
        ('Notification Details', {
            'fields': ('notification_type', 'priority', 'title', 'message')
        }),
        ('Related Objects', {
            'fields': ('bill', 'party')
        }),
        ('Status', {
            'fields': ('is_read', 'is_dismissed', 'read_at')
        }),
        ('Metadata', {
            'fields': ('created_at', 'created_by'),
            'classes': ('collapse',)
        }),
    )
