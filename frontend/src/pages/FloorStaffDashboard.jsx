import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { programsAPI, inwardLotsAPI } from '../services/api';
import CameraCapture from '../components/CameraCapture';
import { Icons } from '../constants/icons';
import '../styles/theme.css';
import '../styles/Dashboard.css';

const FloorStaffDashboard = () => {
  const { user, logout } = useAuth();
  const [availableLots, setAvailableLots] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);

  const [formData, setFormData] = useState({
    design_number: '',
    input_meters: '',
    output_meters: '',
    rate_per_meter: '',
    tax_amount: '0.00',
    notes: '',
    lot_allocations: [{ lot_id: '', allocated_meters: '' }],
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [lotsRes, programsRes] = await Promise.all([
        inwardLotsAPI.getAvailableLots({ min_balance: 1 }),
        programsAPI.getAll({ page_size: 10 }),
      ]);

      setAvailableLots(lotsRes.data.results || lotsRes.data);
      setPrograms(programsRes.data.results || programsRes.data);
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
      // Create program with lot allocations
      const response = await programsAPI.create(formData);
      const programId = response.data.id;

      // Upload photo if available
      if (photoFile) {
        await programsAPI.uploadPhoto(programId, photoFile);
      }

      setSuccess(`Program created successfully: ${response.data.program_number}`);

      // Reset form
      setFormData({
        design_number: '',
        input_meters: '',
        output_meters: '',
        rate_per_meter: '',
        tax_amount: '0.00',
        notes: '',
        lot_allocations: [{ lot_id: '', allocated_meters: '' }],
      });
      setPhotoPreview(null);
      setPhotoFile(null);

      // Reload data
      loadInitialData();
    } catch (err) {
      console.error('Failed to create program:', err);
      setError(err.response?.data?.detail || 'Failed to create program');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });

    // Auto-calculate wastage
    if (name === 'input_meters' || name === 'output_meters') {
      const input = parseFloat(name === 'input_meters' ? value : formData.input_meters) || 0;
      const output = parseFloat(name === 'output_meters' ? value : formData.output_meters) || 0;
      const wastage = input - output;
      document.getElementById('wastage_display').textContent = wastage.toFixed(2);
    }
  };

  const handleLotAllocationChange = (index, field, value) => {
    const newAllocations = [...formData.lot_allocations];
    newAllocations[index][field] = value;
    setFormData({
      ...formData,
      lot_allocations: newAllocations,
    });
  };

  const addLotAllocation = () => {
    setFormData({
      ...formData,
      lot_allocations: [...formData.lot_allocations, { lot_id: '', allocated_meters: '' }],
    });
  };

  const removeLotAllocation = (index) => {
    const newAllocations = formData.lot_allocations.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      lot_allocations: newAllocations,
    });
  };

  const handleCameraCapture = (file, preview) => {
    setPhotoFile(file);
    setPhotoPreview(preview);
    setShowCamera(false);
  };

  const totalAllocated = formData.lot_allocations.reduce(
    (sum, alloc) => sum + (parseFloat(alloc.allocated_meters) || 0),
    0
  );

  const wastage = (parseFloat(formData.input_meters) || 0) - (parseFloat(formData.output_meters) || 0);

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Program Entry - Floor Staff</h1>
        <div className="header-actions">
          <span className="user-name"><Icons.User size={18} /> {user?.username}</span>
          <button onClick={logout} className="btn btn-logout"><Icons.Logout size={16} /> Logout</button>
        </div>
      </header>

      <div className="dashboard-content">
        <div className="card">
          <h2>Create New Program</h2>

          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <form onSubmit={handleSubmit} className="form">
            {/* Design Photo */}
            <div className="form-group">
              <label>Design Photo</label>
              <div className="photo-upload">
                {photoPreview ? (
                  <div className="photo-preview">
                    <img src={photoPreview} alt="Design" />
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoPreview(null);
                        setPhotoFile(null);
                      }}
                      className="btn btn-remove-photo"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCamera(true)}
                    className="btn btn-camera"
                  >
                    <Icons.Camera size={18} /> Take Photo
                  </button>
                )}
              </div>
            </div>

            {/* Design Number */}
            <div className="form-group">
              <label htmlFor="design_number">Design Number *</label>
              <input
                type="text"
                id="design_number"
                name="design_number"
                value={formData.design_number}
                onChange={handleChange}
                required
                disabled={loading}
                placeholder="Enter design number"
              />
            </div>

            {/* Meters Section */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="input_meters">Input Meters *</label>
                <input
                  type="number"
                  id="input_meters"
                  name="input_meters"
                  value={formData.input_meters}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  required
                  disabled={loading}
                  placeholder="0.00"
                />
              </div>

              <div className="form-group">
                <label htmlFor="output_meters">Output Meters *</label>
                <input
                  type="number"
                  id="output_meters"
                  name="output_meters"
                  value={formData.output_meters}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  required
                  disabled={loading}
                  placeholder="0.00"
                />
              </div>

              <div className="form-group">
                <label>Wastage (Auto)</label>
                <div className="display-field">
                  <span id="wastage_display" className={wastage > 0 ? 'text-warning' : ''}>
                    {wastage.toFixed(2)}
                  </span> m
                </div>
              </div>
            </div>

            {/* Lot Allocations */}
            <div className="form-group">
              <label>Lot Allocations *</label>
              <small className="help-text">
                Total Allocated: {totalAllocated.toFixed(2)}m
                {formData.input_meters && (
                  <span className={Math.abs(totalAllocated - parseFloat(formData.input_meters)) > 0.01 ? 'text-danger' : 'text-success'}>
                    {' '}(Must equal input: {parseFloat(formData.input_meters).toFixed(2)}m)
                  </span>
                )}
              </small>
              {formData.lot_allocations.map((allocation, index) => (
                <div key={index} className="lot-allocation-row">
                  <select
                    value={allocation.lot_id}
                    onChange={(e) => handleLotAllocationChange(index, 'lot_id', e.target.value)}
                    required
                    disabled={loading}
                  >
                    <option value="">Select Lot</option>
                    {availableLots.map((lot) => (
                      <option key={lot.id} value={lot.id}>
                        {lot.lot_number} - {lot.party_name} ({lot.quality_name}) - Balance: {parseFloat(lot.current_balance).toFixed(2)}m
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={allocation.allocated_meters}
                    onChange={(e) => handleLotAllocationChange(index, 'allocated_meters', e.target.value)}
                    step="0.01"
                    min="0"
                    required
                    disabled={loading}
                    placeholder="Meters"
                  />
                  {formData.lot_allocations.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLotAllocation(index)}
                      className="btn btn-remove"
                      disabled={loading}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addLotAllocation}
                className="btn btn-add"
                disabled={loading}
              >
                + Add Another Lot
              </button>
            </div>

            {/* Pricing */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="rate_per_meter">Rate per Meter (Optional)</label>
                <input
                  type="number"
                  id="rate_per_meter"
                  name="rate_per_meter"
                  value={formData.rate_per_meter}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  disabled={loading}
                  placeholder="Auto from quality type"
                />
              </div>

              <div className="form-group">
                <label htmlFor="tax_amount">Tax Amount</label>
                <input
                  type="number"
                  id="tax_amount"
                  name="tax_amount"
                  value={formData.tax_amount}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="form-group">
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows="2"
                disabled={loading}
                placeholder="Optional notes..."
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-large"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Program'}
            </button>
          </form>
        </div>

        <div className="card">
          <h2>Recent Programs</h2>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Program No.</th>
                  <th>Design</th>
                  <th>Input (m)</th>
                  <th>Output (m)</th>
                  <th>Wastage</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {programs.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center">No programs found</td>
                  </tr>
                ) : (
                  programs.map((program) => (
                    <tr key={program.id}>
                      <td><strong>{program.program_number}</strong></td>
                      <td>{program.design_number}</td>
                      <td>{parseFloat(program.input_meters).toFixed(2)}</td>
                      <td>{parseFloat(program.output_meters).toFixed(2)}</td>
                      <td className={program.is_wastage_high ? 'text-danger' : ''}>
                        {parseFloat(program.wastage_meters).toFixed(2)}m
                        <small> ({parseFloat(program.wastage_percentage).toFixed(1)}%)</small>
                      </td>
                      <td>
                        <span className={`badge badge-${program.status.toLowerCase()}`}>
                          {program.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showCamera && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
};

export default FloorStaffDashboard;
