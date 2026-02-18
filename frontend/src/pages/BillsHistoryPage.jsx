import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import { billsAPI, partiesAPI, notificationsAPI } from '../services/api';
import BillDetailModal from '../components/BillDetailModal';
import NotificationCenter from '../components/NotificationCenter';
import { format } from 'date-fns';
import { sortData, toggleSortDirection } from '../utils/sortUtils';
import { Icons } from '../constants/icons';
import '../styles/theme.css';
import '../styles/BillsHistory.css';

const BillsHistoryPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // Check localStorage for sidebar state
    const saved = localStorage.getItem('sidebarOpen');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [bills, setBills] = useState([]);
  const [parties, setParties] = useState([]);
  const [filters, setFilters] = useState({
    party: '',
    start_date: '',
    end_date: '',
    search: '',
    payment_status: ''
  });
  const [selectedBill, setSelectedBill] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Sort state
  const [sortKey, setSortKey] = useState('bill_number');
  const [sortDirection, setSortDirection] = useState('desc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Notification states
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadParties();
  }, []);

  useEffect(() => {
    loadBills();
  }, [filters]);

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

  const loadParties = async () => {
    try {
      const response = await partiesAPI.getAll();
      setParties(response.data.results || response.data);
    } catch (err) {
      console.error('Failed to load parties:', err);
    }
  };

  const loadBills = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filters.party) params.party = filters.party;
      if (filters.start_date) params.bill_date__gte = filters.start_date;
      if (filters.end_date) params.bill_date__lte = filters.end_date;
      if (filters.search) params.search = filters.search;
      if (filters.payment_status) params.payment_status = filters.payment_status;

      const response = await billsAPI.getAll(params);
      setBills(response.data.results || response.data);
      setCurrentPage(1); // Reset to first page on filter change
    } catch (err) {
      setError('Failed to load bills');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (billId, billNumber) => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await billsAPI.getPDF(billId);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${billNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setSuccess(`Downloaded ${billNumber}.pdf`);
    } catch (err) {
      setError('Failed to download PDF');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (billId) => {
    setLoading(true);
    setError('');
    try {
      const response = await billsAPI.getOne(billId);
      setSelectedBill(response.data);
    } catch (err) {
      setError('Failed to load bill details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkSent = async (billId) => {
    if (!confirm('Mark this bill as Sent to party?')) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await billsAPI.markSent(billId);
      setSuccess('Bill marked as Sent');
      loadBills();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update bill status');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPaid = async (billId) => {
    if (!confirm('Mark this bill as Paid?')) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await billsAPI.markPaid(billId);
      setSuccess('Bill marked as Paid');
      loadBills();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update bill status');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkScrap = async (billId) => {
    if (!confirm('Mark this bill as Scrap? This will free up programs for reuse.')) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await billsAPI.markScrap(billId);
      setSuccess('Bill marked as Scrap');
      loadBills();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update bill status');
    } finally {
      setLoading(false);
    }
  };

  // Sort handler
  const handleSort = (key) => {
    const newDirection = toggleSortDirection(sortKey, key, sortDirection);
    setSortKey(key);
    setSortDirection(newDirection);
    const sorted = sortData(bills, key, newDirection);
    setBills(sorted);
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

  // Render sort icon based on current sort state
  const renderSortIcon = (columnKey) => {
    if (columnKey !== sortKey) {
      return <Icons.SortNeutral className="sort-icon" size={14} />;
    }
    return sortDirection === 'asc' ?
      <Icons.SortUp className="sort-icon active" size={14} /> :
      <Icons.SortDown className="sort-icon active" size={14} />;
  };

  const clearFilters = () => {
    setFilters({
      party: '',
      start_date: '',
      end_date: '',
      search: '',
      payment_status: ''
    });
  };

  const getStatusBadgeStyle = (status) => {
    const styles = {
      Draft: { bg: '#6c757d', color: 'white' },
      Sent: { bg: '#007bff', color: 'white' },
      Paid: { bg: '#28a745', color: 'white' },
      Outstanding: { bg: '#dc3545', color: 'white' },
      Scrap: { bg: '#6c757d', color: 'white', opacity: 0.6 }
    };
    return styles[status] || styles.Draft;
  };

  const renderStatusBadge = (status) => {
    const style = getStatusBadgeStyle(status);
    return (
      <span style={{
        backgroundColor: style.bg,
        color: style.color,
        padding: '3px 8px',
        borderRadius: '3px',
        fontSize: '11px',
        fontWeight: 'bold',
        opacity: style.opacity || 1
      }}>
        {status === 'Outstanding' && '⚠️ '}
        {status}
      </span>
    );
  };

  const getRowStyle = (bill) => {
    if (bill.payment_status === 'Outstanding') {
      return { backgroundColor: '#fff3cd' };
    } else if (bill.payment_status === 'Scrap') {
      return { backgroundColor: '#f8f9fa', opacity: 0.7 };
    }
    return {};
  };

  const paginatedBills = paginate(bills);

  // Mobile Card Component
  const BillCard = ({ bill }) => (
    <div className="data-card" style={getRowStyle(bill)}>
      <div className="data-card-row">
        <span className="data-card-label">Bill Number</span>
        <strong className="data-card-value">{bill.bill_number}</strong>
      </div>
      <div className="data-card-row">
        <span className="data-card-label">Party</span>
        <span className="data-card-value">{bill.party_name}</span>
      </div>
      <div className="data-card-row">
        <span className="data-card-label">Bill Date</span>
        <span className="data-card-value">{format(new Date(bill.bill_date), 'dd MMM yyyy')}</span>
      </div>
      <div className="data-card-row">
        <span className="data-card-label">Payment Status</span>
        <span className="data-card-value">{renderStatusBadge(bill.payment_status)}</span>
      </div>
      {bill.sent_date && (
        <div className="data-card-row">
          <span className="data-card-label">Sent Date</span>
          <span className="data-card-value">
            {format(new Date(bill.sent_date), 'dd MMM yyyy')}
            <br />
            <small style={{ color: '#6c757d' }}>{bill.days_since_sent} days ago</small>
          </span>
        </div>
      )}
      <div className="data-card-row">
        <span className="data-card-label">Programs</span>
        <span className="data-card-value">{bill.program_count}</span>
      </div>
      <div className="data-card-row">
        <span className="data-card-label">Grand Total</span>
        <strong className="data-card-value">₹{parseFloat(bill.grand_total).toFixed(2)}</strong>
      </div>
      <div className="data-card-actions">
        {bill.payment_status === 'Draft' && (
          <button
            onClick={() => handleMarkSent(bill.id)}
            className="btn btn-sm btn-success"
            disabled={loading}
          >
            Send
          </button>
        )}
        {(bill.payment_status === 'Sent' || bill.payment_status === 'Outstanding') && (
          <button
            onClick={() => handleMarkPaid(bill.id)}
            className="btn btn-sm btn-success"
            disabled={loading}
          >
            Paid
          </button>
        )}
        {bill.payment_status !== 'Paid' && bill.payment_status !== 'Scrap' && (
          <button
            onClick={() => handleMarkScrap(bill.id)}
            className="btn btn-sm btn-warning"
            disabled={loading}
          >
            Scrap
          </button>
        )}
        <button
          onClick={() => handleViewDetails(bill.id)}
          className="btn btn-sm btn-secondary"
          disabled={loading}
        >
          View Details
        </button>
        <button
          onClick={() => handleDownloadPDF(bill.id, bill.bill_number)}
          className="btn btn-sm btn-primary"
          disabled={loading}
        >
          <Icons.Download size={16} /> PDF
        </button>
      </div>
    </div>
  );

  return (
    <div className={`page-with-sidebar ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      <Sidebar activePage="bills-history" sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="main-content-area bills-history-container">
        <div className="analytics-header">
          <div className="header-left">
            <div className="header-icon">
              <Icons.Document size={24} />
            </div>
            <h1>Bills History</h1>
          </div>
          <div className="header-actions">
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

        {success && (
          <div className="alert alert-success">
            {success}
            <button onClick={() => setSuccess('')} className="alert-close">×</button>
          </div>
        )}

        {/* Filters Card */}
        <div className="card filters-card">
          <h3 className="card-title">Search & Filter</h3>
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
              <label>From Date</label>
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                disabled={loading}
              />
            </div>

            <div className="filter-group">
              <label>To Date</label>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                disabled={loading}
              />
            </div>

            <div className="filter-group">
              <label>Search Bill Number</label>
              <input
                type="text"
                placeholder="BILL-2026-0001"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                disabled={loading}
              />
            </div>

            <div className="filter-group">
              <label>Payment Status</label>
              <select
                value={filters.payment_status}
                onChange={(e) => setFilters({ ...filters, payment_status: e.target.value })}
                disabled={loading}
              >
                <option value="">All Statuses</option>
                <option value="Draft">Draft</option>
                <option value="Sent">Sent</option>
                <option value="Paid">Paid</option>
                <option value="Outstanding">Outstanding</option>
                <option value="Scrap">Scrap</option>
              </select>
            </div>

            <div className="filter-group">
              <label>&nbsp;</label>
              <button onClick={clearFilters} className="btn btn-secondary" disabled={loading}>
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Bills Table & Card View */}
        <div className="card bills-table-card">
          <h3 className="card-title">
            Bills ({bills.length})
          </h3>

          {/* Desktop Table View */}
          <div className="table-container table-responsive">
            <table className="data-table bills-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('bill_number')} className="sortable-header">
                    Bill Number {renderSortIcon('bill_number')}
                  </th>
                  <th onClick={() => handleSort('party_name')} className="sortable-header">
                    Party {renderSortIcon('party_name')}
                  </th>
                  <th onClick={() => handleSort('bill_date')} className="sortable-header">
                    Bill Date {renderSortIcon('bill_date')}
                  </th>
                  <th onClick={() => handleSort('payment_status')} className="sortable-header">
                    Status {renderSortIcon('payment_status')}
                  </th>
                  <th onClick={() => handleSort('sent_date')} className="sortable-header">
                    Sent Date {renderSortIcon('sent_date')}
                  </th>
                  <th onClick={() => handleSort('program_count')} className="sortable-header">
                    Programs {renderSortIcon('program_count')}
                  </th>
                  <th onClick={() => handleSort('grand_total')} className="sortable-header">
                    Grand Total {renderSortIcon('grand_total')}
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && bills.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center">
                      Loading bills...
                    </td>
                  </tr>
                ) : bills.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center empty-state">
                      No bills found. Try adjusting your filters or generate new bills from the Billing section.
                    </td>
                  </tr>
                ) : (
                  paginatedBills.map(bill => (
                    <tr key={bill.id} style={getRowStyle(bill)}>
                      <td><strong>{bill.bill_number}</strong></td>
                      <td>{bill.party_name}</td>
                      <td>{format(new Date(bill.bill_date), 'dd MMM yyyy')}</td>
                      <td>{renderStatusBadge(bill.payment_status)}</td>
                      <td>
                        {bill.sent_date ? (
                          <>
                            {format(new Date(bill.sent_date), 'dd MMM yyyy')}
                            <br />
                            <small style={{ color: '#6c757d' }}>{bill.days_since_sent} days ago</small>
                          </>
                        ) : '-'}
                      </td>
                      <td className="text-center">{bill.program_count}</td>
                      <td><strong>₹{parseFloat(bill.grand_total).toFixed(2)}</strong></td>
                      <td>
                        <div className="action-buttons" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {bill.payment_status === 'Draft' && (
                            <button
                              onClick={() => handleMarkSent(bill.id)}
                              className="btn btn-sm btn-success"
                              disabled={loading}
                              title="Mark as Sent"
                            >
                              Send
                            </button>
                          )}
                          {(bill.payment_status === 'Sent' || bill.payment_status === 'Outstanding') && (
                            <button
                              onClick={() => handleMarkPaid(bill.id)}
                              className="btn btn-sm btn-success"
                              disabled={loading}
                              title="Mark as Paid"
                            >
                              Paid
                            </button>
                          )}
                          {bill.payment_status !== 'Paid' && bill.payment_status !== 'Scrap' && (
                            <button
                              onClick={() => handleMarkScrap(bill.id)}
                              className="btn btn-sm btn-warning"
                              disabled={loading}
                              title="Mark as Scrap"
                            >
                              Scrap
                            </button>
                          )}
                          <button
                            onClick={() => handleViewDetails(bill.id)}
                            className="btn btn-sm btn-secondary"
                            disabled={loading}
                            title="View Details"
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleDownloadPDF(bill.id, bill.bill_number)}
                            className="btn btn-sm btn-primary"
                            disabled={loading}
                            title="Download PDF"
                          >
                            <Icons.Download size={16} /> PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="card-view">
            {loading && bills.length === 0 ? (
              <div className="text-center" style={{ padding: '2rem' }}>
                Loading bills...
              </div>
            ) : bills.length === 0 ? (
              <div className="text-center empty-state" style={{ padding: '2rem' }}>
                No bills found. Try adjusting your filters or generate new bills from the Billing section.
              </div>
            ) : (
              paginatedBills.map(bill => (
                <BillCard key={bill.id} bill={bill} />
              ))
            )}
          </div>

          <PaginationControls totalItems={bills.length} />
        </div>

        {/* Bill Detail Modal */}
        {selectedBill && (
          <BillDetailModal
            bill={selectedBill}
            onClose={() => setSelectedBill(null)}
            onDownloadPDF={handleDownloadPDF}
          />
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

export default BillsHistoryPage;
