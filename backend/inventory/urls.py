from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SystemConfigViewSet, PartyViewSet, QualityTypeViewSet, PartyQualityRateViewSet,
    InwardLotViewSet, ProcessProgramViewSet, ProgramLotAllocationViewSet,
    BillViewSet, NotificationViewSet, get_csrf_token, get_party_quality_rate
)
from . import analytics

router = DefaultRouter()
router.register(r'config', SystemConfigViewSet, basename='systemconfig')
router.register(r'parties', PartyViewSet, basename='party')
router.register(r'quality-types', QualityTypeViewSet, basename='qualitytype')
router.register(r'party-rates', PartyQualityRateViewSet, basename='partyqualityrate')
router.register(r'inward-lots', InwardLotViewSet, basename='inwardlot')
router.register(r'programs', ProcessProgramViewSet, basename='processprogram')
router.register(r'allocations', ProgramLotAllocationViewSet, basename='programlotallocation')
router.register(r'bills', BillViewSet, basename='bill')
router.register(r'notifications', NotificationViewSet, basename='notification')

urlpatterns = [
    path('csrf/', get_csrf_token, name='csrf'),
    path('rates/party-quality/', get_party_quality_rate, name='party-quality-rate'),
    path('', include(router.urls)),

    # Analytics endpoints
    path('analytics/inventory/overview/', analytics.inventory_overview, name='analytics-inventory-overview'),
    path('analytics/inventory/balance-distribution/', analytics.inventory_balance_distribution, name='analytics-inventory-balance'),
    path('analytics/inventory/by-quality/', analytics.inventory_by_quality, name='analytics-inventory-quality'),
    path('analytics/inventory/low-stock/', analytics.inventory_low_stock, name='analytics-inventory-lowstock'),
    
    path('analytics/production/overview/', analytics.production_overview, name='analytics-production-overview'),
    path('analytics/production/status-breakdown/', analytics.production_status_breakdown, name='analytics-production-status'),
    path('analytics/production/wastage-trend/', analytics.production_wastage_trend, name='analytics-production-wastage'),
    path('analytics/production/high-wastage/', analytics.production_high_wastage, name='analytics-production-highwastage'),
    path('analytics/production/by-quality/', analytics.production_by_quality, name='analytics-production-quality'),
    
    path('analytics/financial/overview/', analytics.financial_overview, name='analytics-financial-overview'),
    path('analytics/financial/revenue-trend/', analytics.financial_revenue_trend, name='analytics-financial-trend'),
    path('analytics/financial/by-quality/', analytics.financial_by_quality, name='analytics-financial-quality'),
    path('analytics/financial/recent-bills/', analytics.financial_recent_bills, name='analytics-financial-bills'),
    
    path('analytics/party/top-performers/', analytics.party_top_performers, name='analytics-party-top'),
    path('analytics/party/performance-scorecard/', analytics.party_performance_scorecard, name='analytics-party-scorecard'),
    path('analytics/party/balance-overview/', analytics.party_balance_overview, name='analytics-party-balance-overview'),

    # Billing Analytics
    path('analytics/billing/payment-aging/', analytics.billing_payment_aging, name='analytics-billing-aging'),
    path('analytics/billing/collection-efficiency/', analytics.billing_collection_efficiency, name='analytics-billing-efficiency'),
    path('analytics/billing/outstanding-by-party/', analytics.billing_outstanding_by_party, name='analytics-billing-outstanding'),
]

