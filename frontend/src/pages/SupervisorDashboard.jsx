import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { partiesAPI, qualityTypesAPI, inwardLotsAPI } from '../services/api';
import { Icons } from '../constants/icons';
import '../styles/theme.css';
import '../styles/Dashboard.css';

const SupervisorDashboard = () => {
  const { user, logout } = useAuth();
  const [parties, setParties] = useState([]);
  const [qualityTypes, setQualityTypes] = useState([]);
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    party: '',
    quality_type: '',
    total_meters: '',
    fiscal_year: new Date().getFullYear(),
    notes: '',
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [partiesRes, qualityTypesRes, lotsRes] = await Promise.all([
        partiesAPI.getAll(),
        qualityTypesAPI.getAll(),
        inwardLotsAPI.getAll({ page_size: 10 }),
      ]);

      setParties(partiesRes.data.results || partiesRes.data);
      setQualityTypes(qualityTypesRes.data.results || qualityTypesRes.data);
      setLots(lotsRes.data.results || lotsRes.data);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load initial data');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await inwardLotsAPI.create(formData);
      setSuccess(`Lot created successfully: ${response.data.lot_number}`);

      // Reset form
      setFormData({
        party: '',
        quality_type: '',
        total_meters: '',
        fiscal_year: new Date().getFullYear(),
        notes: '',
      });

      // Reload lots
      loadInitialData();
    } catch (err) {
      console.error('Failed to create lot:', err);
      setError(err.response?.data?.detail || 'Failed to create inward lot');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Inward Log - Supervisor</h1>
        <div className="header-actions">
          <span className="user-name"><Icons.User size={18} /> {user?.username}</span>
          <button onClick={logout} className="btn btn-logout"><Icons.Logout size={16} /> Logout</button>
        </div>
      </header>

      <div className="dashboard-content">
        <div className="card">
          <h2>Create New Inward Lot</h2>

          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <form onSubmit={handleSubmit} className="form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="party">Party *</label>
                <select
                  id="party"
                  name="party"
                  value={formData.party}
                  onChange={handleChange}
                  required
                  disabled={loading}
                >
                  <option value="">Select Party</option>
                  {parties.map((party) => (
                    <option key={party.id} value={party.id}>
                      {party.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="quality_type">Quality Type *</label>
                <select
                  id="quality_type"
                  name="quality_type"
                  value={formData.quality_type}
                  onChange={handleChange}
                  required
                  disabled={loading}
                >
                  <option value="">Select Quality</option>
                  {qualityTypes.map((qt) => (
                    <option key={qt.id} value={qt.id}>
                      {qt.name} (₹{qt.default_rate_per_meter}/m)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="total_meters">Total Meters *</label>
                <input
                  type="number"
                  id="total_meters"
                  name="total_meters"
                  value={formData.total_meters}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  required
                  disabled={loading}
                  placeholder="Enter total meters"
                />
              </div>

              <div className="form-group">
                <label htmlFor="fiscal_year">Fiscal Year *</label>
                <input
                  type="number"
                  id="fiscal_year"
                  name="fiscal_year"
                  value={formData.fiscal_year}
                  onChange={handleChange}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows="3"
                disabled={loading}
                placeholder="Optional notes..."
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-large"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Inward Lot'}
            </button>
          </form>
        </div>

        <div className="card">
          <h2>Recent Inward Lots</h2>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Lot Number</th>
                  <th>Party</th>
                  <th>Quality</th>
                  <th>Total (m)</th>
                  <th>Balance (m)</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {lots.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center">No lots found</td>
                  </tr>
                ) : (
                  lots.map((lot) => (
                    <tr key={lot.id}>
                      <td><strong>{lot.lot_number}</strong></td>
                      <td>{lot.party_name}</td>
                      <td>{lot.quality_name}</td>
                      <td>{parseFloat(lot.total_meters).toFixed(2)}</td>
                      <td className={lot.balance_percentage < 10 ? 'text-danger' : ''}>
                        {parseFloat(lot.current_balance).toFixed(2)}
                        <small> ({lot.balance_percentage.toFixed(1)}%)</small>
                      </td>
                      <td>{new Date(lot.inward_date).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupervisorDashboard;
