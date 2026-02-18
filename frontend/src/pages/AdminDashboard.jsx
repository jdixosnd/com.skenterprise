import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { programsAPI, billsAPI, partiesAPI } from '../services/api';
import { format } from 'date-fns';
import { Icons } from '../constants/icons';
import '../styles/theme.css';
import '../styles/Dashboard.css';

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const [programs, setPrograms] = useState([]);
  const [parties, setParties] = useState([]);
  const [selectedPrograms, setSelectedPrograms] = useState([]);
  const [selectedParty, setSelectedParty] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState('Completed');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    loadInitialData();
  }, [statusFilter]);

  const loadInitialData = async () => {
    try {
      const [programsRes, partiesRes] = await Promise.all([
        programsAPI.getAll({ status: statusFilter }),
        partiesAPI.getAll(),
      ]);

      setPrograms(programsRes.data.results || programsRes.data);
      setParties(partiesRes.data.results || partiesRes.data);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load initial data');
    }
  };

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

      // Download PDF
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `bill-${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      setSuccess('Bill generated and downloaded successfully!');
      setSelectedPrograms([]);
      loadInitialData();
    } catch (err) {
      console.error('Failed to generate bill:', err);

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

      // Download Excel
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ledger-${selectedParty}-${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      setSuccess('Ledger exported successfully!');
    } catch (err) {
      console.error('Failed to export ledger:', err);
      setError(err.response?.data?.detail || 'Failed to export ledger');
    } finally {
      setLoading(false);
    }
  };

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
        <h1>Billing & Statement Hub - Admin</h1>
        <div className="header-actions">
          <span className="user-name"><Icons.User size={18} /> {user?.username}</span>
          <button onClick={logout} className="btn btn-logout"><Icons.Logout size={16} /> Logout</button>
        </div>
      </header>

      <div className="dashboard-content">
        {/* Filter Controls */}
        <div className="card">
          <h2>Filters & Actions</h2>

          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="party">Select Party</label>
              <select
                id="party"
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

        {/* Programs Table */}
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
                    <td colSpan="10" className="text-center">
                      No programs found
                    </td>
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
                        <strong>
                          ₹{parseFloat(program.total_amount || 0).toFixed(2)}
                        </strong>
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

        {/* Summary Stats */}
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
      </div>
    </div>
  );
};

export default AdminDashboard;
