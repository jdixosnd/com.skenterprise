import json
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django_filters.rest_framework import DjangoFilterBackend
from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from django.middleware.csrf import get_token
from .models import (
    SystemConfig, Party, QualityType, InwardLot,
    ProcessProgram, ProgramLotAllocation, Bill, PartyQualityRate, Notification
)
from .serializers import (
    SystemConfigSerializer, PartySerializer, QualityTypeSerializer,
    InwardLotSerializer, ProcessProgramSerializer, ProcessProgramCreateSerializer,
    ProgramLotAllocationSerializer, BillSerializer, BillCreateSerializer,
    PartyQualityRateSerializer, NotificationSerializer
)
from .permissions import IsInGroupOrReadOnly
from .reports import generate_bill_pdf, generate_ledger_excel


@api_view(['GET'])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def get_csrf_token(request):
    """
    Get CSRF token - this endpoint sets the CSRF cookie
    """
    return JsonResponse({'detail': 'CSRF cookie set'})


class SystemConfigViewSet(viewsets.ModelViewSet):
    queryset = SystemConfig.objects.all()
    serializer_class = SystemConfigSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['key', 'value']

    @action(detail=False, methods=['get'])
    def get_config(self, request):
        key = request.query_params.get('key')
        if not key:
            return Response(
                {'error': 'key parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        value = SystemConfig.get_config(key)
        return Response({'key': key, 'value': value})

    @action(detail=False, methods=['post'])
    def set_config(self, request):
        key = request.data.get('key')
        value = request.data.get('value')
        description = request.data.get('description')

        if not key or value is None:
            return Response(
                {'error': 'key and value are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        config = SystemConfig.set_config(key, value, description)
        serializer = self.get_serializer(config)
        return Response(serializer.data)


class PartyViewSet(viewsets.ModelViewSet):
    queryset = Party.objects.all()
    serializer_class = PartySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'contact', 'address']
    ordering_fields = ['name', 'created_at']

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_active = False
        instance.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class QualityTypeViewSet(viewsets.ModelViewSet):
    queryset = QualityType.objects.filter(is_active=True)
    serializer_class = QualityTypeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name']
    ordering_fields = ['name', 'default_rate_per_meter']


class PartyQualityRateViewSet(viewsets.ModelViewSet):
    queryset = PartyQualityRate.objects.all()
    serializer_class = PartyQualityRateSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['party', 'quality_type']
    search_fields = ['party__name', 'quality_type__name', 'notes']
    ordering_fields = ['party__name', 'quality_type__name', 'rate_per_meter']


class InwardLotViewSet(viewsets.ModelViewSet):
    queryset = InwardLot.objects.all()
    serializer_class = InwardLotSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['party', 'quality_type', 'fiscal_year']
    search_fields = ['lot_number', 'party__name', 'notes']
    ordering_fields = ['lot_number', 'inward_date', 'created_at']

    @action(detail=True, methods=['get'])
    def available_balance(self, request, pk=None):
        lot = self.get_object()
        return Response({
            'lot_number': lot.lot_number,
            'current_balance': lot.current_balance,
            'balance_percentage': lot.balance_percentage()
        })

    @action(detail=False, methods=['get'])
    def available_lots(self, request):
        from decimal import Decimal

        min_balance = request.query_params.get('min_balance', 0)
        try:
            min_balance = Decimal(str(min_balance))
        except (ValueError, TypeError):
            min_balance = Decimal('0')

        quality_type = request.query_params.get('quality_type')

        # Filter lots with balance greater than min_balance and exclude null balances
        lots = self.get_queryset().filter(
            current_balance__isnull=False,
            current_balance__gt=min_balance
        ).order_by('-current_balance')  # Show lots with more balance first

        if quality_type:
            lots = lots.filter(quality_type_id=quality_type)

        serializer = self.get_serializer(lots, many=True)
        return Response(serializer.data)


class ProcessProgramViewSet(viewsets.ModelViewSet):
    queryset = ProcessProgram.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'created_by']
    search_fields = ['program_number', 'design_number', 'notes']
    ordering_fields = ['program_number', 'created_at', 'completed_at']

    def get_serializer_class(self):
        if self.action == 'create' or self.action == 'update':
            return ProcessProgramCreateSerializer
        return ProcessProgramSerializer

    def create(self, request, *args, **kwargs):
        # Parse lot_allocations from JSON string if needed
        # Convert QueryDict to regular dict to avoid issues
        data = {}
        for key, value in request.data.items():
            if key == 'lot_allocations' and isinstance(value, str):
                try:
                    data[key] = json.loads(value)
                except json.JSONDecodeError:
                    data[key] = value
            else:
                data[key] = value

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        # Check if program is billed (regardless of completion status)
        if instance.is_billed():
            bill_number = instance.get_bill_number()
            return Response(
                {
                    'error': f'Cannot update program. It has been included in Bill {bill_number}. '
                             f'To edit this program, you must first remove it from the bill or mark the bill as Scrap.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Parse lot_allocations from JSON string if needed
        # Convert QueryDict to regular dict to avoid immutability issues
        data = {}
        for key, value in request.data.items():
            if key == 'lot_allocations' and isinstance(value, str):
                try:
                    data[key] = json.loads(value)
                except json.JSONDecodeError:
                    data[key] = value
            else:
                data[key] = value
        
        # Debug: Log the lot_allocations structure  
        if 'lot_allocations' in data:
            print(f"DEBUG: lot_allocations type: {type(data['lot_allocations'])}")
            print(f"DEBUG: lot_allocations content: {data['lot_allocations']}")

        partial = kwargs.pop('partial', False)
        serializer = self.get_serializer(instance, data=data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        if getattr(instance, '_prefetched_objects_cache', None):
            instance._prefetched_objects_cache = {}

        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status == 'Completed':
            return Response(
                {'error': 'Cannot delete completed program'},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def upload_photo(self, request, pk=None):
        program = self.get_object()

        if program.status == 'Completed':
            return Response(
                {'error': 'Cannot upload photo to completed program'},
                status=status.HTTP_400_BAD_REQUEST
            )

        photo_file = request.FILES.get('photo')
        if not photo_file:
            return Response(
                {'error': 'No photo file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        program.design_photo = photo_file.read()
        program.design_photo_name = photo_file.name
        program.save()

        serializer = self.get_serializer(program)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        program = self.get_object()

        if program.status == 'Completed':
            return Response(
                {'error': 'Program already completed'},
                status=status.HTTP_400_BAD_REQUEST
            )

        program.status = 'Completed'
        program.completed_at = timezone.now()
        program.save()

        serializer = self.get_serializer(program)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def high_wastage(self, request):
        from decimal import Decimal
        threshold = Decimal(SystemConfig.get_config('WASTAGE_THRESHOLD_PERCENT', '15.00'))

        programs = []
        for program in self.get_queryset():
            if program.wastage_percentage > threshold:
                programs.append(program)

        page = self.paginate_queryset(programs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(programs, many=True)
        return Response(serializer.data)


class ProgramLotAllocationViewSet(viewsets.ModelViewSet):
    queryset = ProgramLotAllocation.objects.all()
    serializer_class = ProgramLotAllocationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['program', 'lot']
    ordering_fields = ['created_at']


class BillViewSet(viewsets.ModelViewSet):
    queryset = Bill.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        'party': ['exact'],
        'created_by': ['exact'],
        'payment_status': ['exact'],
        'bill_date': ['gte', 'lte', 'exact', 'gt', 'lt'],
    }
    search_fields = ['bill_number', 'party__name']
    ordering_fields = ['bill_number', 'bill_date', 'created_at', 'payment_status']

    def get_serializer_class(self):
        if self.action == 'create' or self.action == 'generate':
            return BillCreateSerializer
        return BillSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def list(self, request, *args, **kwargs):
        """Auto-update Outstanding status before returning list"""
        sent_bills = Bill.objects.filter(payment_status='Sent', sent_date__isnull=False)
        for bill in sent_bills:
            bill.update_outstanding_status()

        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        """Auto-update Outstanding status on detail view"""
        instance = self.get_object()
        instance.update_outstanding_status()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def mark_sent(self, request, pk=None):
        """Mark bill as Sent"""
        from django.core.exceptions import ValidationError
        bill = self.get_object()
        try:
            bill.mark_as_sent()
            return Response({
                'status': 'success',
                'message': f'Bill {bill.bill_number} marked as Sent',
                'payment_status': bill.payment_status,
                'sent_date': bill.sent_date
            })
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        """Mark bill as Paid"""
        from django.core.exceptions import ValidationError
        bill = self.get_object()
        try:
            bill.mark_as_paid()
            return Response({
                'status': 'success',
                'message': f'Bill {bill.bill_number} marked as Paid',
                'payment_status': bill.payment_status
            })
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def mark_scrap(self, request, pk=None):
        """Mark bill as Scrap (cancelled/discarded)"""
        from django.core.exceptions import ValidationError
        bill = self.get_object()
        try:
            bill.mark_as_scrap()
            return Response({
                'status': 'success',
                'message': f'Bill {bill.bill_number} marked as Scrap',
                'payment_status': bill.payment_status
            })
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def generate(self, request):
        serializer = BillCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        bill = serializer.save(created_by=request.user)

        pdf_content = generate_bill_pdf(bill)
        bill.pdf_file = pdf_content
        bill.save()

        # Generate filename with party name and bill date
        party_name = bill.party.name.replace(' ', '_')
        bill_date = bill.bill_date.strftime('%Y-%m-%d')
        filename = f"{party_name}_bill_{bill_date}.pdf"

        response = HttpResponse(pdf_content, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response['Content-Length'] = len(pdf_content)
        response['X-Content-Type-Options'] = 'nosniff'
        response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        return response

    @action(detail=True, methods=['get'])
    def pdf(self, request, pk=None):
        bill = self.get_object()

        if bill.pdf_file:
            pdf_content = bytes(bill.pdf_file)
        else:
            pdf_content = generate_bill_pdf(bill)
            bill.pdf_file = pdf_content
            bill.save()

        # Generate filename with party name and bill date
        party_name = bill.party.name.replace(' ', '_')
        bill_date = bill.bill_date.strftime('%Y-%m-%d')
        filename = f"{party_name}_bill_{bill_date}.pdf"

        response = HttpResponse(pdf_content, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response['Content-Length'] = len(pdf_content)
        response['X-Content-Type-Options'] = 'nosniff'
        response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        return response

    @action(detail=False, methods=['get'], url_path='export-ledger')
    def export_ledger(self, request):
        # New comprehensive ledger based on fiscal year
        fiscal_year = request.query_params.get('fiscal_year')

        if fiscal_year:
            # Generate comprehensive ledger for all parties
            try:
                fiscal_year = int(fiscal_year)
            except (ValueError, TypeError):
                return Response(
                    {'error': 'Invalid fiscal year'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            from .reports import generate_comprehensive_ledger_excel
            excel_content = generate_comprehensive_ledger_excel(fiscal_year)

            response = HttpResponse(
                excel_content,
                content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
            filename = f"Comprehensive_Ledger_FY{fiscal_year}-{str(fiscal_year+1)[-2:]}.xlsx"
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            response['Content-Length'] = len(excel_content)
            response['X-Content-Type-Options'] = 'nosniff'
            response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            return response

        # Legacy support: single party ledger with date range
        party_id = request.query_params.get('party_id')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        if not all([party_id, start_date, end_date]):
            return Response(
                {'error': 'Either fiscal_year OR (party_id, start_date, end_date) are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            party = Party.objects.get(pk=party_id)
        except Party.DoesNotExist:
            return Response(
                {'error': 'Party not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        excel_content = generate_ledger_excel(party, start_date, end_date)

        response = HttpResponse(
            excel_content,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        filename = f"Ledger_{party.name}_{start_date}_to_{end_date}.xlsx"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response['Content-Length'] = len(excel_content)
        response['X-Content-Type-Options'] = 'nosniff'
        response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        return response


class NotificationViewSet(viewsets.ModelViewSet):
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['notification_type', 'priority', 'is_read', 'is_dismissed', 'party']
    search_fields = ['title', 'message', 'party__name', 'bill__bill_number']
    ordering_fields = ['created_at', 'priority', 'is_read']
    ordering = ['-created_at']

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """Get count of unread notifications"""
        count = self.queryset.filter(is_read=False, is_dismissed=False).count()
        return Response({'unread_count': count})

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark notification as read"""
        notification = self.get_object()
        notification.mark_as_read()
        return Response({'status': 'marked as read'})

    @action(detail=True, methods=['post'])
    def dismiss(self, request, pk=None):
        """Dismiss notification"""
        notification = self.get_object()
        notification.dismiss()
        return Response({'status': 'dismissed'})

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        """Mark all notifications as read"""
        updated = self.queryset.filter(is_read=False, is_dismissed=False).update(
            is_read=True,
            read_at=timezone.now()
        )
        return Response({'marked_read': updated})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_party_quality_rate(request):
    """
    Get effective rate for party-quality combination.

    Query params:
        party_id: ID of the party
        quality_type_id: ID of the quality type

    Returns:
        {
            "rate": "60.00",
            "source": "party_specific|quality_default|fallback"
        }
    """
    party_id = request.query_params.get('party_id')
    quality_type_id = request.query_params.get('quality_type_id')

    if not party_id or not quality_type_id:
        return Response(
            {"error": "Both party_id and quality_type_id are required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        party = Party.objects.get(id=party_id)
        quality_type = QualityType.objects.get(id=quality_type_id)
    except (Party.DoesNotExist, QualityType.DoesNotExist):
        return Response(
            {"error": "Party or QualityType not found"},
            status=status.HTTP_404_NOT_FOUND
        )

    # Get rate using helper method
    rate = ProcessProgram.get_rate_for_party_quality(party, quality_type)

    # Determine source
    source = "fallback"
    if rate > 0:
        if PartyQualityRate.objects.filter(
            party=party,
            quality_type=quality_type
        ).exists():
            source = "party_specific"
        elif quality_type.default_rate_per_meter:
            source = "quality_default"

    return Response({
        "rate": str(rate),
        "source": source
    })
