"""
Analytics API endpoints for dashboard metrics and visualizations
"""
from datetime import datetime, timedelta
from decimal import Decimal
from django.db.models import Sum, Count, Avg, F, Case, When, IntegerField, Q, DecimalField
from django.db.models.functions import TruncMonth, TruncDate, Coalesce
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import InwardLot, ProcessProgram, Bill, Party, QualityType, ProgramLotAllocation


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def inventory_overview(request):
    """
    Get inventory overview KPIs
    Returns: total lots, total meters, available meters, allocated meters, low stock count
    """
    stats = InwardLot.objects.aggregate(
        total_lots=Count('id'),
        total_meters=Coalesce(Sum('total_meters'), Decimal('0')),
        available_meters=Coalesce(Sum('current_balance'), Decimal('0')),
    )
    
    allocated_meters = float(stats['total_meters']) - float(stats['available_meters'])
    
    # Count lots with balance < 20% as low stock
    low_stock_count = InwardLot.objects.filter(
        current_balance__lt=F('total_meters') * 0.2,
        current_balance__gt=0
    ).count()
    
    return Response({
        'total_lots': stats['total_lots'] or 0,
        'total_meters': float(stats['total_meters']),
        'available_meters': float(stats['available_meters']),
        'allocated_meters': allocated_meters,
        'low_stock_count': low_stock_count
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def inventory_balance_distribution(request):
    """
    Get inventory balance distribution by percentage ranges
    Returns: count of lots in each balance category
    """
    distribution = InwardLot.objects.aggregate(
        high_balance=Count(Case(
            When(current_balance__gte=F('total_meters') * 0.5, then=1),
            output_field=IntegerField()
        )),
        medium_balance=Count(Case(
            When(
                current_balance__gte=F('total_meters') * 0.1,
                current_balance__lt=F('total_meters') * 0.5,
                then=1
            ),
            output_field=IntegerField()
        )),
        low_balance=Count(Case(
            When(
                current_balance__gt=0,
                current_balance__lt=F('total_meters') * 0.1,
                then=1
            ),
            output_field=IntegerField()
        )),
        depleted=Count(Case(
            When(current_balance=0, then=1),
            output_field=IntegerField()
        ))
    )
    
    return Response([
        {'name': 'High (>50%)', 'value': distribution['high_balance'], 'color': '#82ca9d'},
        {'name': 'Medium (10-50%)', 'value': distribution['medium_balance'], 'color': '#ffc658'},
        {'name': 'Low (<10%)', 'value': distribution['low_balance'], 'color': '#ff8042'},
        {'name': 'Depleted', 'value': distribution['depleted'], 'color': '#8884d8'},
    ])


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def inventory_by_quality(request):
    """
    Get inventory breakdown by quality type
    Returns: quality type with total and available meters
    """
    quality_stats = InwardLot.objects.values(
        quality_name=F('quality_type__name')
    ).annotate(
        total_meters=Coalesce(Sum('total_meters'), Decimal('0')),
        available_meters=Coalesce(Sum('current_balance'), Decimal('0')),
        lot_count=Count('id')
    ).order_by('-total_meters')
    
    data = [
        {
            'quality_name': item['quality_name'],
            'total_meters': float(item['total_meters']),
            'available_meters': float(item['available_meters']),
            'allocated_meters': float(item['total_meters']) - float(item['available_meters']),
            'lot_count': item['lot_count']
        }
        for item in quality_stats
    ]
    
    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def inventory_low_stock(request):
    """
    Get list of lots with low stock (<20% balance)
    Returns: lots with critical stock levels
    """
    low_stock_lots = InwardLot.objects.filter(
        current_balance__lt=F('total_meters') * 0.2,
        current_balance__gt=0
    ).select_related('party', 'quality_type').annotate(
        balance_percentage=Case(
            When(total_meters__gt=0, then=F('current_balance') * 100.0 / F('total_meters')),
            default=0,
            output_field=DecimalField(max_digits=5, decimal_places=2)
        )
    ).order_by('balance_percentage')[:20]
    
    data = [
        {
            'lot_number': lot.lot_number,
            'party_name': lot.party.name,
            'quality_name': lot.quality_type.name,
            'total_meters': float(lot.total_meters),
            'current_balance': float(lot.current_balance),
            'balance_percentage': float(lot.balance_percentage)
        }
        for lot in low_stock_lots
    ]
    
    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def production_overview(request):
    """
    Get production overview KPIs
    Returns: total programs, avg efficiency, avg wastage, total output
    """
    stats = ProcessProgram.objects.aggregate(
        total_programs=Count('id'),
        completed_programs=Count(Case(
            When(status='Completed', then=1),
            output_field=IntegerField()
        )),
        pending_programs=Count(Case(
            When(status='Pending', then=1),
            output_field=IntegerField()
        )),
        total_input=Coalesce(Sum('input_meters'), Decimal('0')),
        total_output=Coalesce(Sum('output_meters'), Decimal('0')),
        total_wastage=Coalesce(Sum('wastage_meters'), Decimal('0'))
    )
    
    # Calculate averages
    total_input = float(stats['total_input'])
    total_output = float(stats['total_output'])
    total_wastage = float(stats['total_wastage'])
    
    avg_efficiency = (total_output / total_input * 100) if total_input > 0 else 0
    avg_wastage = (total_wastage / total_input * 100) if total_input > 0 else 0
    
    return Response({
        'total_programs': stats['total_programs'] or 0,
        'completed_programs': stats['completed_programs'] or 0,
        'pending_programs': stats['pending_programs'] or 0,
        'total_input': total_input,
        'total_output': total_output,
        'total_wastage': total_wastage,
        'avg_efficiency': round(avg_efficiency, 2),
        'avg_wastage': round(avg_wastage, 2)
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def production_status_breakdown(request):
    """
    Get program status breakdown with metrics
    Returns: programs grouped by status with totals
    """
    breakdown = ProcessProgram.objects.values('status').annotate(
        count=Count('id'),
        total_input=Coalesce(Sum('input_meters'), Decimal('0')),
        total_output=Coalesce(Sum('output_meters'), Decimal('0')),
        total_wastage=Coalesce(Sum('wastage_meters'), Decimal('0'))
    ).order_by('status')
    
    data = [
        {
            'status': item['status'],
            'count': item['count'],
            'total_input': float(item['total_input']),
            'total_output': float(item['total_output']),
            'total_wastage': float(item['total_wastage'])
        }
        for item in breakdown
    ]
    
    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def production_wastage_trend(request):
    """
    Get wastage trend over time (monthly)
    Returns: monthly wastage percentages for last 12 months
    """
    # Get date 12 months ago
    twelve_months_ago = datetime.now() - timedelta(days=365)
    
    monthly_wastage = ProcessProgram.objects.filter(
        created_at__gte=twelve_months_ago
    ).annotate(
        month=TruncMonth('created_at')
    ).values('month').annotate(
        total_input=Coalesce(Sum('input_meters'), Decimal('0')),
        total_wastage=Coalesce(Sum('wastage_meters'), Decimal('0')),
        program_count=Count('id')
    ).order_by('month')
    
    data = []
    for item in monthly_wastage:
        total_input = float(item['total_input'])
        total_wastage = float(item['total_wastage'])
        wastage_percent = (total_wastage / total_input * 100) if total_input > 0 else 0
        
        data.append({
            'month': item['month'].strftime('%b %Y'),
            'wastage_percent': round(wastage_percent, 2),
            'total_wastage': total_wastage,
            'program_count': item['program_count']
        })
    
    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def production_high_wastage(request):
    """
    Get top programs with high wastage
    Returns: top 20 programs sorted by wastage percentage
    """
    from django.db.models import FloatField
    from django.db.models.functions import Cast
    
    high_wastage_programs = ProcessProgram.objects.filter(
        input_meters__gt=0
    ).annotate(
        wastage_pct=Cast(F('wastage_meters'), FloatField()) * 100.0 / Cast(F('input_meters'), FloatField())
    ).order_by('-wastage_pct')[:20]
    
    data = [
        {
            'program_number': program.program_number,
            'design_number': program.design_number,
            'input_meters': float(program.input_meters),
            'output_meters': float(program.output_meters),
            'wastage_meters': float(program.wastage_meters),
            'wastage_percentage': float(program.wastage_pct),
            'status': program.status
        }
        for program in high_wastage_programs
    ]
    
    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def production_by_quality(request):
    """
    Get production metrics by quality type
    Returns: wastage and efficiency by quality type
    """
    # Get quality stats through lot allocations
    quality_stats = ProcessProgram.objects.values(
        quality_name=F('programlotallocation__lot__quality_type__name')
    ).annotate(
        program_count=Count('id', distinct=True),
        total_input=Coalesce(Sum('input_meters'), Decimal('0')),
        total_output=Coalesce(Sum('output_meters'), Decimal('0')),
        total_wastage=Coalesce(Sum('wastage_meters'), Decimal('0'))
    ).order_by('-program_count')
    
    data = []
    for item in quality_stats:
        if item['quality_name']:  # Skip null quality names
            total_input = float(item['total_input'])
            total_output = float(item['total_output'])
            total_wastage = float(item['total_wastage'])
            
            wastage_pct = (total_wastage / total_input * 100) if total_input > 0 else 0
            efficiency_pct = (total_output / total_input * 100) if total_input > 0 else 0
            
            data.append({
                'quality_name': item['quality_name'],
                'program_count': item['program_count'],
                'total_input': total_input,
                'total_output': total_output,
                'wastage_percentage': round(wastage_pct, 2),
                'efficiency_percentage': round(efficiency_pct, 2)
            })
    
    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def financial_overview(request):
    """
    Get financial overview KPIs
    Returns: total revenue, bills count, avg bill value, outstanding programs
    """
    bill_stats = Bill.objects.aggregate(
        total_bills=Count('id'),
        total_revenue=Coalesce(Sum('grand_total'), Decimal('0')),
        avg_bill=Avg('grand_total')
    )
    
    # Count completed programs not yet billed
    billed_program_ids = Bill.objects.values_list('programs', flat=True)
    outstanding_programs = ProcessProgram.objects.filter(
        status='Completed'
    ).exclude(
        id__in=billed_program_ids
    ).count()
    
    return Response({
        'total_bills': bill_stats['total_bills'] or 0,
        'total_revenue': float(bill_stats['total_revenue']),
        'avg_bill_value': float(bill_stats['avg_bill'] or 0),
        'outstanding_programs': outstanding_programs
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def financial_revenue_trend(request):
    """
    Get monthly revenue trend for last 12 months
    Returns: monthly revenue and bill counts
    """
    twelve_months_ago = datetime.now() - timedelta(days=365)
    
    monthly_revenue = Bill.objects.filter(
        bill_date__gte=twelve_months_ago
    ).annotate(
        month=TruncMonth('bill_date')
    ).values('month').annotate(
        total_revenue=Coalesce(Sum('grand_total'), Decimal('0')),
        bill_count=Count('id'),
        avg_bill=Avg('grand_total')
    ).order_by('month')
    
    data = [
        {
            'month': item['month'].strftime('%b %Y'),
            'total_revenue': float(item['total_revenue']),
            'bill_count': item['bill_count'],
            'avg_bill': float(item['avg_bill'] or 0)
        }
        for item in monthly_revenue
    ]
    
    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def financial_by_quality(request):
    """
    Get revenue breakdown by quality type
    Returns: revenue contribution by quality type
    """
    # Get quality type from program lots
    quality_revenue = []
    
    for quality in QualityType.objects.all():
        # Find bills that contain programs using this quality type
        total_revenue = Decimal('0')
        bill_count = 0
        
        for bill in Bill.objects.all():
            # Check if any program in this bill uses this quality type
            for program in bill.programs.all():
                lots = program.get_lots()
                if any(lot.quality_type == quality for lot in lots):
                    total_revenue += bill.grand_total
                    bill_count += 1
                    break
        
        if total_revenue > 0:
            quality_revenue.append({
                'quality_name': quality.name,
                'total_revenue': float(total_revenue),
                'bill_count': bill_count
            })
    
    # Sort by revenue
    quality_revenue.sort(key=lambda x: x['total_revenue'], reverse=True)
    
    return Response(quality_revenue)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def financial_recent_bills(request):
    """
    Get recent bills (last 20)
    Returns: recent bills with details
    """
    recent_bills = Bill.objects.select_related('party').order_by('-bill_date')[:20]
    
    data = [
        {
            'bill_number': bill.bill_number,
            'party_name': bill.party.name,
            'bill_date': bill.bill_date.strftime('%Y-%m-%d'),
            'program_count': bill.programs.count(),
            'subtotal': float(bill.subtotal),
            'tax_total': float(bill.tax_total),
            'grand_total': float(bill.grand_total)
        }
        for bill in recent_bills
    ]
    
    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def party_top_performers(request):
    """
    Get top parties by volume and revenue
    Returns: top 10 parties with performance metrics
    """
    parties_data = []
    
    for party in Party.objects.filter(is_active=True):
        # Get total inward meters
        total_inward = InwardLot.objects.filter(party=party).aggregate(
            total=Coalesce(Sum('total_meters'), Decimal('0'))
        )['total']
        
        # Get program count
        program_count = ProcessProgram.objects.filter(
            programlotallocation__lot__party=party
        ).distinct().count()
        
        # Get revenue
        total_revenue = Bill.objects.filter(party=party).aggregate(
            total=Coalesce(Sum('grand_total'), Decimal('0'))
        )['total']
        
        # Get bill count
        bill_count = Bill.objects.filter(party=party).count()
        
        if total_inward > 0 or total_revenue > 0:  # Only include active parties
            parties_data.append({
                'party_name': party.name,
                'total_inward_meters': float(total_inward),
                'program_count': program_count,
                'bill_count': bill_count,
                'total_revenue': float(total_revenue)
            })
    
    # Sort by revenue
    parties_data.sort(key=lambda x: x['total_revenue'], reverse=True)
    
    return Response(parties_data[:10])


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def party_performance_scorecard(request):
    """
    Get detailed party performance scorecard
    Returns: all parties with comprehensive metrics
    """
    parties_data = []
    
    for party in Party.objects.filter(is_active=True):
        # Active lots
        active_lots = InwardLot.objects.filter(
            party=party,
            current_balance__gt=0
        ).count()
        
        # Recent programs (last 30 days)
        thirty_days_ago = datetime.now() - timedelta(days=30)
        recent_programs = ProcessProgram.objects.filter(
            programlotallocation__lot__party=party,
            created_at__gte=thirty_days_ago
        ).distinct().count()
        
        # Recent revenue (last 30 days)
        recent_revenue = Bill.objects.filter(
            party=party,
            bill_date__gte=thirty_days_ago
        ).aggregate(
            total=Coalesce(Sum('grand_total'), Decimal('0'))
        )['total']
        
        # Average wastage - calculate from wastage_meters and input_meters
        programs_for_party = ProcessProgram.objects.filter(
            programlotallocation__lot__party=party,
            input_meters__gt=0
        )
        
        total_input = programs_for_party.aggregate(total=Sum('input_meters'))['total'] or 0
        total_wastage = programs_for_party.aggregate(total=Sum('wastage_meters'))['total'] or 0
        
        avg_wastage = (float(total_wastage) / float(total_input) * 100) if total_input > 0 else 0
        
        parties_data.append({
            'party_name': party.name,
            'contact': party.contact or 'N/A',
            'active_lots': active_lots,
            'programs_30d': recent_programs,
            'revenue_30d': float(recent_revenue),
            'avg_wastage': round(float(avg_wastage or 0), 2)
        })
    
    # Sort by recent revenue
    parties_data.sort(key=lambda x: x['revenue_30d'], reverse=True)

    return Response(parties_data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def party_balance_overview(request):
    """
    Get party balance overview with quality breakdown, duration summary,
    lot details, and program consumption

    Query params:
    - party: Party ID (optional)
    - quality_type: Quality Type ID (optional)
    - start_date: Start date filter (optional)
    - end_date: End date filter (optional)
    """
    from django.utils import timezone

    # Get filter parameters
    party_id = request.GET.get('party')
    quality_type_id = request.GET.get('quality_type')
    start_date = request.GET.get('start_date')
    end_date = request.GET.get('end_date')

    # Base queryset
    lots_queryset = InwardLot.objects.select_related('party', 'quality_type')

    # Apply filters
    if party_id:
        lots_queryset = lots_queryset.filter(party_id=party_id)
    if quality_type_id:
        lots_queryset = lots_queryset.filter(quality_type_id=quality_type_id)
    if start_date:
        lots_queryset = lots_queryset.filter(inward_date__gte=start_date)
    if end_date:
        lots_queryset = lots_queryset.filter(inward_date__lte=end_date)

    # Calculate summary totals
    summary_stats = lots_queryset.aggregate(
        total_parties=Count('party', distinct=True),
        total_inward=Coalesce(Sum('total_meters'), Decimal('0')),
        available_balance=Coalesce(Sum('current_balance'), Decimal('0'))
    )

    # Calculate consumed separately
    total_consumed = float(summary_stats['total_inward']) - float(summary_stats['available_balance'])

    summary = {
        'total_parties': summary_stats['total_parties'],
        'total_inward': float(summary_stats['total_inward']),
        'total_consumed': total_consumed,
        'available_balance': float(summary_stats['available_balance'])
    }

    # Get parties data
    parties_data = []

    # Get unique parties from filtered lots
    party_ids = lots_queryset.values_list('party_id', flat=True).distinct()
    parties = Party.objects.filter(id__in=party_ids)

    now = timezone.now().date()

    for party in parties:
        party_lots = lots_queryset.filter(party=party)

        # Quality-wise breakdown
        quality_breakdown = party_lots.values(
            quality_name=F('quality_type__name'),
            quality_id=F('quality_type__id')
        ).annotate(
            lot_count=Count('id'),
            total_inward=Coalesce(Sum('total_meters'), Decimal('0')),
            current_balance=Coalesce(Sum('current_balance'), Decimal('0'))
        ).order_by('-total_inward')

        quality_list = []
        for quality in quality_breakdown:
            total_inward = float(quality['total_inward'])
            current_balance = float(quality['current_balance'])
            consumed = total_inward - current_balance
            consumption_pct = (consumed / total_inward * 100) if total_inward > 0 else 0

            quality_list.append({
                'quality_name': quality['quality_name'],
                'lot_count': quality['lot_count'],
                'total_inward': total_inward,
                'current_balance': current_balance,
                'consumed': consumed,
                'consumption_percentage': round(consumption_pct, 2)
            })

        # Duration summary (material age)
        duration_summary = {
            '0-30': {'count': 0, 'meters': 0},
            '31-60': {'count': 0, 'meters': 0},
            '61-90': {'count': 0, 'meters': 0},
            '90+': {'count': 0, 'meters': 0}
        }

        for lot in party_lots:
            if lot.current_balance > 0:
                days_old = (now - lot.inward_date).days
                balance = float(lot.current_balance)

                if days_old <= 30:
                    duration_summary['0-30']['count'] += 1
                    duration_summary['0-30']['meters'] += balance
                elif days_old <= 60:
                    duration_summary['31-60']['count'] += 1
                    duration_summary['31-60']['meters'] += balance
                elif days_old <= 90:
                    duration_summary['61-90']['count'] += 1
                    duration_summary['61-90']['meters'] += balance
                else:
                    duration_summary['90+']['count'] += 1
                    duration_summary['90+']['meters'] += balance

        # Recent lots (last 20 with balance)
        recent_lots = party_lots.order_by('-inward_date')[:20]
        lots_list = []

        for lot in recent_lots:
            balance_pct = (float(lot.current_balance) / float(lot.total_meters) * 100) if lot.total_meters > 0 else 0
            days_old = (now - lot.inward_date).days

            lots_list.append({
                'lot_number': lot.lot_number,
                'quality_name': lot.quality_type.name,
                'inward_date': lot.inward_date.strftime('%Y-%m-%d'),
                'days_old': days_old,
                'total_meters': float(lot.total_meters),
                'current_balance': float(lot.current_balance),
                'balance_percentage': round(balance_pct, 2)
            })

        # Program consumption (top 10 programs using party material)
        programs = ProcessProgram.objects.filter(
            programlotallocation__lot__party=party,
            programlotallocation__lot__in=party_lots
        ).distinct().order_by('-created_at')[:10]

        programs_list = []
        for program in programs:
            efficiency_pct = (float(program.output_meters) / float(program.input_meters) * 100) if program.input_meters > 0 else 0

            programs_list.append({
                'program_number': program.program_number,
                'design_number': program.design_number,
                'status': program.status,
                'input_meters': float(program.input_meters),
                'output_meters': float(program.output_meters),
                'wastage_meters': float(program.wastage_meters),
                'efficiency_percentage': round(efficiency_pct, 2)
            })

        # Party summary
        party_total_inward = sum(q['total_inward'] for q in quality_list)
        party_current_balance = sum(q['current_balance'] for q in quality_list)
        party_consumed = sum(q['consumed'] for q in quality_list)

        parties_data.append({
            'party_id': party.id,
            'party_name': party.name,
            'contact': party.contact or 'N/A',
            'total_inward': party_total_inward,
            'current_balance': party_current_balance,
            'consumed': party_consumed,
            'quality_breakdown': quality_list,
            'duration_summary': duration_summary,
            'recent_lots': lots_list,
            'program_consumption': programs_list
        })

    # Sort parties by total inward descending
    parties_data.sort(key=lambda x: x['total_inward'], reverse=True)

    return Response({
        'summary': summary,
        'parties': parties_data
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def billing_payment_aging(request):
    """
    Payment aging report - categorize outstanding bills by age
    """
    from django.utils import timezone

    now = timezone.now()

    # Define aging buckets
    aging_data = Bill.objects.filter(
        payment_status__in=['Sent', 'Outstanding']
    ).aggregate(
        current_0_15=Count('id', filter=Q(sent_date__gte=now - timedelta(days=15))),
        current_16_30=Count('id', filter=Q(sent_date__gte=now - timedelta(days=30), sent_date__lt=now - timedelta(days=15))),
        overdue_31_60=Count('id', filter=Q(sent_date__gte=now - timedelta(days=60), sent_date__lt=now - timedelta(days=30))),
        overdue_61_90=Count('id', filter=Q(sent_date__gte=now - timedelta(days=90), sent_date__lt=now - timedelta(days=60))),
        overdue_90_plus=Count('id', filter=Q(sent_date__lt=now - timedelta(days=90))),

        amount_0_15=Sum('grand_total', filter=Q(sent_date__gte=now - timedelta(days=15))),
        amount_16_30=Sum('grand_total', filter=Q(sent_date__gte=now - timedelta(days=30), sent_date__lt=now - timedelta(days=15))),
        amount_31_60=Sum('grand_total', filter=Q(sent_date__gte=now - timedelta(days=60), sent_date__lt=now - timedelta(days=30))),
        amount_61_90=Sum('grand_total', filter=Q(sent_date__gte=now - timedelta(days=90), sent_date__lt=now - timedelta(days=60))),
        amount_90_plus=Sum('grand_total', filter=Q(sent_date__lt=now - timedelta(days=90))),
    )

    # Format response
    aging_buckets = [
        {
            'bucket': '0-15 days (Current)',
            'count': aging_data['current_0_15'] or 0,
            'amount': float(aging_data['amount_0_15'] or 0),
            'risk_level': 'low'
        },
        {
            'bucket': '16-30 days (Due Soon)',
            'count': aging_data['current_16_30'] or 0,
            'amount': float(aging_data['amount_16_30'] or 0),
            'risk_level': 'medium'
        },
        {
            'bucket': '31-60 days (Overdue)',
            'count': aging_data['overdue_31_60'] or 0,
            'amount': float(aging_data['amount_31_60'] or 0),
            'risk_level': 'high'
        },
        {
            'bucket': '61-90 days (Seriously Overdue)',
            'count': aging_data['overdue_61_90'] or 0,
            'amount': float(aging_data['amount_61_90'] or 0),
            'risk_level': 'urgent'
        },
        {
            'bucket': '90+ days (Critical)',
            'count': aging_data['overdue_90_plus'] or 0,
            'amount': float(aging_data['amount_90_plus'] or 0),
            'risk_level': 'critical'
        },
    ]

    total_outstanding = sum(bucket['amount'] for bucket in aging_buckets)
    total_bills = sum(bucket['count'] for bucket in aging_buckets)

    return Response({
        'aging_buckets': aging_buckets,
        'total_outstanding': total_outstanding,
        'total_bills': total_bills,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def billing_collection_efficiency(request):
    """
    Collection efficiency metrics - measure payment performance
    """
    from django.utils import timezone

    # Last 90 days
    ninety_days_ago = timezone.now() - timedelta(days=90)

    bills = Bill.objects.filter(bill_date__gte=ninety_days_ago)

    metrics = bills.aggregate(
        total_bills=Count('id'),
        paid_bills=Count('id', filter=Q(payment_status='Paid')),
        outstanding_bills=Count('id', filter=Q(payment_status='Outstanding')),
        sent_bills=Count('id', filter=Q(payment_status='Sent')),

        total_revenue=Sum('grand_total'),
        paid_revenue=Sum('grand_total', filter=Q(payment_status='Paid')),
        outstanding_revenue=Sum('grand_total', filter=Q(payment_status='Outstanding')),
    )

    # Calculate efficiency percentages
    total = metrics['total_bills'] or 1
    paid_pct = (metrics['paid_bills'] / total) * 100 if total > 0 else 0
    outstanding_pct = (metrics['outstanding_bills'] / total) * 100 if total > 0 else 0

    total_rev = float(metrics['total_revenue'] or 0)
    collection_rate = (float(metrics['paid_revenue'] or 0) / total_rev * 100) if total_rev > 0 else 0

    return Response({
        'period': '90 days',
        'total_bills': metrics['total_bills'],
        'paid_bills': metrics['paid_bills'],
        'outstanding_bills': metrics['outstanding_bills'],
        'paid_percentage': round(paid_pct, 2),
        'outstanding_percentage': round(outstanding_pct, 2),
        'total_revenue': total_rev,
        'collected_revenue': float(metrics['paid_revenue'] or 0),
        'outstanding_revenue': float(metrics['outstanding_revenue'] or 0),
        'collection_rate': round(collection_rate, 2),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def billing_outstanding_by_party(request):
    """
    Outstanding bills grouped by party with aging details
    """
    from django.utils import timezone
    from django.db.models import Sum, Count, Min, Max

    outstanding_bills = Bill.objects.filter(
        payment_status__in=['Sent', 'Outstanding']
    ).values('party', 'party__name').annotate(
        bill_count=Count('id'),
        total_outstanding=Sum('grand_total'),
        oldest_bill_date=Min('sent_date'),
        newest_bill_date=Max('sent_date'),
    ).order_by('-total_outstanding')

    # Calculate days overdue for oldest bill
    result = []
    for item in outstanding_bills:
        if item['oldest_bill_date']:
            days_overdue = (timezone.now() - item['oldest_bill_date']).days
        else:
            days_overdue = 0

        result.append({
            'party_id': item['party'],
            'party_name': item['party__name'],
            'bill_count': item['bill_count'],
            'total_outstanding': float(item['total_outstanding']),
            'oldest_bill_days': days_overdue,
            'risk_level': 'critical' if days_overdue > 90 else 'high' if days_overdue > 60 else 'medium' if days_overdue > 30 else 'low'
        })

    return Response({'outstanding_by_party': result})
