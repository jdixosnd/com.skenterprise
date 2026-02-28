import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Icons } from '../constants/icons';
import { fiscalYearResetAPI } from '../services/api';
import '../styles/Sidebar.css';

const Sidebar = ({ activePage, sidebarOpen, setSidebarOpen }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [resetStatus, setResetStatus] = useState(null);

    useEffect(() => {
        if (!user?.is_admin) return;
        fiscalYearResetAPI.getStatus()
            .then(res => setResetStatus(res.data))
            .catch(() => {});
    }, [user?.is_admin]);

    // Auto-collapse sidebar on mobile only during resize, not on mount
    // This prevents hiding the sidebar when user has it open
    useEffect(() => {
        let isInitialMount = true;

        const handleResize = () => {
            // Skip auto-collapse on initial mount to respect saved state
            if (isInitialMount) {
                isInitialMount = false;
                return;
            }

            // Only auto-collapse when actively resizing to mobile size
            if (window.innerWidth < 768 && sidebarOpen) {
                setSidebarOpen(false);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [setSidebarOpen, sidebarOpen]);

    const menuItems = [
        { id: 'dashboard', path: '/analytics', icon: <Icons.Chart size={24} />, label: 'Dashboard', description: 'Analytics & Insights', isRoute: true },
        { id: 'party-overview', path: '/party-overview', icon: <Icons.Party size={24} />, label: 'Party Balance', description: 'Material overview by party', isRoute: true },
        { id: 'inward', icon: <Icons.Download size={24} />, label: 'Grey-In', description: 'Grey fabric inward entries', isRoute: false },
        { id: 'program', icon: <Icons.Package size={24} />, label: 'Program Entry', description: 'Processing jobs', isRoute: false },
        { id: 'billing', icon: <Icons.Billing size={24} />, label: 'Billing', description: 'Bills & Reports', isRoute: false },
        { id: 'bills-history', path: '/bills-history', icon: <Icons.Document size={24} />, label: 'Bills History', description: 'View All Bills', isRoute: true },
        { id: 'settings', icon: <Icons.Factory size={24} />, label: 'Settings', description: 'Parties & Quality Types', isRoute: false },
    ];

    const handleMenuClick = (item) => {
        if (item.isRoute) {
            navigate(item.path);
        } else {
            // For non-route items, navigate to main dashboard with section state
            navigate('/', { state: { section: item.id } });
        }
    };

    return (
        <>
            {/* Mobile hamburger menu button - always visible */}
            {!sidebarOpen && (
                <button
                    className="mobile-hamburger"
                    onClick={() => setSidebarOpen(true)}
                    title="Open Menu"
                    aria-label="Open Menu"
                >
                    <Icons.Menu size={24} />
                </button>
            )}

            {/* Mobile overlay backdrop */}
            {sidebarOpen && window.innerWidth < 768 && (
                <div
                    className="sidebar-overlay"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
                <div className="sidebar-header">
                <div className="logo-container">
                    <img src={`/logo.png?v=${Date.now()}`} alt="Textile Inventory" className="sidebar-logo" />
                </div>
                <button
                    className="sidebar-toggle"
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    title={sidebarOpen ? 'Collapse' : 'Expand'}
                >
                    {sidebarOpen ? <Icons.ChevronLeft size={16} /> : <Icons.ChevronRight size={16} />}
                </button>
            </div>

            <nav className="sidebar-nav">
                {menuItems.map((item) => (
                    <button
                        key={item.id}
                        className={`nav-item ${activePage === item.id ? 'active' : ''}`}
                        onClick={() => handleMenuClick(item)}
                    >
                        <span className="nav-icon">{item.icon}</span>
                        {sidebarOpen && (
                            <div className="nav-content">
                                <span className="nav-label">{item.label}</span>
                                <span className="nav-description">{item.description}</span>
                            </div>
                        )}
                    </button>
                ))}

                {user?.is_admin && (
                    <button
                        className={`nav-item fiscal-reset-item
                            ${activePage === 'fiscal-year-reset' ? 'active' : ''}
                            ${resetStatus?.reset_pending ? 'reset-pending' : ''}
                            ${!resetStatus?.is_reset_month ? 'reset-disabled' : ''}`}
                        onClick={() => resetStatus?.is_reset_month && navigate('/fiscal-year-reset')}
                        disabled={!resetStatus?.is_reset_month}
                        title={
                            !resetStatus?.is_reset_month
                                ? `Fiscal Year Reset (available in month ${resetStatus?.fiscal_year_start_month})`
                                : resetStatus?.reset_pending
                                    ? 'Fiscal Year Reset — Action Required'
                                    : 'Fiscal Year Reset — Done'
                        }
                    >
                        <span className="nav-icon">
                            <Icons.Refresh size={24} />
                            {resetStatus?.reset_pending && <span className="reset-badge" />}
                        </span>
                        {sidebarOpen && (
                            <div className="nav-content">
                                <span className="nav-label">
                                    FY Reset
                                    {resetStatus?.reset_pending && ' ⚠'}
                                </span>
                                <span className="nav-description">
                                    {!resetStatus?.is_reset_month
                                        ? 'Not available yet'
                                        : resetStatus?.reset_pending
                                            ? 'Action required'
                                            : `Done — FY ${resetStatus?.current_fiscal_year}`}
                                </span>
                            </div>
                        )}
                    </button>
                )}
            </nav>

            <div className="sidebar-footer">
                <div className="user-info">
                    <span className="user-icon"><Icons.User size={20} /></span>
                    {sidebarOpen && (
                        <span className="user-name">{user?.username || 'User'}</span>
                    )}
                </div>
                <button onClick={logout} className="btn-logout" title="Logout">
                    <Icons.Logout size={16} />
                    {sidebarOpen && <span>Logout</span>}
                </button>
            </div>
        </aside>
        </>
    );
};

export default Sidebar;
