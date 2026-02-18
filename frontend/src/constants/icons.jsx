/**
 * CENTRALIZED ICON SYSTEM
 * Using Feather Icons from react-icons/fi for professional, consistent appearance
 *
 * All icons are SVG-based for:
 * - Consistent rendering across all platforms/browsers
 * - Scalable without quality loss
 * - Professional appearance
 * - No OS-dependent emoji rendering issues
 */

import {
  FiPackage,
  FiSettings,
  FiSliders,
  FiDollarSign,
  FiUsers,
  FiCamera,
  FiFileText,
  FiBarChart2,
  FiUser,
  FiDownload,
  FiArrowUp,
  FiArrowDown,
  FiMinus,
  FiLogOut,
  FiMenu,
  FiX,
  FiRefreshCw,
  FiCheck,
  FiAlertCircle,
  FiAlertTriangle,
  FiInfo,
  FiHome,
  FiEdit,
  FiTrash2,
  FiEye,
  FiEyeOff,
  FiPlus,
  FiFilter,
  FiSearch,
  FiCalendar,
  FiClock,
  FiTrendingUp,
  FiTrendingDown,
  FiUpload,
  FiSave,
  FiPrinter,
  FiShare2,
  FiLink,
  FiExternalLink,
  FiChevronLeft,
  FiChevronRight,
  FiChevronUp,
  FiChevronDown,
  FiMoreVertical,
  FiMoreHorizontal,
  FiBell
} from 'react-icons/fi';

/**
 * Icon mapping object for easy imports
 * Usage: import { Icons } from '../constants/icons';
 *        <Icons.Package size={20} />
 */
export const Icons = {
  // Business Domain Icons
  Package: FiPackage,           // Inventory, inward lots, stock
  Factory: FiSettings,          // Production, processing, programs
  Billing: FiDollarSign,        // Money, invoices, payments
  Party: FiUsers,               // Customers, suppliers, parties
  Camera: FiCamera,             // Photo capture, design images
  Document: FiFileText,         // Bills, documents, reports
  Chart: FiBarChart2,           // Analytics, statistics, graphs
  User: FiUser,                 // User profile, account
  Settings: FiSliders,          // Settings, configuration

  // Action Icons
  Download: FiDownload,         // Download, export
  Upload: FiUpload,             // Upload, import
  Save: FiSave,                 // Save, store
  Print: FiPrinter,             // Print documents
  Edit: FiEdit,                 // Edit, modify
  Delete: FiTrash2,             // Delete, remove
  Add: FiPlus,                  // Add new, create
  Remove: FiMinus,              // Remove, subtract
  Refresh: FiRefreshCw,         // Refresh, reload
  Check: FiCheck,               // Confirm, success
  Close: FiX,                   // Close, cancel

  // Sorting Icons
  SortUp: FiArrowUp,            // Ascending sort
  SortDown: FiArrowDown,        // Descending sort
  SortNeutral: FiMinus,         // Neutral/unsorted state

  // Navigation Icons
  Home: FiHome,                 // Home, dashboard
  Menu: FiMenu,                 // Menu toggle
  Logout: FiLogOut,             // Logout, sign out
  ChevronLeft: FiChevronLeft,   // Previous, back
  ChevronRight: FiChevronRight, // Next, forward
  ChevronUp: FiChevronUp,       // Collapse, up
  ChevronDown: FiChevronDown,   // Expand, down

  // Status Icons
  AlertCircle: FiAlertCircle,   // Error, critical alert
  AlertTriangle: FiAlertTriangle, // Warning
  Info: FiInfo,                 // Information
  Bell: FiBell,                 // Notifications, alerts

  // Utility Icons
  Search: FiSearch,             // Search, find
  Filter: FiFilter,             // Filter, refine
  Calendar: FiCalendar,         // Date picker, calendar
  Clock: FiClock,               // Time, duration
  Eye: FiEye,                   // View, show
  EyeOff: FiEyeOff,             // Hide, conceal
  Share: FiShare2,              // Share, export
  Link: FiLink,                 // Link, connection
  ExternalLink: FiExternalLink, // Open in new tab
  TrendingUp: FiTrendingUp,     // Increase, growth
  TrendingDown: FiTrendingDown, // Decrease, decline
  MoreVertical: FiMoreVertical, // More options (vertical)
  MoreHorizontal: FiMoreHorizontal, // More options (horizontal)
};

/**
 * Default icon sizes for consistency
 */
export const IconSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24
};

/**
 * Helper function to render icon with consistent sizing
 * @param {Component} Icon - Icon component from Icons object
 * @param {string} size - Size key from IconSizes (default: 'md')
 * @param {string} className - Additional CSS classes
 * @returns {JSX.Element}
 */
export const renderIcon = (Icon, size = 'md', className = '') => {
  return <Icon size={IconSizes[size]} className={className} />;
};

export default Icons;
