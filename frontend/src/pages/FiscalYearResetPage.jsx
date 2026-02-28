import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import NotificationCenter from '../components/NotificationCenter';
import { fiscalYearResetAPI, notificationsAPI } from '../services/api';
import { Icons } from '../constants/icons';
import '../styles/theme.css';

const MONTH_NAMES = [
    '', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const FiscalYearResetPage = () => {
    const { user } = useAuth();

    const [sidebarOpen, setSidebarOpen] = useState(() => {
        const saved = localStorage.getItem('sidebarOpen');
        return saved !== null ? JSON.parse(saved) : true;
    });

    const [resetStatus, setResetStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [applying, setApplying] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [error, setError] = useState('');

    const [showNotifications, setShowNotifications] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        localStorage.setItem('sidebarOpen', JSON.stringify(sidebarOpen));
    }, [sidebarOpen]);

    useEffect(() => {
        loadStatus();
        loadUnreadCount();
    }, []);

    const loadStatus = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fiscalYearResetAPI.getStatus();
            setResetStatus(res.data);
        } catch (err) {
            setError('Failed to load fiscal year reset status.');
        } finally {
            setLoading(false);
        }
    };

    const loadUnreadCount = async () => {
        try {
            const res = await notificationsAPI.getUnreadCount();
            setUnreadCount(res.data.count || 0);
        } catch {
            // ignore
        }
    };

    const handleApplyReset = async () => {
        setApplying(true);
        setError('');
        setSuccessMessage('');
        try {
            const res = await fiscalYearResetAPI.apply();
            setSuccessMessage(res.data.message);
            setShowConfirm(false);
            await loadStatus();
        } catch (err) {
            const msg = err.response?.data?.error || 'Failed to apply fiscal year reset.';
            setError(msg);
            setShowConfirm(false);
        } finally {
            setApplying(false);
        }
    };

    const statusLabel = () => {
        if (!resetStatus) return null;
        if (!resetStatus.is_reset_month) {
            return (
                <span style={{ color: '#6b7280' }}>
                    Not available (opens in {MONTH_NAMES[resetStatus.fiscal_year_start_month]})
                </span>
            );
        }
        if (resetStatus.reset_pending) {
            return <span style={{ color: '#d97706', fontWeight: 600 }}>⚠ Action Required</span>;
        }
        return (
            <span style={{ color: '#16a34a', fontWeight: 600 }}>
                ✓ Done — FY {resetStatus.current_fiscal_year}
            </span>
        );
    };

    return (
        <div className={`page-with-sidebar ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
            <Sidebar
                activePage="fiscal-year-reset"
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
            />

            <div className="main-content-area" style={{ padding: '2rem' }}>
                {/* Header */}
                <div className="analytics-header">
                    <div className="header-left">
                        <div className="header-icon">
                            <Icons.Refresh size={24} />
                        </div>
                        <div>
                            <h1>Fiscal Year Reset</h1>
                            <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem', fontWeight: 400 }}>
                                Reset lot and bill sequence counters for the new fiscal year
                            </p>
                        </div>
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

                {showNotifications && (
                    <NotificationCenter onClose={() => setShowNotifications(false)} />
                )}

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '48px', color: '#6b7280' }}>
                        Loading...
                    </div>
                ) : (
                    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                        {/* Status Card */}
                        <div className="card" style={{ marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                                <Icons.Refresh size={20} />
                                <h2 style={{ margin: 0, fontSize: '1.1rem' }}>
                                    {resetStatus?.reset_pending
                                        ? `⚠  Fiscal Year ${resetStatus?.current_fiscal_year} Sequence Reset`
                                        : `Fiscal Year ${resetStatus?.current_fiscal_year} Sequence Reset`}
                                </h2>
                            </div>

                            <div style={{ display: 'grid', rowGap: '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-light, #e5e7eb)' }}>
                                    <span style={{ color: '#6b7280' }}>Fiscal Year Start</span>
                                    <span style={{ fontWeight: 500 }}>
                                        {MONTH_NAMES[resetStatus?.fiscal_year_start_month]} (month {resetStatus?.fiscal_year_start_month})
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-light, #e5e7eb)' }}>
                                    <span style={{ color: '#6b7280' }}>Current Fiscal Year</span>
                                    <span style={{ fontWeight: 500 }}>{resetStatus?.current_fiscal_year}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-light, #e5e7eb)' }}>
                                    <span style={{ color: '#6b7280' }}>Last Reset</span>
                                    <span style={{ fontWeight: 500 }}>
                                        {resetStatus?.last_reset_year === 0
                                            ? 'Never'
                                            : `FY ${resetStatus?.last_reset_year}`}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                                    <span style={{ color: '#6b7280' }}>Status</span>
                                    <span>{statusLabel()}</span>
                                </div>
                            </div>

                            {resetStatus?.is_reset_month && resetStatus?.reset_pending && (
                                <div style={{
                                    marginTop: '16px',
                                    padding: '12px 16px',
                                    background: 'rgba(217, 119, 6, 0.1)',
                                    border: '1px solid #d97706',
                                    borderRadius: '6px',
                                    fontSize: '0.875rem',
                                    color: '#92400e'
                                }}>
                                    The fiscal year has started. Reset the sequence counters so new lots and bills
                                    begin at 001 / 0001 for FY {resetStatus?.current_fiscal_year}.
                                </div>
                            )}

                            {successMessage && (
                                <div style={{
                                    marginTop: '16px',
                                    padding: '12px 16px',
                                    background: 'rgba(22, 163, 74, 0.1)',
                                    border: '1px solid #16a34a',
                                    borderRadius: '6px',
                                    fontSize: '0.875rem',
                                    color: '#14532d'
                                }}>
                                    ✓ {successMessage}
                                </div>
                            )}

                            {error && (
                                <div style={{
                                    marginTop: '16px',
                                    padding: '12px 16px',
                                    background: 'rgba(220, 38, 38, 0.1)',
                                    border: '1px solid #dc2626',
                                    borderRadius: '6px',
                                    fontSize: '0.875rem',
                                    color: '#7f1d1d'
                                }}>
                                    {error}
                                </div>
                            )}

                            {resetStatus?.is_reset_month && (
                                <div style={{ marginTop: '20px' }}>
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => setShowConfirm(true)}
                                        disabled={!resetStatus?.reset_pending || applying}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            opacity: resetStatus?.reset_pending ? 1 : 0.5,
                                            cursor: resetStatus?.reset_pending ? 'pointer' : 'not-allowed',
                                        }}
                                    >
                                        <Icons.Refresh size={16} />
                                        {resetStatus?.reset_pending
                                            ? `Apply Reset for FY ${resetStatus?.current_fiscal_year}`
                                            : `Already applied for FY ${resetStatus?.current_fiscal_year}`}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Info Box */}
                        <div className="card" style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                            <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: '0.875rem' }}>What this does:</p>
                            <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: 1.7, fontSize: '0.875rem', color: '#374151' }}>
                                <li>Sets <code>LOT_SEQUENCE_START</code> to 1</li>
                                <li>Sets <code>BILL_SEQUENCE_START</code> to 1</li>
                                <li>Records <code>LAST_FISCAL_RESET_YEAR</code> = {resetStatus?.current_fiscal_year}</li>
                            </ul>
                            <p style={{ margin: '8px 0 0', color: '#6b7280', fontSize: '0.8125rem' }}>
                                New lots and bills created after the reset will start at sequence 001 / 0001.
                                Existing records are not affected — the year+month prefix in lot/bill numbers
                                prevents any duplicate IDs.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Confirmation Modal */}
            {showConfirm && (
                <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', padding: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                            <Icons.AlertTriangle size={22} color="#d97706" />
                            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Confirm Fiscal Year Reset</h3>
                        </div>
                        <p style={{ color: '#374151', margin: '0 0 24px', lineHeight: 1.5 }}>
                            Are you sure you want to reset the sequence for Fiscal Year{' '}
                            <strong>{resetStatus?.current_fiscal_year}</strong>?
                            This action cannot be undone.
                        </p>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowConfirm(false)}
                                disabled={applying}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleApplyReset}
                                disabled={applying}
                            >
                                {applying ? 'Applying...' : 'Confirm Reset'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FiscalYearResetPage;
