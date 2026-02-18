import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Icons } from '../constants/icons';
import '../styles/Sidebar.css';

const Sidebar = ({ activePage, sidebarOpen, setSidebarOpen }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

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
        { id: 'inward', icon: <Icons.Download size={24} />, label: 'Inward Log', description: 'Record incoming stock', isRoute: false },
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
