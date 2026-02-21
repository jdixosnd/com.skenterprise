import api from './api';

const analyticsAPI = {
  // Inventory Analytics
  getInventoryOverview: () => api.get('/analytics/inventory/overview/'),
  getInventoryBalanceDistribution: () => api.get('/analytics/inventory/balance-distribution/'),
  getInventoryByQuality: () => api.get('/analytics/inventory/by-quality/'),
  getInventoryLowStock: () => api.get('/analytics/inventory/low-stock/'),
  
  // Production Analytics
  getProductionOverview: () => api.get('/analytics/production/overview/'),
  getProductionStatusBreakdown: () => api.get('/analytics/production/status-breakdown/'),
  getProductionWastageTrend: () => api.get('/analytics/production/wastage-trend/'),
  getProductionHighWastage: () => api.get('/analytics/production/high-wastage/'),
  getProductionByQuality: () => api.get('/analytics/production/by-quality/'),
  
  // Financial Analytics
  getFinancialOverview: () => api.get('/analytics/financial/overview/'),
  getFinancialRevenueTrend: () => api.get('/analytics/financial/revenue-trend/'),
  getFinancialByQuality: () => api.get('/analytics/financial/by-quality/'),
  getFinancialRecentBills: () => api.get('/analytics/financial/recent-bills/'),
  
  // Party Analytics
  getPartyTopPerformers: () => api.get('/analytics/party/top-performers/'),
  getPartyPerformanceScorecard: () => api.get('/analytics/party/performance-scorecard/'),
  getPartyBalanceOverview: (params) => api.get('/analytics/party/balance-overview/', { params }),

  // Billing Analytics
  getBillingPaymentAging: () => api.get('/analytics/billing/payment-aging/'),
  getBillingCollectionEfficiency: () => api.get('/analytics/billing/collection-efficiency/'),
  getBillingOutstandingByParty: () => api.get('/analytics/billing/outstanding-by-party/'),
};

export default analyticsAPI;
