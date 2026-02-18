import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import CalendarView from '../components/CalendarView';
import NotificationCenter from '../components/NotificationCenter';
import analyticsAPI from '../services/analytics';
import { programsAPI, inwardLotsAPI, billsAPI, notificationsAPI } from '../services/api';
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart
} from 'recharts';
import { Icons } from '../constants/icons';
import '../styles/theme.css';
import '../styles/AnalyticsDashboard.css';

// Professional muted color palette for business analytics
const COLORS = ['#374151', '#6b7280', '#065f46', '#78350f', '#1e3a8a', '#7f1d1d'];

const AnalyticsDashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(() => {
        // Check localStorage for sidebar state
        const saved = localStorage.getItem('sidebarOpen');
        return saved !== null ? JSON.parse(saved) : true;
    });
    const [activeTab, setActiveTab] = useState('inventory');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);

    // Notification states
    const [showNotifications, setShowNotifications] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    // Inventory State
    const [inventoryOverview, setInventoryOverview] = useState(null);
    const [balanceDistribution, setBalanceDistribution] = useState([]);
    const [stockByQuality, setStockByQuality] = useState([]);
    const [lowStockAlerts, setLowStockAlerts] = useState([]);

    // Production State
    const [productionOverview, setProductionOverview] = useState(null);
    const [productionStatus, setProductionStatus] = useState([]);
    const [wastageTrend, setWastageTrend] = useState([]);
    const [highWastagePrograms, setHighWastagePrograms] = useState([]);
    const [productionByQuality, setProductionByQuality] = useState([]);

    // Financial State
    const [financialOverview, setFinancialOverview] = useState(null);
    const [revenueTrend, setRevenueTrend] = useState([]);
    const [revenueByQuality, setRevenueByQuality] = useState([]);
    const [recentBills, setRecentBills] = useState([]);

    // Party State
    const [topParties, setTopParties] = useState([]);
    const [partyScorecard, setPartyScorecard] = useState([]);

    // Calendar State
    const [programs, setPrograms] = useState([]);
    const [inwardLots, setInwardLots] = useState([]);
    const [bills, setBills] = useState([]);

    useEffect(() => {
        loadData();
    }, [activeTab]);

    useEffect(() => {
        localStorage.setItem('sidebarOpen', JSON.stringify(sidebarOpen));
    }, [sidebarOpen]);

    // Fetch unread notification count
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
        // Poll every 60 seconds
        const interval = setInterval(fetchUnreadCount, 60000);
        return () => clearInterval(interval);
    }, []);

    const loadData = async () => {
        setLoading(true);
        setError('');
        try {
            if (activeTab === 'inventory') {
                await loadInventoryData();
            } else if (activeTab === 'production') {
                await loadProductionData();
            } else if (activeTab === 'financial') {
                await loadFinancialData();
            } else if (activeTab === 'party') {
                await loadPartyData();
            } else if (activeTab === 'calendar') {
                await loadCalendarData();
            }
        } catch (err) {
            console.error('Analytics error:', err);
            setError('Failed to load analytics data');
        } finally {
            setLoading(false);
        }
    };

    const loadInventoryData = async () => {
        const [overview, distribution, byQuality, lowStock] = await Promise.all([
            analyticsAPI.getInventoryOverview(),
            analyticsAPI.getInventoryBalanceDistribution(),
            analyticsAPI.getInventoryByQuality(),
            analyticsAPI.getInventoryLowStock(),
        ]);
        setInventoryOverview(overview.data);
        setBalanceDistribution(distribution.data);
        setStockByQuality(byQuality.data);
        setLowStockAlerts(lowStock.data);
    };

    const loadProductionData = async () => {
        const [overview, status, trend, highWastage, byQuality] = await Promise.all([
            analyticsAPI.getProductionOverview(),
            analyticsAPI.getProductionStatusBreakdown(),
            analyticsAPI.getProductionWastageTrend(),
            analyticsAPI.getProductionHighWastage(),
            analyticsAPI.getProductionByQuality(),
        ]);
        setProductionOverview(overview.data);
        setProductionStatus(status.data);
        setWastageTrend(trend.data);
        setHighWastagePrograms(highWastage.data);
        setProductionByQuality(byQuality.data);
    };

    const loadFinancialData = async () => {
        const [overview, trend, byQuality, bills] = await Promise.all([
            analyticsAPI.getFinancialOverview(),
            analyticsAPI.getFinancialRevenueTrend(),
            analyticsAPI.getFinancialByQuality(),
            analyticsAPI.getFinancialRecentBills(),
        ]);
        setFinancialOverview(overview.data);
        setRevenueTrend(trend.data);
        setRevenueByQuality(byQuality.data);
        setRecentBills(bills.data);
    };

    const loadPartyData = async () => {
        const [topPerformers, scorecard] = await Promise.all([
            analyticsAPI.getPartyTopPerformers(),
            analyticsAPI.getPartyPerformanceScorecard(),
        ]);
        setTopParties(topPerformers.data);
        setPartyScorecard(scorecard.data);
    };

    const loadCalendarData = async () => {
        const [programsRes, lotsRes, billsRes] = await Promise.all([
            programsAPI.getAll({ page_size: 100 }),
            inwardLotsAPI.getAll({ page_size: 100 }),
            billsAPI.getAll({ page_size: 100 })
        ]);
        setPrograms(programsRes.data.results || programsRes.data);
        setInwardLots(lotsRes.data.results || lotsRes.data);
        setBills(billsRes.data.results || billsRes.data);
    };

    const formatNumber = (num) => {
        return new Intl.NumberFormat('en-IN').format(num);
    };

    const formatCurrency = (num) => {
        return `₹${formatNumber(num)}`;
    };

    // Pagination helper
    const paginate = (items) => {
        if (!items) return [];
        const indexOfLastItem = currentPage * itemsPerPage;
        const indexOfFirstItem = indexOfLastItem - itemsPerPage;
        return items.slice(indexOfFirstItem, indexOfLastItem);
    };

    // Pagination Controls Component
    const PaginationControls = ({ totalItems }) => {
        const pageNumbers = [];
        for (let i = 1; i <= Math.ceil(totalItems / itemsPerPage); i++) {
            pageNumbers.push(i);
        }

        if (pageNumbers.length <= 1) return null;

        return (
            <div className="pagination">
                <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="page-btn"
                >
                    &lt;
                </button>
                {pageNumbers.map(number => (
                    <button
                        key={number}
                        onClick={() => setCurrentPage(number)}
                        className={`page-btn ${currentPage === number ? 'active' : ''}`}
                    >
                        {number}
                    </button>
                ))}
                <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, pageNumbers.length))}
                    disabled={currentPage === pageNumbers.length}
                    className="page-btn"
                >
                    &gt;
                </button>
            </div>
        );
    };

    // KPI Card Component
    const KPICard = ({ title, value, subtitle, color = '#1e3a8a' }) => (
        <div className="kpi-card" style={{ borderLeftColor: color }}>
            <div className="kpi-title">{title}</div>
            <div className="kpi-value">{value}</div>
            {subtitle && <div className="kpi-subtitle">{subtitle}</div>}
        </div>
    );

    return (
        <div className={`page-with-sidebar ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
            <Sidebar activePage="dashboard" sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

            <div className="main-content-area analytics-dashboard">
                <div className="analytics-header">
                    <div className="header-left">
                        <div className="header-icon">
                            <Icons.Chart size={24} />
                        </div>
                        <h1>Dashboard</h1>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button className="btn btn-refresh" onClick={loadData} disabled={loading}>
                            <Icons.Refresh size={16} /> Refresh
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

                {error && <div className="alert alert-error">{error}</div>}

                {/* Tab Navigation */}
                <div className="analytics-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'inventory' ? 'active' : ''}`}
                        onClick={() => setActiveTab('inventory')}
                    >
                        <Icons.Package size={20} /> Inventory
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'production' ? 'active' : ''}`}
                        onClick={() => setActiveTab('production')}
                    >
                        <Icons.Factory size={20} /> Production
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'financial' ? 'active' : ''}`}
                        onClick={() => setActiveTab('financial')}
                    >
                        <Icons.Billing size={20} /> Financial
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'party' ? 'active' : ''}`}
                        onClick={() => setActiveTab('party')}
                    >
                        <Icons.Party size={20} /> Party Performance
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'calendar' ? 'active' : ''}`}
                        onClick={() => setActiveTab('calendar')}
                    >
                        <Icons.Calendar size={20} /> Calendar View
                    </button>
                </div>

                {loading && <div className="loading-overlay">Loading analytics...</div>}

                {/* Inventory Tab */}
                {activeTab === 'inventory' && inventoryOverview && (
                    <div className="analytics-content">
                        {/* KPI Cards */}
                        <div className="kpi-grid">
                            <KPICard
                                title="Total Stock"
                                value={`${formatNumber(inventoryOverview.total_meters)} m`}
                                subtitle={`${inventoryOverview.total_lots} lots`}
                                color="#374151"
                            />
                            <KPICard
                                title="Available"
                                value={`${formatNumber(inventoryOverview.available_meters)} m`}
                                subtitle="Ready for allocation"
                                color="#065f46"
                            />
                            <KPICard
                                title="Allocated"
                                value={`${formatNumber(inventoryOverview.allocated_meters)} m`}
                                subtitle="In production"
                                color="#6b7280"
                            />
                            <KPICard
                                title="Low Stock Alerts"
                                value={inventoryOverview.low_stock_count}
                                subtitle="Lots below 20%"
                                color="#7f1d1d"
                            />
                        </div>

                        {/* Charts Row */}
                        <div className="charts-row">
                            {/* Balance Distribution */}
                            <div className="chart-card">
                                <h3>Balance Distribution</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={balanceDistribution}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                            outerRadius={80}
                                            fill="#374151"
                                            dataKey="value"
                                        >
                                            {balanceDistribution.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Stock by Quality */}
                            <div className="chart-card">
                                <h3>Stock by Quality Type</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={stockByQuality}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="quality_name" />
                                        <YAxis />
                                        <Tooltip formatter={(value) => `${formatNumber(value)} m`} />
                                        <Legend />
                                        <Bar dataKey="total_meters" fill="#374151" name="Total" />
                                        <Bar dataKey="available_meters" fill="#065f46" name="Available" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Low Stock Table */}
                        <div className="table-card">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Icons.AlertCircle size={20} style={{ color: 'var(--status-danger)' }} /> Critical Low Stock Alerts</h3>
                            <div className="table-scroll">
                                <table className="analytics-table">
                                    <thead>
                                        <tr>
                                            <th>Lot Number</th>
                                            <th>Party</th>
                                            <th>Quality</th>
                                            <th>Total (m)</th>
                                            <th>Balance (m)</th>
                                            <th>Balance %</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lowStockAlerts.length === 0 ? (
                                            <tr><td colSpan="6" className="text-center">No low stock alerts</td></tr>
                                        ) : (
                                            paginate(lowStockAlerts).map((lot, idx) => (
                                                <tr key={idx}>
                                                    <td><strong>{lot.lot_number}</strong></td>
                                                    <td>{lot.party_name}</td>
                                                    <td>{lot.quality_name}</td>
                                                    <td>{formatNumber(lot.total_meters)}</td>
                                                    <td>{formatNumber(lot.current_balance)}</td>
                                                    <td>
                                                        <span className={`badge ${lot.balance_percentage < 10 ? 'badge-danger' : 'badge-warning'}`}>
                                                            {lot.balance_percentage.toFixed(1)}%
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <PaginationControls totalItems={lowStockAlerts.length} />
                        </div>
                    </div>
                )}

                {/* Production Tab */}
                {activeTab === 'production' && productionOverview && (
                    <div className="analytics-content">
                        {/* KPI Cards */}
                        <div className="kpi-grid">
                            <KPICard
                                title="Total Programs"
                                value={productionOverview.total_programs}
                                subtitle={`${productionOverview.completed_programs} completed`}
                                color="#374151"
                            />
                            <KPICard
                                title="Efficiency"
                                value={`${productionOverview.avg_efficiency}%`}
                                subtitle="Average output rate"
                                color="#065f46"
                            />
                            <KPICard
                                title="Wastage"
                                value={`${productionOverview.avg_wastage}%`}
                                subtitle={`${formatNumber(productionOverview.total_wastage)} m total`}
                                color="#7f1d1d"
                            />
                            <KPICard
                                title="Total Output"
                                value={`${formatNumber(productionOverview.total_output)} m`}
                                subtitle="Finished production"
                                color="#6b7280"
                            />
                        </div>

                        {/* Charts Row */}
                        <div className="charts-row">
                            {/* Wastage Trend */}
                            <div className="chart-card chart-full">
                                <h3>Wastage Trend (Last 12 Months)</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <LineChart data={wastageTrend}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="month" />
                                        <YAxis label={{ value: 'Wastage %', angle: -90, position: 'insideLeft' }} />
                                        <Tooltip />
                                        <Legend />
                                        <Line type="monotone" dataKey="wastage_percent" stroke="#7f1d1d" name="Wastage %" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Quality Performance */}
                        <div className="chart-card">
                            <h3>Performance by Quality Type</h3>
                            <div className="table-scroll">
                                <table className="analytics-table">
                                    <thead>
                                        <tr>
                                            <th>Quality</th>
                                            <th>Programs</th>
                                            <th>Input (m)</th>
                                            <th>Output (m)</th>
                                            <th>Wastage %</th>
                                            <th>Efficiency %</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {productionByQuality.map((item, idx) => (
                                            <tr key={idx}>
                                                <td><strong>{item.quality_name}</strong></td>
                                                <td>{item.program_count}</td>
                                                <td>{formatNumber(item.total_input)}</td>
                                                <td>{formatNumber(item.total_output)}</td>
                                                <td>
                                                    <span className={`badge ${item.wastage_percentage > 15 ? 'badge-danger' : 'badge-success'}`}>
                                                        {item.wastage_percentage}%
                                                    </span>
                                                </td>
                                                <td>{item.efficiency_percentage}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* High Wastage Programs */}
                        <div className="table-card">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Icons.AlertTriangle size={20} style={{ color: 'var(--status-warning)' }} /> Top High Wastage Programs</h3>
                            <div className="table-scroll">
                                <table className="analytics-table">
                                    <thead>
                                        <tr>
                                            <th>Program</th>
                                            <th>Design</th>
                                            <th>Input (m)</th>
                                            <th>Output (m)</th>
                                            <th>Wastage (m)</th>
                                            <th>Wastage %</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginate(highWastagePrograms).map((prog, idx) => (
                                            <tr key={idx}>
                                                <td><strong>{prog.program_number}</strong></td>
                                                <td>{prog.design_number}</td>
                                                <td>{formatNumber(prog.input_meters)}</td>
                                                <td>{formatNumber(prog.output_meters)}</td>
                                                <td>{formatNumber(prog.wastage_meters)}</td>
                                                <td>
                                                    <span className="badge badge-danger">
                                                        {prog.wastage_percentage.toFixed(1)}%
                                                    </span>
                                                </td>
                                                <td>{prog.status}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <PaginationControls totalItems={highWastagePrograms.length} />
                        </div>
                    </div>
                )}

                {/* Financial Tab */}
                {activeTab === 'financial' && financialOverview && (
                    <div className="analytics-content">
                        {/* KPI Cards */}
                        <div className="kpi-grid">
                            <KPICard
                                title="Total Revenue"
                                value={formatCurrency(financialOverview.total_revenue)}
                                subtitle={`${financialOverview.total_bills} bills`}
                                color="#065f46"
                            />
                            <KPICard
                                title="Average Bill"
                                value={formatCurrency(financialOverview.avg_bill_value)}
                                subtitle="Per invoice"
                                color="#374151"
                            />
                            <KPICard
                                title="Outstanding Programs"
                                value={financialOverview.outstanding_programs}
                                subtitle="Completed, not billed"
                                color="#78350f"
                            />
                            <KPICard
                                title="Bills Count"
                                value={financialOverview.total_bills}
                                subtitle="Total invoices"
                                color="#6b7280"
                            />
                        </div>

                        {/* Charts Row */}
                        <div className="charts-row">
                            {/* Revenue Trend */}
                            <div className="chart-card chart-full">
                                <h3>Revenue Trend (Last 12 Months)</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <AreaChart data={revenueTrend}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="month" />
                                        <YAxis tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} />
                                        <Tooltip formatter={(value) => formatCurrency(value)} />
                                        <Legend />
                                        <Area type="monotone" dataKey="total_revenue" stroke="#374151" fill="#374151" name="Revenue" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="charts-row">
                            {/* Revenue by Quality */}
                            <div className="chart-card">
                                <h3>Revenue by Quality Type</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={revenueByQuality}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ quality_name, percent }) => `${quality_name}: ${(percent * 100).toFixed(0)}%`}
                                            outerRadius={80}
                                            fill="#374151"
                                            dataKey="total_revenue"
                                            nameKey="quality_name"
                                        >
                                            {revenueByQuality.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value) => formatCurrency(value)} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Recent Bills Table */}
                            <div className="chart-card">
                                <h3>Recent Bills</h3>
                                <div className="table-scroll" style={{ maxHeight: '300px' }}>
                                    <table className="analytics-table">
                                        <thead>
                                            <tr>
                                                <th>Bill Number</th>
                                                <th>Party</th>
                                                <th>Date</th>
                                                <th>Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paginate(recentBills).map((bill, idx) => (
                                                <tr key={idx}>
                                                    <td><strong>{bill.bill_number}</strong></td>
                                                    <td>{bill.party_name}</td>
                                                    <td>{new Date(bill.bill_date).toLocaleDateString()}</td>
                                                    <td>{formatCurrency(bill.grand_total)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <PaginationControls totalItems={recentBills.length} />
                            </div>
                        </div>
                    </div>
                )}

                {/* Party Performance Tab */}
                {activeTab === 'party' && (
                    <div className="analytics-content">
                        {/* Top Parties Chart */}
                        <div className="chart-card chart-full">
                            <h3>Top 10 Parties by Revenue</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={topParties} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} />
                                    <YAxis dataKey="party_name" type="category" width={150} />
                                    <Tooltip formatter={(value) => formatCurrency(value)} />
                                    <Bar dataKey="total_revenue" fill="#374151" name="Revenue" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Party Scorecard */}
                        <div className="table-card">
                            <h3>Party Performance Scorecard</h3>
                            <div className="table-scroll">
                                <table className="analytics-table">
                                    <thead>
                                        <tr>
                                            <th>Party Name</th>
                                            <th>Contact</th>
                                            <th>Active Lots</th>
                                            <th>Programs (30d)</th>
                                            <th>Revenue (30d)</th>
                                            <th>Avg Wastage %</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginate(partyScorecard).map((party, idx) => (
                                            <tr key={idx}>
                                                <td><strong>{party.party_name}</strong></td>
                                                <td>{party.contact}</td>
                                                <td>{party.active_lots}</td>
                                                <td>{party.programs_30d}</td>
                                                <td>{formatCurrency(party.revenue_30d)}</td>
                                                <td>{party.avg_wastage}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <PaginationControls totalItems={partyScorecard.length} />
                        </div>
                    </div>
                )}

                {/* Calendar View Tab */}
                {activeTab === 'calendar' && (
                    <div className="analytics-content">
                        <CalendarView programs={programs} inwardLots={inwardLots} bills={bills} />
                    </div>
                )}

                {/* Notification Center */}
                <NotificationCenter
                    isOpen={showNotifications}
                    onClose={() => setShowNotifications(false)}
                />
            </div>
        </div>
    );
};

export default AnalyticsDashboard;
