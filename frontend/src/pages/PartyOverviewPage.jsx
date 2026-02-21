import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import NotificationCenter from '../components/NotificationCenter';
import { partiesAPI, qualityTypesAPI, notificationsAPI } from '../services/api';
import analyticsAPI from '../services/analytics';
import { Icons } from '../constants/icons';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import '../styles/theme.css';
import '../styles/PartyOverview.css';

const PartyOverviewPage = () => {
  console.log('PartyOverviewPage rendering...');
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('sidebarOpen');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // State management
  const [filters, setFilters] = useState({
    party: '',
    quality_type: '',
    start_date: '',
    end_date: ''
  });
  const [overviewData, setOverviewData] = useState(null);
  const [parties, setParties] = useState([]);
  const [qualityTypes, setQualityTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedParty, setExpandedParty] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Notification state
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    loadDropdownData();
  }, []);

  useEffect(() => {
    loadOverviewData();
  }, [filters]);

  useEffect(() => {
    localStorage.setItem('sidebarOpen', JSON.stringify(sidebarOpen));
  }, [sidebarOpen]);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const response = await notificationsAPI.getUnreadCount();
        setUnreadCount(response.data.unread_count);
      } catch (error) {
        console.error('Failed to fetch unread count:', error);
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadDropdownData = async () => {
    try {
      const [partiesRes, qualityRes] = await Promise.all([
        partiesAPI.getAll(),
        qualityTypesAPI.getAll()
      ]);
      setParties(partiesRes.data.results || partiesRes.data);
      setQualityTypes(qualityRes.data.results || qualityRes.data);
    } catch (err) {
      console.error('Failed to load dropdown data:', err);
    }
  };

  const loadOverviewData = async () => {
    console.log('Loading overview data...');
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filters.party) params.party = filters.party;
      if (filters.quality_type) params.quality_type = filters.quality_type;
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;

      console.log('API params:', params);
      const response = await analyticsAPI.getPartyBalanceOverview(params);
      console.log('API response:', response.data);
      setOverviewData(response.data);
      setCurrentPage(1);
    } catch (err) {
      console.error('Failed to load overview data:', err);
      setError('Failed to load party balance overview');
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setFilters({
      party: '',
      quality_type: '',
      start_date: '',
      end_date: ''
    });
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 2
    }).format(num);
  };

  const togglePartyExpansion = (partyId) => {
    setExpandedParty(expandedParty === partyId ? null : partyId);
  };

  const getConsumptionBadgeClass = (percentage) => {
    if (percentage > 80) return 'badge-danger';
    if (percentage > 50) return 'badge-warning';
    return 'badge-success';
  };

  // Pagination
  const totalPages = Math.ceil((overviewData?.parties?.length || 0) / itemsPerPage);
  const paginatedParties = overviewData?.parties?.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  ) || [];

  const goToPage = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Chart colors
  const CHART_COLORS = ['#374151', '#065f46', '#6b7280', '#d97706', '#7f1d1d', '#4338ca', '#be123c', '#0e7490'];

  // Prepare chart data
  const getBalanceChartData = () => {
    if (!overviewData?.parties) return [];
    return overviewData.parties
      .slice(0, 10)
      .map(party => ({
        name: party.party_name.length > 15 ? party.party_name.substring(0, 15) + '...' : party.party_name,
        balance: party.current_balance
      }));
  };

  const getTopConsumptionData = () => {
    if (!overviewData?.parties) return [];
    return overviewData.parties
      .slice(0, 10)
      .map(party => ({
        name: party.party_name.length > 15 ? party.party_name.substring(0, 15) + '...' : party.party_name,
        consumed: party.consumed
      }));
  };

  console.log('Render state:', { loading, overviewData, error, sidebarOpen });

  return (
    <div className={`page-with-sidebar ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        activePage="party-overview"
      />

      <NotificationCenter
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        onNotificationUpdate={(count) => setUnreadCount(count)}
      />

      <div className="main-content-area" style={{ padding: '2rem', minHeight: '100%', background: 'var(--bg-main)' }}>
        {/* Header */}
        <div className="analytics-header">
          <div className="header-left">
            <div className="header-icon">
              <Icons.Party size={24} />
            </div>
            <h1>Party Balance Overview</h1>
          </div>
          <div className="header-actions">
            <button
              onClick={loadOverviewData}
              className="btn-icon"
              disabled={loading}
              title="Refresh data"
            >
              <Icons.Refresh size={20} />
            </button>
            <button
              onClick={() => setShowNotifications(true)}
              className="btn-icon notification-bell"
              style={{ position: 'relative' }}
            >
              <Icons.Bell size={20} />
              {unreadCount > 0 && (
                <span className="notification-badge">{unreadCount}</span>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="alert alert-error">
            {error}
            <button onClick={() => setError('')} className="alert-close">×</button>
          </div>
        )}

        {/* Filters Card */}
        <div className="card filters-card">
          <h3 className="card-title">Filters</h3>
          <div className="filters-row">
            <div className="filter-group">
              <label>Party</label>
              <select
                value={filters.party}
                onChange={(e) => setFilters({ ...filters, party: e.target.value })}
                disabled={loading}
              >
                <option value="">All Parties</option>
                {parties.map(party => (
                  <option key={party.id} value={party.id}>{party.name}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Quality Type</label>
              <select
                value={filters.quality_type}
                onChange={(e) => setFilters({ ...filters, quality_type: e.target.value })}
                disabled={loading}
              >
                <option value="">All Quality Types</option>
                {qualityTypes.map(qt => (
                  <option key={qt.id} value={qt.id}>{qt.name}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>From Date</label>
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                disabled={loading}
                max={today}
              />
            </div>

            <div className="filter-group">
              <label>To Date</label>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                disabled={loading}
                max={today}
              />
            </div>

            <div className="filter-group">
              <label>&nbsp;</label>
              <button onClick={clearFilters} className="btn btn-secondary" disabled={loading}>
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {loading && !overviewData ? (
          <div className="loading-overlay">Loading party balance overview...</div>
        ) : overviewData ? (
          <>
            {/* KPI Cards */}
            <div className="kpi-grid">
              <div className="kpi-card kpi-card-parties">
                <div className="kpi-icon">
                  <Icons.Party size={24} />
                </div>
                <div className="kpi-content">
                  <div className="kpi-value">{overviewData.summary.total_parties}</div>
                  <div className="kpi-label">Total Parties</div>
                </div>
              </div>

              <div className="kpi-card kpi-card-inward">
                <div className="kpi-icon">
                  <Icons.TrendingUp size={24} />
                </div>
                <div className="kpi-content">
                  <div className="kpi-value">{formatNumber(overviewData.summary.total_inward)} m</div>
                  <div className="kpi-label">Total Inward</div>
                </div>
              </div>

              <div className="kpi-card kpi-card-consumed">
                <div className="kpi-icon">
                  <Icons.TrendingDown size={24} />
                </div>
                <div className="kpi-content">
                  <div className="kpi-value">{formatNumber(overviewData.summary.total_consumed)} m</div>
                  <div className="kpi-label">Total Consumed</div>
                </div>
              </div>

              <div className="kpi-card kpi-card-balance">
                <div className="kpi-icon">
                  <Icons.Package size={24} />
                </div>
                <div className="kpi-content">
                  <div className="kpi-value">{formatNumber(overviewData.summary.available_balance)} m</div>
                  <div className="kpi-label">Available Balance</div>
                </div>
              </div>
            </div>

            {/* Charts Row */}
            {overviewData.parties.length > 0 && (
              <div className="charts-row">
                <div className="chart-card">
                  <h3>Party-wise Balance Distribution</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={getBalanceChartData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value) => `${formatNumber(value)} m`} />
                      <Bar dataKey="balance" fill="#065f46" name="Available Balance (m)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="chart-card">
                  <h3>Top 10 Consumption by Party</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={getTopConsumptionData()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#374151"
                        dataKey="consumed"
                      >
                        {getTopConsumptionData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `${formatNumber(value)} m`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Party Details */}
            <div className="card">
              <h3 className="card-title">
                Party Details ({overviewData.parties.length})
              </h3>

              {overviewData.parties.length === 0 ? (
                <div className="no-data">
                  <Icons.AlertCircle size={48} />
                  <p>No parties found with the selected filters</p>
                </div>
              ) : (
                <>
                  <div className="parties-list">
                    {paginatedParties.map((party) => (
                      <div key={party.party_id} className="party-section">
                        <div
                          className="party-header"
                          onClick={() => togglePartyExpansion(party.party_id)}
                        >
                          <div className="party-info">
                            <h4>{party.party_name}</h4>
                            <p className="party-contact">{party.contact}</p>
                          </div>
                          <div className="party-summary">
                            <div className="summary-item">
                              <span className="summary-label">Inward</span>
                              <span className="summary-value">{formatNumber(party.total_inward)} m</span>
                            </div>
                            <div className="summary-item">
                              <span className="summary-label">Balance</span>
                              <span className="summary-value">{formatNumber(party.current_balance)} m</span>
                            </div>
                            <div className="summary-item">
                              <span className="summary-label">Consumed</span>
                              <span className="summary-value">{formatNumber(party.consumed)} m</span>
                            </div>
                          </div>
                          <div className="expand-icon">
                            {expandedParty === party.party_id ? (
                              <Icons.ChevronUp size={24} />
                            ) : (
                              <Icons.ChevronDown size={24} />
                            )}
                          </div>
                        </div>

                        {expandedParty === party.party_id && (
                          <div className="party-details">
                            {/* Quality Breakdown */}
                            <div className="detail-section">
                              <h5>Quality-wise Breakdown</h5>
                              <div className="table-scroll">
                                <table className="data-table">
                                  <thead>
                                    <tr>
                                      <th>Quality Type</th>
                                      <th>Lot Count</th>
                                      <th>Total Inward (m)</th>
                                      <th>Current Balance (m)</th>
                                      <th>Consumed (m)</th>
                                      <th>Consumption %</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {party.quality_breakdown.map((quality, idx) => (
                                      <tr key={idx}>
                                        <td><strong>{quality.quality_name}</strong></td>
                                        <td>{quality.lot_count}</td>
                                        <td>{formatNumber(quality.total_inward)}</td>
                                        <td>{formatNumber(quality.current_balance)}</td>
                                        <td>{formatNumber(quality.consumed)}</td>
                                        <td>
                                          <span className={`badge ${getConsumptionBadgeClass(quality.consumption_percentage)}`}>
                                            {quality.consumption_percentage.toFixed(1)}%
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* Duration Summary */}
                            <div className="detail-section">
                              <h5>Material Age Distribution</h5>
                              <div className="duration-cards">
                                <div className="duration-card duration-fresh">
                                  <div className="duration-label">0-30 Days (Fresh)</div>
                                  <div className="duration-value">{party.duration_summary['0-30'].count} lots</div>
                                  <div className="duration-meters">{formatNumber(party.duration_summary['0-30'].meters)} m</div>
                                </div>
                                <div className="duration-card duration-moderate">
                                  <div className="duration-label">31-60 Days</div>
                                  <div className="duration-value">{party.duration_summary['31-60'].count} lots</div>
                                  <div className="duration-meters">{formatNumber(party.duration_summary['31-60'].meters)} m</div>
                                </div>
                                <div className="duration-card duration-older">
                                  <div className="duration-label">61-90 Days</div>
                                  <div className="duration-value">{party.duration_summary['61-90'].count} lots</div>
                                  <div className="duration-meters">{formatNumber(party.duration_summary['61-90'].meters)} m</div>
                                </div>
                                <div className="duration-card duration-oldest">
                                  <div className="duration-label">90+ Days (Old)</div>
                                  <div className="duration-value">{party.duration_summary['90+'].count} lots</div>
                                  <div className="duration-meters">{formatNumber(party.duration_summary['90+'].meters)} m</div>
                                </div>
                              </div>
                            </div>

                            {/* Recent Lots */}
                            <div className="detail-section">
                              <h5>Recent Lots (Last 20)</h5>
                              <div className="table-scroll">
                                <table className="data-table">
                                  <thead>
                                    <tr>
                                      <th>Lot Number</th>
                                      <th>Quality</th>
                                      <th>Inward Date</th>
                                      <th>Days Old</th>
                                      <th>Total (m)</th>
                                      <th>Balance (m)</th>
                                      <th>Balance %</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {party.recent_lots.length === 0 ? (
                                      <tr><td colSpan="7" className="text-center">No lots found</td></tr>
                                    ) : (
                                      party.recent_lots.map((lot, idx) => (
                                        <tr key={idx}>
                                          <td><strong>{lot.lot_number}</strong></td>
                                          <td>{lot.quality_name}</td>
                                          <td>{lot.inward_date}</td>
                                          <td>{lot.days_old}</td>
                                          <td>{formatNumber(lot.total_meters)}</td>
                                          <td>{formatNumber(lot.current_balance)}</td>
                                          <td>
                                            <span className={`badge ${getConsumptionBadgeClass(lot.balance_percentage)}`}>
                                              {lot.balance_percentage.toFixed(1)}%
                                            </span>
                                          </td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* Program Consumption */}
                            <div className="detail-section">
                              <h5>Program Consumption (Top 10)</h5>
                              <div className="table-scroll">
                                <table className="data-table">
                                  <thead>
                                    <tr>
                                      <th>Program Number</th>
                                      <th>Design Number</th>
                                      <th>Status</th>
                                      <th>Input (m)</th>
                                      <th>Output (m)</th>
                                      <th>Wastage (m)</th>
                                      <th>Efficiency %</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {party.program_consumption.length === 0 ? (
                                      <tr><td colSpan="7" className="text-center">No programs found</td></tr>
                                    ) : (
                                      party.program_consumption.map((program, idx) => (
                                        <tr key={idx}>
                                          <td><strong>{program.program_number}</strong></td>
                                          <td>{program.design_number}</td>
                                          <td>
                                            <span className={`badge ${program.status === 'Completed' ? 'badge-success' : 'badge-warning'}`}>
                                              {program.status}
                                            </span>
                                          </td>
                                          <td>{formatNumber(program.input_meters)}</td>
                                          <td>{formatNumber(program.output_meters)}</td>
                                          <td>{formatNumber(program.wastage_meters)}</td>
                                          <td>
                                            <span className={`badge ${program.efficiency_percentage >= 90 ? 'badge-success' : program.efficiency_percentage >= 75 ? 'badge-warning' : 'badge-danger'}`}>
                                              {program.efficiency_percentage.toFixed(1)}%
                                            </span>
                                          </td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="pagination-controls">
                      <button
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="btn btn-secondary"
                      >
                        Previous
                      </button>
                      <span className="pagination-info">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="btn btn-secondary"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default PartyOverviewPage;
