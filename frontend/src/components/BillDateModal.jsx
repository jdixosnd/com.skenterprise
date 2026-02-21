import { useState, useEffect } from 'react';
import '../styles/Modal.css';

const BillDateModal = ({ isOpen, onClose, onConfirm, loading }) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const today = new Date().toISOString().split('T')[0];

  // Reset to today's date when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedDate(today);
    }
  }, [isOpen, today]);

  // Close modal on ESC key (unless loading)
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && !loading && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, loading, onClose]);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && !loading) {
      onClose();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!loading && selectedDate) {
      onConfirm(selectedDate);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div
        className="modal-container modal-small"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">Select Bill Date</h2>
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
            disabled={loading}
            style={{ opacity: loading ? 0.5 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label htmlFor="bill-date" style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: 500,
                color: '#374151'
              }}>
                Bill Date
              </label>
              <input
                id="bill-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={today}
                disabled={loading}
                required
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  fontSize: '1rem',
                  opacity: loading ? 0.6 : 1,
                  cursor: loading ? 'not-allowed' : 'text'
                }}
              />
              <p style={{
                marginTop: '0.5rem',
                fontSize: '0.875rem',
                color: '#6b7280'
              }}>
                Select today or any past date for the bill
              </p>
            </div>
          </div>

          <div className="modal-actions" style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e5e7eb' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn btn-secondary"
              style={{
                opacity: loading ? 0.6 : 1,
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{
                opacity: loading ? 0.6 : 1,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              {loading ? (
                <>
                  <span className="spinner" style={{
                    border: '2px solid transparent',
                    borderTopColor: 'white',
                    borderRadius: '50%',
                    width: '16px',
                    height: '16px',
                    animation: 'spin 0.6s linear infinite'
                  }}></span>
                  Generating...
                </>
              ) : (
                'Generate Bill'
              )}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default BillDateModal;
