import { format } from 'date-fns';
import '../styles/Modal.css';

const BillDetailModal = ({ bill, onClose, onDownloadPDF }) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container modal-large"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">Bill Details: {bill.bill_number}</h2>
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          {/* Bill Metadata */}
          <div className="bill-metadata">
            <div className="metadata-grid">
              <div className="metadata-item">
                <span className="metadata-label">Party:</span>
                <span className="metadata-value"><strong>{bill.party_name}</strong></span>
              </div>
              <div className="metadata-item">
                <span className="metadata-label">Bill Date:</span>
                <span className="metadata-value">{format(new Date(bill.bill_date), 'dd MMM yyyy')}</span>
              </div>
              <div className="metadata-item">
                <span className="metadata-label">Created:</span>
                <span className="metadata-value">{format(new Date(bill.created_at), 'dd MMM yyyy HH:mm')}</span>
              </div>
              {bill.created_by && (
                <div className="metadata-item">
                  <span className="metadata-label">Created By:</span>
                  <span className="metadata-value">{bill.created_by}</span>
                </div>
              )}
            </div>
          </div>

          {/* Programs Section */}
          <div className="bill-section">
            <h3>Programs ({bill.program_count})</h3>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Program No.</th>
                    <th>Design No.</th>
                    <th>Output (m)</th>
                    <th>Rate (₹/m)</th>
                    <th>Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {bill.programs_detail && bill.programs_detail.length > 0 ? (
                    bill.programs_detail.map(program => (
                      <tr key={program.id}>
                        <td>{program.program_number}</td>
                        <td>{program.design_number}</td>
                        <td>{parseFloat(program.output_meters || 0).toFixed(2)}m</td>
                        <td>₹{parseFloat(program.rate_per_meter || 0).toFixed(2)}</td>
                        <td>₹{parseFloat(program.total_amount || 0).toFixed(2)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="text-center">No program details available</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals Section */}
          <div className="bill-section bill-totals">
            <div className="totals-grid">
              <div className="total-row">
                <span className="total-label">Subtotal:</span>
                <span className="total-value">₹{parseFloat(bill.subtotal).toFixed(2)}</span>
              </div>
              <div className="total-row">
                <span className="total-label">Tax:</span>
                <span className="total-value">₹{parseFloat(bill.tax_total).toFixed(2)}</span>
              </div>
              <div className="total-row grand-total-row">
                <span className="total-label"><strong>Grand Total:</strong></span>
                <span className="total-value"><strong>₹{parseFloat(bill.grand_total).toFixed(2)}</strong></span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="modal-actions">
            <button
              onClick={() => onDownloadPDF(bill.id, bill.bill_number)}
              className="btn btn-primary"
            >
              ↓ Download PDF
            </button>
            <button onClick={onClose} className="btn btn-secondary">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillDetailModal;
