import { useState, useEffect } from 'react';
import Modal from './Modal';
import { inwardLotsAPI } from '../services/api';

const LedgerExportModal = ({ show, onClose, onExport, loading }) => {
    const currentYear = new Date().getFullYear();
    const [fiscalYear, setFiscalYear] = useState(currentYear);
    const [availableYears, setAvailableYears] = useState([]);
    const [error, setError] = useState('');
    const [loadingYears, setLoadingYears] = useState(false);

    useEffect(() => {
        if (show) {
            loadAvailableYears();
        }
    }, [show]);

    const loadAvailableYears = async () => {
        setLoadingYears(true);
        try {
            // Get all inward lots to find years with data
            const response = await inwardLotsAPI.getAll({ page_size: 10000 });
            const lots = response.data.results || response.data;

            // Extract unique fiscal years from inward dates
            const yearsSet = new Set();
            lots.forEach(lot => {
                const inwardDate = new Date(lot.inward_date);
                const month = inwardDate.getMonth() + 1; // 1-12
                // If month is Jan-Mar, it belongs to previous fiscal year
                const fiscalYear = month >= 4 ? inwardDate.getFullYear() : inwardDate.getFullYear() - 1;
                yearsSet.add(fiscalYear);
            });

            // Convert to sorted array (most recent first)
            const years = Array.from(yearsSet).sort((a, b) => b - a);

            // If no years found, add current year as fallback
            if (years.length === 0) {
                years.push(currentYear);
            }

            setAvailableYears(years);
            // Set default to most recent year
            if (years.length > 0) {
                setFiscalYear(years[0]);
            }
        } catch (err) {
            console.error('Failed to load available years:', err);
            // Fallback to last 3 years
            const fallbackYears = [currentYear, currentYear - 1, currentYear - 2];
            setAvailableYears(fallbackYears);
            setFiscalYear(currentYear);
        } finally {
            setLoadingYears(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!fiscalYear) {
            setError('Please select a financial year');
            return;
        }
        setError('');
        onExport(fiscalYear);
    };

    return (
        <Modal isOpen={show} onClose={onClose} title="Export Comprehensive Ledger" size="medium">
            <form onSubmit={handleSubmit} className="ledger-export-form">
                {error && <div className="alert alert-error">{error}</div>}

                <div className="form-group">
                    <label htmlFor="fiscal_year">Financial Year (April - March) *</label>
                    <select
                        id="fiscal_year"
                        value={fiscalYear}
                        onChange={(e) => setFiscalYear(parseInt(e.target.value))}
                        required
                        disabled={loading || loadingYears}
                    >
                        {loadingYears ? (
                            <option value="">Loading years...</option>
                        ) : (
                            <>
                                <option value="">Select Financial Year</option>
                                {availableYears.map(year => (
                                    <option key={year} value={year}>
                                        FY {year}-{(year + 1).toString().slice(-2)} (Apr {year} - Mar {year + 1})
                                    </option>
                                ))}
                            </>
                        )}
                    </select>
                    <small className="help-text" style={{ display: 'block', marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                        Only years with inward lot data are shown
                    </small>
                </div>

                <div className="modal-actions" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={onClose}
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={loading || loadingYears}>
                        {loading ? 'Generating Ledger...' : 'Export Excel Ledger'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default LedgerExportModal;
