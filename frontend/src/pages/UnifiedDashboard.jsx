import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  partiesAPI,
  qualityTypesAPI,
  inwardLotsAPI,
  programsAPI,
  billsAPI
} from '../services/api';
import CameraCapture from '../components/CameraCapture';
import { format } from 'date-fns';
import { Icons } from '../constants/icons';
import '../styles/theme.css';
import '../styles/Dashboard.css';

const UnifiedDashboard = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('inward');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Common data
  const [parties, setParties] = useState([]);
  const [qualityTypes, setQualityTypes] = useState([]);

  // Inward Lot data
  const [lots, setLots] = useState([]);
  const [inwardFormData, setInwardFormData] = useState({
    party: '',
    quality_type: '',
    total_meters: '',
    fiscal_year: new Date().getFullYear(),
    notes: '',
  });

  // Program data
  const [availableLots, setAvailableLots] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [showCamera, setShowCamera] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [programFormData, setProgramFormData] = useState({
    design_number: '',
    input_meters: '',
    output_meters: '',
    rate_per_meter: '',
    tax_amount: '0.00',
    notes: '',
    lot_allocations: [{ lot_id: '', allocated_meters: '' }],
  });

  // Billing data
  const [selectedPrograms, setSelectedPrograms] = useState([]);
  const [selectedParty, setSelectedParty] = useState('');
  const [statusFilter, setStatusFilter] = useState('Completed');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    loadCommonData();
  }, []);

  useEffect(() => {
    if (activeTab === 'inward') {
      loadLots();
    } else if (activeTab === 'program') {
      loadProgramData();
    } else if (activeTab === 'billing') {
      loadBillingData();
    }
  }, [activeTab, statusFilter]);

  const loadCommonData = async () => {
    try {
      const [partiesRes, qualityTypesRes] = await Promise.all([
        partiesAPI.getAll(),
        qualityTypesAPI.getAll(),
      ]);
      setParties(partiesRes.data.results || partiesRes.data);
      setQualityTypes(qualityTypesRes.data.results || qualityTypesRes.data);
    } catch (err) {
      console.error('Failed to load common data:', err);
    }
  };

  const loadLots = async () => {
    try {
      const lotsRes = await inwardLotsAPI.getAll({ page_size: 10 });
      setLots(lotsRes.data.results || lotsRes.data);
    } catch (err) {
      console.error('Failed to load lots:', err);
    }
  };

  const loadProgramData = async () => {
    try {
      const [lotsRes, programsRes] = await Promise.all([
        inwardLotsAPI.getAvailableLots({ min_balance: 1 }),
        programsAPI.getAll({ page_size: 10 }),
      ]);
      setAvailableLots(lotsRes.data.results || lotsRes.data);
      setPrograms(programsRes.data.results || programsRes.data);
    } catch (err) {
      console.error('Failed to load program data:', err);
    }
  };

  const loadBillingData = async () => {
    try {
      const programsRes = await programsAPI.getAll({ status: statusFilter });
      setPrograms(programsRes.data.results || programsRes.data);
    } catch (err) {
      console.error('Failed to load billing data:', err);
    }
  };

  // Inward Lot handlers
  const handleInwardSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await inwardLotsAPI.create(inwardFormData);
      setSuccess(`Lot created successfully: ${response.data.lot_number}`);
      setInwardFormData({
        party: '',
        quality_type: '',
        total_meters: '',
        fiscal_year: new Date().getFullYear(),
        notes: '',
      });
      loadLots();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create inward lot');
    } finally {
      setLoading(false);
    }
  };

  const handleInwardChange = (e) => {
    setInwardFormData({
      ...inwardFormData,
      [e.target.name]: e.target.value,
    });
  };

  // Program handlers
  const handleProgramSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await programsAPI.create(programFormData);
      const programId = response.data.id;

      if (photoFile) {
        await programsAPI.uploadPhoto(programId, photoFile);
      }

      setSuccess(`Program created successfully: ${response.data.program_number}`);
      setProgramFormData({
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
      loadProgramData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create program');
    } finally {
      setLoading(false);
    }
  };

  const handleProgramChange = (e) => {
    const { name, value } = e.target;
    setProgramFormData({
      ...programFormData,
      [name]: value,
    });
  };

  const handleLotAllocationChange = (index, field, value) => {
    const newAllocations = [...programFormData.lot_allocations];
    newAllocations[index][field] = value;
    setProgramFormData({
      ...programFormData,
      lot_allocations: newAllocations,
    });
  };

  const addLotAllocation = () => {
    setProgramFormData({
      ...programFormData,
      lot_allocations: [...programFormData.lot_allocations, { lot_id: '', allocated_meters: '' }],
    });
  };

  const removeLotAllocation = (index) => {
    const newAllocations = programFormData.lot_allocations.filter((_, i) => i !== index);
    setProgramFormData({
      ...programFormData,
      lot_allocations: newAllocations,
    });
  };

  const handleCameraCapture = (file, preview) => {
    setPhotoFile(file);
    setPhotoPreview(preview);
    setShowCamera(false);
  };

  // Billing handlers
  const handleSelectProgram = (programId) => {
    setSelectedPrograms((prev) =>
      prev.includes(programId)
        ? prev.filter((id) => id !== programId)
        : [...prev, programId]
    );
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedPrograms(programs.map((p) => p.id));
    } else {
      setSelectedPrograms([]);
    }
  };

  const handleGenerateBill = async () => {
    if (selectedPrograms.length === 0) {
      setError('Please select at least one program');
      return;
    }
    if (!selectedParty) {
      setError('Please select a party');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const billData = {
        party: selectedParty,
        bill_date: new Date().toISOString().split('T')[0],
        program_ids: selectedPrograms,
      };

      const response = await billsAPI.generate(billData);

      // Extract filename from Content-Disposition header
      const contentDisposition = response.headers['content-disposition'];
      let filename = `bill-${Date.now()}.pdf`; // fallback
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/"/g, '');
        }
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();

      setSuccess('Bill generated and downloaded successfully!');
      setSelectedPrograms([]);
      loadBillingData();
    } catch (err) {
      // Handle validation errors from DRF
      let errorMessage = 'Failed to generate bill';

      if (err.response?.data) {
        try {
          // When responseType is 'blob', error responses are also blobs
          // We need to parse the blob as JSON to get the error message
          const data = err.response.data;

          if (data instanceof Blob) {
            const text = await data.text();
            const errorData = JSON.parse(text);

            // Check for program_ids validation errors (program exclusivity)
            if (errorData.program_ids && Array.isArray(errorData.program_ids) && errorData.program_ids.length > 0) {
              errorMessage = errorData.program_ids[0];
            }
            // Check for other field-specific errors
            else if (typeof errorData === 'object' && !Array.isArray(errorData)) {
              const firstErrorKey = Object.keys(errorData)[0];
              if (firstErrorKey && errorData[firstErrorKey]) {
                const firstError = Array.isArray(errorData[firstErrorKey]) ? errorData[firstErrorKey][0] : errorData[firstErrorKey];
                errorMessage = firstError;
              }
            }
            // Check for generic detail message
            else if (errorData.detail) {
              errorMessage = errorData.detail;
            }
          } else {
            // If it's already parsed JSON
            if (data.program_ids && Array.isArray(data.program_ids) && data.program_ids.length > 0) {
              errorMessage = data.program_ids[0];
            }
            else if (typeof data === 'object' && !Array.isArray(data)) {
              const firstErrorKey = Object.keys(data)[0];
              if (firstErrorKey && data[firstErrorKey]) {
                const firstError = Array.isArray(data[firstErrorKey]) ? data[firstErrorKey][0] : data[firstErrorKey];
                errorMessage = firstError;
              }
            }
            else if (data.detail) {
              errorMessage = data.detail;
            }
          }
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
          errorMessage = 'Failed to generate bill';
        }
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleExportLedger = async () => {
    if (!selectedParty) {
      setError('Please select a party');
      return;
    }
    if (!startDate || !endDate) {
      setError('Please select date range');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await billsAPI.exportLedger({
        party_id: selectedParty,
        start_date: startDate,
        end_date: endDate,
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ledger-${selectedParty}-${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      setSuccess('Ledger exported successfully!');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to export ledger');
    } finally {
      setLoading(false);
    }
  };

  const totalAllocated = programFormData.lot_allocations.reduce(
    (sum, alloc) => sum + (parseFloat(alloc.allocated_meters) || 0),
    0
  );

  const wastage = (parseFloat(programFormData.input_meters) || 0) - (parseFloat(programFormData.output_meters) || 0);

  const getSelectedPartyPrograms = () => {
    if (!selectedParty) return programs;
    return programs.filter((program) =>
      program.lot_allocations?.some((alloc) => alloc.lot_party === selectedParty)
    );
  };

  const filteredPrograms = getSelectedPartyPrograms();

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Textile Inventory System</h1>
        <div className="header-actions">
          <span className="user-name"><Icons.User size={18} /> {user?.username || 'User'}</span>
          <button onClick={logout} className="btn btn-logout"><Icons.Logout size={16} /> Logout</button>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'inward' ? 'active' : ''}`}
          onClick={() => setActiveTab('inward')}
        >
          <Icons.Package size={18} /> Inward Log
        </button>
        <button
          className={`tab ${activeTab === 'program' ? 'active' : ''}`}
          onClick={() => setActiveTab('program')}
        >
          <Icons.Factory size={18} /> Program Entry
        </button>
        <button
          className={`tab ${activeTab === 'billing' ? 'active' : ''}`}
          onClick={() => setActiveTab('billing')}
        >
          <Icons.Billing size={18} /> Billing & Reports
        </button>
      </div>

      <div className="dashboard-content">
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {/* Inward Log Tab */}
        {activeTab === 'inward' && (
          <>
            <div className="card">
              <h2>Create New Inward Lot</h2>
              <form onSubmit={handleInwardSubmit} className="form">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="party">Party *</label>
                    <select
                      id="party"
                      name="party"
                      value={inwardFormData.party}
                      onChange={handleInwardChange}
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
                      value={inwardFormData.quality_type}
                      onChange={handleInwardChange}
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
                      value={inwardFormData.total_meters}
                      onChange={handleInwardChange}
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
                      value={inwardFormData.fiscal_year}
                      onChange={handleInwardChange}
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
                    value={inwardFormData.notes}
                    onChange={handleInwardChange}
                    rows="3"
                    disabled={loading}
                    placeholder="Optional notes..."
                  />
                </div>

                <button
                  type="submit"
                  className="btn-primary btn-large"
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
          </>
        )}

        {/* Program Entry Tab */}
        {activeTab === 'program' && (
          <>
            <div className="card">
              <h2>Create New Program</h2>
              <form onSubmit={handleProgramSubmit} className="form">
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
                          className="btn-remove-photo"
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
                    value={programFormData.design_number}
                    onChange={handleProgramChange}
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
                      value={programFormData.input_meters}
                      onChange={handleProgramChange}
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
                      value={programFormData.output_meters}
                      onChange={handleProgramChange}
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
                      <span className={wastage > 0 ? 'text-warning' : ''}>
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
                    {programFormData.input_meters && (
                      <span className={Math.abs(totalAllocated - parseFloat(programFormData.input_meters)) > 0.01 ? 'text-danger' : 'text-success'}>
                        {' '}(Must equal input: {parseFloat(programFormData.input_meters).toFixed(2)}m)
                      </span>
                    )}
                  </small>
                  {programFormData.lot_allocations.map((allocation, index) => (
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
                      {programFormData.lot_allocations.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLotAllocation(index)}
                          className="btn-remove"
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
                    className="btn-add"
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
                      value={programFormData.rate_per_meter}
                      onChange={handleProgramChange}
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
                      value={programFormData.tax_amount}
                      onChange={handleProgramChange}
                      step="0.01"
                      min="0"
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="form-group">
                  <label htmlFor="program_notes">Notes</label>
                  <textarea
                    id="program_notes"
                    name="notes"
                    value={programFormData.notes}
                    onChange={handleProgramChange}
                    rows="2"
                    disabled={loading}
                    placeholder="Optional notes..."
                  />
                </div>

                <button
                  type="submit"
                  className="btn-primary btn-large"
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
          </>
        )}

        {/* Billing & Reports Tab */}
        {activeTab === 'billing' && (
          <>
            <div className="card">
              <h2>Filters & Actions</h2>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="billing_party">Select Party</label>
                  <select
                    id="billing_party"
                    value={selectedParty}
                    onChange={(e) => setSelectedParty(e.target.value)}
                    disabled={loading}
                  >
                    <option value="">All Parties</option>
                    {parties.map((party) => (
                      <option key={party.id} value={party.id}>
                        {party.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="status">Status Filter</label>
                  <select
                    id="status"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    disabled={loading}
                  >
                    <option value="">All Status</option>
                    <option value="Pending">Pending</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="start_date">Start Date</label>
                  <input
                    type="date"
                    id="start_date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="end_date">End Date</label>
                  <input
                    type="date"
                    id="end_date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="action-buttons">
                <button
                  onClick={handleGenerateBill}
                  disabled={loading || selectedPrograms.length === 0}
                  className="btn btn-primary"
                >
                  <Icons.Document size={18} /> Generate Bill ({selectedPrograms.length})
                </button>
                <button
                  onClick={handleExportLedger}
                  disabled={loading || !selectedParty}
                  className="btn btn-success"
                >
                  <Icons.Chart size={18} /> Export Ledger
                </button>
              </div>
            </div>

            <div className="card">
              <h2>Programs ({filteredPrograms.length})</h2>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          onChange={handleSelectAll}
                          checked={
                            selectedPrograms.length === filteredPrograms.length &&
                            filteredPrograms.length > 0
                          }
                        />
                      </th>
                      <th>Program No.</th>
                      <th>Design No.</th>
                      <th>Input (m)</th>
                      <th>Output (m)</th>
                      <th>Wastage</th>
                      <th>Rate</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPrograms.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="text-center">No programs found</td>
                      </tr>
                    ) : (
                      filteredPrograms.map((program) => (
                        <tr key={program.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedPrograms.includes(program.id)}
                              onChange={() => handleSelectProgram(program.id)}
                              disabled={program.status !== 'Completed'}
                            />
                          </td>
                          <td><strong>{program.program_number}</strong></td>
                          <td>{program.design_number}</td>
                          <td>{parseFloat(program.input_meters).toFixed(2)}</td>
                          <td>{parseFloat(program.output_meters).toFixed(2)}</td>
                          <td className={program.is_wastage_high ? 'text-danger' : ''}>
                            {parseFloat(program.wastage_meters).toFixed(2)}m
                            <br />
                            <small>({parseFloat(program.wastage_percentage).toFixed(1)}%)</small>
                          </td>
                          <td>
                            {program.rate_per_meter ? `₹${parseFloat(program.rate_per_meter).toFixed(2)}` : '-'}
                          </td>
                          <td>
                            <strong>₹{parseFloat(program.total_amount || 0).toFixed(2)}</strong>
                          </td>
                          <td>
                            <span className={`badge badge-${program.status.toLowerCase()}`}>
                              {program.status}
                            </span>
                          </td>
                          <td>
                            {format(new Date(program.created_at), 'dd MMM yyyy')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <h3>Total Programs</h3>
                <div className="stat-value">{filteredPrograms.length}</div>
              </div>
              <div className="stat-card">
                <h3>Selected</h3>
                <div className="stat-value">{selectedPrograms.length}</div>
              </div>
              <div className="stat-card">
                <h3>Total Input</h3>
                <div className="stat-value">
                  {filteredPrograms
                    .reduce((sum, p) => sum + parseFloat(p.input_meters), 0)
                    .toFixed(2)}m
                </div>
              </div>
              <div className="stat-card">
                <h3>Total Output</h3>
                <div className="stat-value">
                  {filteredPrograms
                    .reduce((sum, p) => sum + parseFloat(p.output_meters), 0)
                    .toFixed(2)}m
                </div>
              </div>
            </div>
          </>
        )}
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

export default UnifiedDashboard;
