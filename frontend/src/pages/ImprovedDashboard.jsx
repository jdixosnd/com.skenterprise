import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastContainer';
import Sidebar from '../components/Sidebar';
import {
  partiesAPI,
  qualityTypesAPI,
  inwardLotsAPI,
  programsAPI,
  billsAPI,
  ratesAPI,
  partyRatesAPI,
  notificationsAPI
} from '../services/api';
import NotificationCenter from '../components/NotificationCenter';
import Modal from '../components/Modal';
import LedgerExportModal from '../components/LedgerExportModal';
import CameraCapture from '../components/CameraCapture';
import BillDateModal from '../components/BillDateModal';
import { format } from 'date-fns';
import { sortData, toggleSortDirection } from '../utils/sortUtils';
import { Icons } from '../constants/icons';
import '../styles/theme.css';
import '../styles/ImprovedDashboard.css';

const ImprovedDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [activeSection, setActiveSection] = useState(() => {
    // Check location state first, then localStorage
    return location.state?.section || localStorage.getItem('activeSection') || 'inward';
  });
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // Check localStorage for sidebar state
    const saved = localStorage.getItem('sidebarOpen');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [loading, setLoading] = useState(false);

  // Modal states
  const [showInwardModal, setShowInwardModal] = useState(false);
  const [showProgramModal, setShowProgramModal] = useState(false);
  const [showPartyModal, setShowPartyModal] = useState(false);
  const [showQualityModal, setShowQualityModal] = useState(false);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showProgramDetailModal, setShowProgramDetailModal] = useState(false);
  const [selectedProgramForView, setSelectedProgramForView] = useState(null);
  const [imageZoomed, setImageZoomed] = useState(false);
  const [showCustomRatesModal, setShowCustomRatesModal] = useState(false);
  const [selectedPartyForRates, setSelectedPartyForRates] = useState(null);
  const [partyCustomRates, setPartyCustomRates] = useState([]);
  const [inwardPartyRates, setInwardPartyRates] = useState([]);
  const [showBillDateModal, setShowBillDateModal] = useState(false);

  // Notification states
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Editing states
  const [editingInward, setEditingInward] = useState(null);
  const [editingProgram, setEditingProgram] = useState(null);
  const [editingParty, setEditingParty] = useState(null);
  const [editingQuality, setEditingQuality] = useState(null);

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
    is_gstin_registered: false,
    lr_number: '',
    notes: '',
  });

  // Program data
  const [availableLots, setAvailableLots] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [programFormData, setProgramFormData] = useState({
    party: '',
    design_number: '',
    challan_no: '',
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
  const [selectedQualityType, setSelectedQualityType] = useState('');
  const [statusFilter, setStatusFilter] = useState('Completed');
  const [ledgerStartDate, setLedgerStartDate] = useState(() => {
    const year = new Date().getFullYear();
    return `${year}-01-01`;
  });
  const [ledgerEndDate, setLedgerEndDate] = useState(() => {
    const year = new Date().getFullYear();
    return `${year}-12-31`;
  });

  // Settings data
  const [partyFormData, setPartyFormData] = useState({
    name: '',
    contact: '',
    address: '',
  });

  const [qualityFormData, setQualityFormData] = useState({
    name: '',
    default_rate_per_meter: '',
  });

  // Sort state for tables
  const [lotsSortKey, setLotsSortKey] = useState('lot_number');
  const [lotsSortDirection, setLotsSortDirection] = useState('desc');
  const [programsSortKey, setProgramsSortKey] = useState('program_number');
  const [programsSortDirection, setProgramsSortDirection] = useState('desc');
  const [billingProgramsSortKey, setBillingProgramsSortKey] = useState('program_number');
  const [billingProgramsSortDirection, setBillingProgramsSortDirection] = useState('desc');
  const [partiesSortKey, setPartiesSortKey] = useState('name');
  const [partiesSortDirection, setPartiesSortDirection] = useState('asc');
  const [qualitiesSortKey, setQualitiesSortKey] = useState('name');
  const [qualitiesSortDirection, setQualitiesSortDirection] = useState('asc');

  // Pagination states
  const [lotsCurrentPage, setLotsCurrentPage] = useState(1);
  const [programsCurrentPage, setProgramsCurrentPage] = useState(1);
  const [billingCurrentPage, setBillingCurrentPage] = useState(1);
  const [partiesCurrentPage, setPartiesCurrentPage] = useState(1);
  const [qualitiesCurrentPage, setQualitiesCurrentPage] = useState(1);

  const lotsPerPage = 10;
  const programsPerPage = 10;
  const billingPerPage = 10;
  const partiesPerPage = 5; // Settings page
  const qualitiesPerPage = 5; // Settings page

  useEffect(() => {
    loadCommonData();
  }, []);

  // Handle navigation from sidebar with location state
  useEffect(() => {
    if (location.state?.section) {
      setActiveSection(location.state.section);
      // Clear the location state to avoid re-triggering
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state?.section]);

  useEffect(() => {
    localStorage.setItem('activeSection', activeSection);
  }, [activeSection]);

  useEffect(() => {
    localStorage.setItem('sidebarOpen', JSON.stringify(sidebarOpen));
  }, [sidebarOpen]);

  useEffect(() => {
    if (activeSection === 'inward') {
      loadLots();
    } else if (activeSection === 'program') {
      loadProgramData();
    } else if (activeSection === 'billing') {
      loadBillingData();
    }
  }, [activeSection, statusFilter]);

  // Fetch unread notification count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const response = await notificationsAPI.getUnreadCount();
        setUnreadCount(response.data.unread_count);
      } catch (error) {
        console.error('Failed to fetch unread count:', error);
      }
    };

    fetchUnreadCount();
    // Poll every 60 seconds
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, []);

  // Auto-fill rate when lot allocation changes
  useEffect(() => {
    const fetchRateForLot = async () => {
      if (!programFormData.lot_allocations || programFormData.lot_allocations.length === 0) {
        return;
      }

      const firstAllocation = programFormData.lot_allocations[0];
      if (!firstAllocation.lot_id) return;

      // Find selected lot to get party and quality
      const selectedLot = lots.find(lot => lot.id === parseInt(firstAllocation.lot_id));
      if (!selectedLot) return;

      try {
        const response = await ratesAPI.getPartyQualityRate(
          selectedLot.party,
          selectedLot.quality_type
        );

        if (response.data && response.data.rate) {
          setProgramFormData(prev => ({
            ...prev,
            rate_per_meter: response.data.rate
          }));
        }
      } catch (error) {
        console.error('Failed to fetch rate:', error);
        // Fail silently - user can still enter rate manually
      }
    };

    fetchRateForLot();
  }, [programFormData.lot_allocations, lots]);

  // Load party-specific rates when party is selected in inward form
  useEffect(() => {
    const loadInwardPartyRates = async () => {
      if (!inwardFormData.party) {
        setInwardPartyRates([]);
        return;
      }

      try {
        const response = await partyRatesAPI.getByParty(inwardFormData.party);
        setInwardPartyRates(response.data.results || response.data);
      } catch (error) {
        console.error('Failed to load party rates:', error);
        setInwardPartyRates([]);
      }
    };

    loadInwardPartyRates();
  }, [inwardFormData.party]);

  // Helper function to get effective rate for display in inward form
  const getEffectiveRateForDisplay = (qualityTypeId) => {
    if (!inwardFormData.party || !qualityTypeId) {
      // No party selected, show default rate
      const quality = qualityTypes.find(q => q.id === parseInt(qualityTypeId));
      return quality ? parseFloat(quality.default_rate_per_meter).toFixed(2) : '0.00';
    }

    // Check if there's a custom rate for this party-quality combination
    const customRate = inwardPartyRates.find(r => r.quality_type === parseInt(qualityTypeId));
    if (customRate) {
      return parseFloat(customRate.rate_per_meter).toFixed(2);
    }

    // Fall back to default rate
    const quality = qualityTypes.find(q => q.id === parseInt(qualityTypeId));
    return quality ? parseFloat(quality.default_rate_per_meter).toFixed(2) : '0.00';
  };

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
      const lotsRes = await inwardLotsAPI.getAll({ page_size: 100 });
      setLots(lotsRes.data.results || lotsRes.data);
    } catch (err) {
      console.error('Failed to load lots:', err);
    }
  };

  const loadProgramData = async () => {
    try {
      const [lotsRes, availableLotsRes, programsRes] = await Promise.all([
        inwardLotsAPI.getAll({ page_size: 100 }), // Load all lots for party detection
        inwardLotsAPI.getAvailableLots({ min_balance: 1 }), // Load available lots
        programsAPI.getAll({ page_size: 100 }),
      ]);
      setLots(lotsRes.data.results || lotsRes.data); // Set full lots array
      setAvailableLots(availableLotsRes.data.results || availableLotsRes.data);
      setPrograms(programsRes.data.results || programsRes.data);
    } catch (err) {
      console.error('Failed to load program data:', err);
    }
  };

  const loadBillingData = async () => {
    try {
      // Load both programs and lots for proper party filtering
      const [programsRes, lotsRes] = await Promise.all([
        programsAPI.getAll({ status: statusFilter }),
        inwardLotsAPI.getAll({ page_size: 100 })
      ]);
      setPrograms(programsRes.data.results || programsRes.data);
      setLots(lotsRes.data.results || lotsRes.data);
    } catch (err) {
      console.error('Failed to load billing data:', err);
    }
  };

  // Validation functions
  const validateInwardForm = () => {
    if (!inwardFormData.party) {
      toast.showError('Please select a party');
      return false;
    }
    if (!inwardFormData.quality_type) {
      toast.showError('Please select a quality type');
      return false;
    }
    if (!inwardFormData.total_meters || parseFloat(inwardFormData.total_meters) <= 0) {
      toast.showError('Total meters must be greater than 0');
      return false;
    }
    if (!inwardFormData.fiscal_year) {
      toast.showError('Please enter fiscal year');
      return false;
    }
    return true;
  };

  const validateProgramForm = () => {
    if (!programFormData.party) {
      toast.showError('Please select a party');
      return false;
    }
    if (!programFormData.input_meters || parseFloat(programFormData.input_meters) <= 0) {
      toast.showError('Input meters must be greater than 0');
      return false;
    }
    // Output meters is optional (can be added later when updating)
    if (programFormData.output_meters && parseFloat(programFormData.output_meters) > parseFloat(programFormData.input_meters)) {
      toast.showError('Output meters cannot exceed input meters');
      return false;
    }
    if (programFormData.lot_allocations.length === 0) {
      toast.showError('Please add at least one lot allocation');
      return false;
    }
    for (const alloc of programFormData.lot_allocations) {
      if (!alloc.lot_id || !alloc.allocated_meters || parseFloat(alloc.allocated_meters) <= 0) {
        toast.showError('All lot allocations must have a lot and valid meters');
        return false;
      }
    }
    const totalAllocated = programFormData.lot_allocations.reduce(
      (sum, alloc) => sum + parseFloat(alloc.allocated_meters || 0),
      0
    );
    if (Math.abs(totalAllocated - parseFloat(programFormData.input_meters)) > 0.01) {
      toast.showError(`Total allocated (${totalAllocated.toFixed(2)}m) must equal input meters (${programFormData.input_meters}m)`);
      return false;
    }
    return true;
  };

  const validatePartyForm = () => {
    if (!partyFormData.name || partyFormData.name.trim() === '') {
      toast.showError('Party name is required');
      return false;
    }
    return true;
  };

  const validateQualityForm = () => {
    if (!qualityFormData.name || qualityFormData.name.trim() === '') {
      toast.showError('Quality type name is required');
      return false;
    }
    if (!qualityFormData.default_rate_per_meter || parseFloat(qualityFormData.default_rate_per_meter) < 0) {
      toast.showError('Default rate must be 0 or greater');
      return false;
    }
    return true;
  };

  // Sort handler
  const handleSort = (key, currentKey, currentDirection, setKey, setDirection, data, setData) => {
    const newDirection = toggleSortDirection(currentKey, key, currentDirection);
    setKey(key);
    setDirection(newDirection);
    const sorted = sortData(data, key, newDirection);
    setData(sorted);
  };

  // Render sort icon based on current sort state
  const renderSortIcon = (columnKey, sortKey, sortDirection) => {
    if (columnKey !== sortKey) {
      return <Icons.SortNeutral className="sort-icon" size={14} />;
    }
    return sortDirection === 'asc' ?
      <Icons.SortUp className="sort-icon active" size={14} /> :
      <Icons.SortDown className="sort-icon active" size={14} />;
  };

  // Pagination helper functions
  const paginateData = (data, currentPage, itemsPerPage) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  };

  const getTotalPages = (dataLength, itemsPerPage) => {
    return Math.ceil(dataLength / itemsPerPage);
  };

  const renderPaginationControls = (currentPage, setCurrentPage, totalItems, itemsPerPage) => {
    const totalPages = getTotalPages(totalItems, itemsPerPage);
    if (totalPages <= 1) return null;

    return (
      <div className="pagination-controls">
        <button
          className="btn btn-sm btn-secondary"
          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
        >
          <Icons.ChevronLeft size={16} /> Previous
        </button>
        <span className="pagination-info">
          Page {currentPage} of {totalPages} ({totalItems} items)
        </span>
        <button
          className="btn btn-sm btn-secondary"
          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
        >
          Next <Icons.ChevronRight size={16} />
        </button>
      </div>
    );
  };

  // Inward Lot handlers
  const openInwardModal = (lot = null) => {
    if (lot) {
      setEditingInward(lot);
      setInwardFormData({
        party: lot.party,
        quality_type: lot.quality_type,
        total_meters: lot.total_meters,
        fiscal_year: lot.fiscal_year,
        is_gstin_registered: lot.is_gstin_registered || false,
        lr_number: lot.lr_number || '',
        notes: lot.notes || '',
      });
    } else {
      setEditingInward(null);
      setInwardFormData({
        party: '',
        quality_type: '',
        total_meters: '',
        fiscal_year: new Date().getFullYear(),
        is_gstin_registered: false,
        lr_number: '',
        notes: '',
      });
    }
    setShowInwardModal(true);
  };

  const handleInwardSubmit = async (e) => {
    e.preventDefault();
    // toast.showError('');
    // toast.showSuccess('');

    if (!validateInwardForm()) return;

    setLoading(true);
    try {
      if (editingInward) {
        const response = await inwardLotsAPI.update(editingInward.id, inwardFormData);
        toast.showSuccess(`Lot ${response.data.lot_number} updated successfully`);
      } else {
        const response = await inwardLotsAPI.create(inwardFormData);
        toast.showSuccess(`Lot ${response.data.lot_number} created successfully`);
      }
      setShowInwardModal(false);
      loadLots();
    } catch (err) {
      toast.showError(err.response?.data?.detail || 'Failed to save inward lot');
    } finally {
      setLoading(false);
    }
  };

  // Program handlers
  const openProgramModal = (program = null) => {
    if (program) {
      setEditingProgram(program);
      // Determine party from first lot allocation
      let partyId = '';
      if (program.lot_allocations && program.lot_allocations.length > 0) {
        const firstLotId = program.lot_allocations[0].lot;

        // Try to find the lot in lots array first (includes all lots)
        let firstLot = lots.find(lot => lot.id === firstLotId);

        // If not found, try availableLots
        if (!firstLot) {
          firstLot = availableLots.find(lot => lot.id === firstLotId);
        }

        if (firstLot) {
          partyId = firstLot.party;
          console.log('Found party ID:', partyId, 'from lot:', firstLot);
        } else {
          console.warn('Could not find lot with ID:', firstLotId, 'in lots or availableLots');
          console.log('Available lots count:', lots.length, 'Available with balance:', availableLots.length);
        }
      }

      console.log('Setting program form with party:', partyId);

      setProgramFormData({
        party: partyId ? String(partyId) : '', // Ensure it's a string for the select element
        design_number: program.design_number,
        challan_no: program.challan_no || '',
        input_meters: program.input_meters,
        output_meters: program.output_meters || '',
        rate_per_meter: program.rate_per_meter || '',
        tax_amount: program.tax_amount || '0.00',
        notes: program.notes || '',
        status: program.status || 'Pending', // Add status field
        lot_allocations: program.lot_allocations?.map(alloc => ({
          lot_id: alloc.lot?.id || alloc.lot,  // Handle both nested object and direct ID
          allocated_meters: alloc.allocated_meters
        })) || [{ lot_id: '', allocated_meters: '' }],
      });
      // Set photo preview if exists
      if (program.design_photo_base64) {
        setPhotoPreview(`data:image/jpeg;base64,${program.design_photo_base64}`);
      } else {
        setPhotoPreview(null);
      }
      setPhotoFile(null);
    } else {
      setEditingProgram(null);
      setProgramFormData({
        party: '',
        design_number: '',
        challan_no: '',
        input_meters: '',
        output_meters: '',
        rate_per_meter: '',
        tax_amount: '0.00',
        notes: '',
        status: 'Pending', // Default status for new programs
        lot_allocations: [{ lot_id: '', allocated_meters: '' }],
      });
      setPhotoPreview(null);
      setPhotoFile(null);
    }
    setShowProgramModal(true);
  };

  const handleProgramSubmit = async (e) => {
    e.preventDefault();
    // toast.showError('');
    // toast.showSuccess('');

    if (!validateProgramForm()) return;

    setLoading(true);
    try {
      // Debug: Log the lot_allocations structure
      console.log('Program form data before submit:', programFormData);
      console.log('Lot allocations structure:', programFormData.lot_allocations);
      console.log('Lot allocations JSON:', JSON.stringify(programFormData.lot_allocations));

      const formData = new FormData();
      formData.append('design_number', programFormData.design_number);
      if (programFormData.challan_no) {
        formData.append('challan_no', programFormData.challan_no);
      }
      formData.append('input_meters', programFormData.input_meters);
      formData.append('output_meters', programFormData.output_meters || '0');
      formData.append('rate_per_meter', programFormData.rate_per_meter || '0');
      formData.append('tax_amount', programFormData.tax_amount || '0');
      formData.append('notes', programFormData.notes || '');
      formData.append('lot_allocations', JSON.stringify(programFormData.lot_allocations));

      // Add status field when editing
      if (editingProgram && programFormData.status) {
        formData.append('status', programFormData.status);
      }

      if (photoFile) {
        formData.append('design_photo_file', photoFile);
        formData.append('design_photo_name', photoFile.name);
      }

      if (editingProgram) {
        const response = await programsAPI.update(editingProgram.id, formData);
        toast.showSuccess(`Program ${response.data.program_number} updated successfully`);
      } else {
        const response = await programsAPI.create(formData);
        toast.showSuccess(`Program ${response.data.program_number} created successfully`);
      }
      setShowProgramModal(false);
      loadProgramData();
    } catch (err) {
      console.error('Program error:', err.response?.data);
      // Handle different error response formats
      let errorMessage = `Failed to ${editingProgram ? 'update' : 'create'} program`;

      if (err.response?.data) {
        if (typeof err.response.data === 'string') {
          errorMessage = err.response.data;
        } else if (Array.isArray(err.response.data)) {
          errorMessage = err.response.data.join(', ');
        } else if (err.response.data.error) {
          errorMessage = err.response.data.error;
        } else if (err.response.data.detail) {
          errorMessage = err.response.data.detail;
        } else if (err.response.data.lot_allocations) {
          // Handle lot_allocations specific errors
          const allocErrors = Array.isArray(err.response.data.lot_allocations)
            ? err.response.data.lot_allocations.join(', ')
            : err.response.data.lot_allocations;
          errorMessage = `Lot allocations error: ${allocErrors}`;
        } else {
          // Display all field errors
          const errors = Object.entries(err.response.data)
            .map(([field, messages]) => {
              const msgArray = Array.isArray(messages) ? messages : [messages];
              return `${field}: ${msgArray.join(', ')}`;
            })
            .join('; ');
          errorMessage = errors || errorMessage;
        }
      }

      toast.showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Party handlers
  const openPartyModal = (party = null) => {
    if (party) {
      setEditingParty(party);
      setPartyFormData({
        name: party.name,
        contact: party.contact || '',
        address: party.address || '',
      });
    } else {
      setEditingParty(null);
      setPartyFormData({
        name: '',
        contact: '',
        address: '',
      });
    }
    setShowPartyModal(true);
  };

  const handlePartySubmit = async (e) => {
    e.preventDefault();
    // toast.showError('');
    // toast.showSuccess('');

    if (!validatePartyForm()) return;

    setLoading(true);
    try {
      if (editingParty) {
        await partiesAPI.update(editingParty.id, partyFormData);
        toast.showSuccess('Party updated successfully');
      } else {
        await partiesAPI.create(partyFormData);
        toast.showSuccess('Party created successfully');
      }
      setShowPartyModal(false);
      loadCommonData();
    } catch (err) {
      toast.showError(err.response?.data?.detail || 'Failed to save party');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteParty = async (id) => {
    if (!window.confirm('Are you sure you want to delete this party?')) return;

    setLoading(true);
    try {
      await partiesAPI.delete(id);
      toast.showSuccess('Party deleted successfully');
      loadCommonData();
    } catch (err) {
      toast.showError(err.response?.data?.detail || 'Failed to delete party');
    } finally {
      setLoading(false);
    }
  };

  // Custom Rates handlers
  const openCustomRatesModal = async (party) => {
    setSelectedPartyForRates(party);
    setShowCustomRatesModal(true);
    // Load existing custom rates for this party
    try {
      const response = await partyRatesAPI.getByParty(party.id);
      setPartyCustomRates(response.data.results || response.data);
    } catch (err) {
      console.error('Failed to load custom rates:', err);
      setPartyCustomRates([]);
    }
  };

  const handleAddCustomRate = async (qualityTypeId, rate, notes = '') => {
    if (!selectedPartyForRates) return;

    try {
      await partyRatesAPI.create({
        party: selectedPartyForRates.id,
        quality_type: qualityTypeId,
        rate_per_meter: rate,
        notes: notes
      });
      toast.showSuccess('Custom rate added successfully');
      // Reload custom rates
      const response = await partyRatesAPI.getByParty(selectedPartyForRates.id);
      setPartyCustomRates(response.data.results || response.data);
    } catch (err) {
      toast.showError(err.response?.data?.detail || err.response?.data?.non_field_errors?.[0] || 'Failed to add custom rate');
    }
  };

  const handleDeleteCustomRate = async (rateId) => {
    if (!window.confirm('Are you sure you want to delete this custom rate?')) return;

    try {
      await partyRatesAPI.delete(rateId);
      toast.showSuccess('Custom rate deleted successfully');
      // Reload custom rates
      const response = await partyRatesAPI.getByParty(selectedPartyForRates.id);
      setPartyCustomRates(response.data.results || response.data);
    } catch (err) {
      toast.showError(err.response?.data?.detail || 'Failed to delete custom rate');
    }
  };

  // Quality handlers
  const openQualityModal = (quality = null) => {
    if (quality) {
      setEditingQuality(quality);
      setQualityFormData({
        name: quality.name,
        default_rate_per_meter: quality.default_rate_per_meter,
      });
    } else {
      setEditingQuality(null);
      setQualityFormData({
        name: '',
        default_rate_per_meter: '',
      });
    }
    setShowQualityModal(true);
  };

  const handleQualitySubmit = async (e) => {
    e.preventDefault();
    // toast.showError('');
    // toast.showSuccess('');

    if (!validateQualityForm()) return;

    setLoading(true);
    try {
      if (editingQuality) {
        await qualityTypesAPI.update(editingQuality.id, qualityFormData);
        toast.showSuccess('Quality type updated successfully');
      } else {
        await qualityTypesAPI.create(qualityFormData);
        toast.showSuccess('Quality type created successfully');
      }
      setShowQualityModal(false);
      loadCommonData();
    } catch (err) {
      toast.showError(err.response?.data?.detail || 'Failed to save quality type');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQuality = async (id) => {
    if (!window.confirm('Are you sure you want to delete this quality type?')) return;

    setLoading(true);
    try {
      await qualityTypesAPI.delete(id);
      toast.showSuccess('Quality type deleted successfully');
      loadCommonData();
    } catch (err) {
      toast.showError(err.response?.data?.detail || 'Failed to delete quality type');
    } finally {
      setLoading(false);
    }
  };

  // Helper functions
  const handleProgramChange = (e) => {
    const { name, value } = e.target;

    // If party changes, reset lot allocations
    if (name === 'party') {
      setProgramFormData({
        ...programFormData,
        [name]: value,
        lot_allocations: [{ lot_id: '', allocated_meters: '' }],
      });
    } else {
      setProgramFormData({
        ...programFormData,
        [name]: value,
      });
    }
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

  const totalAllocated = programFormData.lot_allocations.reduce(
    (sum, alloc) => sum + parseFloat(alloc.allocated_meters || 0),
    0
  );

  // Filter available lots based on selected party
  // When editing, also include lots that are already allocated to this program
  const filteredAvailableLots = useMemo(() => {
    if (!programFormData.party) return availableLots;

    const partyId = parseInt(programFormData.party);
    let lotsForParty = availableLots.filter(lot => lot.party === partyId);

    // If editing a program, also include lots that are currently allocated
    // This allows users to edit programs even when lot balance is fully allocated
    if (editingProgram && programFormData.lot_allocations) {
      const allocatedLotIds = programFormData.lot_allocations
        .map(alloc => alloc.lot_id)
        .filter(id => id); // Remove empty/null ids

      // Find allocated lots that aren't already in availableLots
      const allocatedLots = lots.filter(lot =>
        allocatedLotIds.includes(lot.id) &&
        lot.party === partyId &&
        !lotsForParty.some(availLot => availLot.id === lot.id)
      );

      // Merge available lots + allocated lots
      lotsForParty = [...lotsForParty, ...allocatedLots];
    }

    // Filter by GSTIN consistency
    if (programFormData.lot_allocations && programFormData.lot_allocations.length > 0) {
      const firstAllocatedLotId = programFormData.lot_allocations[0].lot_id;
      if (firstAllocatedLotId) {
        const firstLot = lots.find(l => l.id === parseInt(firstAllocatedLotId));
        if (firstLot) {
          lotsForParty = lotsForParty.filter(lot =>
            lot.is_gstin_registered === firstLot.is_gstin_registered
          );
        }
      }
    }

    return lotsForParty;
  }, [programFormData.party, availableLots, editingProgram, programFormData.lot_allocations, lots]);


  const handlePhotoCapture = (file, imageUrl) => {
    setPhotoFile(file);
    setPhotoPreview(imageUrl || URL.createObjectURL(file));
    setShowCamera(false);
  };

  const openProgramDetailView = (program) => {
    console.log('Opening program detail view:', program);
    setSelectedProgramForView(program);
    setShowProgramDetailModal(true);
    setImageZoomed(false);
  };

  const handleProgramSelection = (programId) => {
    if (selectedPrograms.includes(programId)) {
      setSelectedPrograms(selectedPrograms.filter((id) => id !== programId));
    } else {
      setSelectedPrograms([...selectedPrograms, programId]);
    }
  };

  const handleGenerateBill = () => {
    if (selectedPrograms.length === 0) {
      toast.showError('Please select programs to generate bill');
      return;
    }

    if (!selectedParty) {
      toast.showError('Please select a party');
      return;
    }

    // GSTIN validation
    const selectedProgramObjects = filteredPrograms.filter(p => selectedPrograms.includes(p.id));
    const gstinStatuses = new Set();

    selectedProgramObjects.forEach(program => {
      if (program.lot_allocations && program.lot_allocations.length > 0) {
        const lotId = program.lot_allocations[0].lot;
        const lot = lots.find(l => l.id === lotId);
        if (lot) {
          gstinStatuses.add(lot.is_gstin_registered);
        }
      }
    });

    if (gstinStatuses.size > 1) {
      toast.showError('Cannot generate bill: Selected programs have mixed GSTIN status. All programs must be either GSTIN-registered or non-GSTIN.');
      return;
    }

    // Open modal after validation passes
    setShowBillDateModal(true);
  };

  const handleConfirmBillGeneration = async (billDate) => {
    setLoading(true);
    try {
      const response = await billsAPI.generate({
        party: selectedParty,
        program_ids: selectedPrograms,
        bill_date: billDate,
      });

      // Extract bill number from response headers or use default
      const billNumber = response.headers?.['x-bill-number'] || `Bill_${billDate}`;

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${billNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.showSuccess(`Bill generated successfully: ${billNumber}`);

      // Close modal and refresh data
      setShowBillDateModal(false);
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

      toast.showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenLedgerModal = () => {
    // No party selection needed - comprehensive ledger exports all parties
    console.log('Opening ledger modal...');
    setShowLedgerModal(true);
  };

  const executeLedgerExport = async (fiscalYear) => {
    setLoading(true);
    try {
      const response = await billsAPI.exportLedger({
        fiscal_year: fiscalYear,
      });

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Comprehensive_Ledger_FY${fiscalYear}-${(fiscalYear + 1).toString().slice(-2)}.xlsx`;
      link.click();

      toast.showSuccess('Comprehensive ledger exported successfully');
      setShowLedgerModal(false);
    } catch (err) {
      toast.showError(err.response?.data?.detail || err.response?.data?.error || 'Failed to export ledger');
    } finally {
      setLoading(false);
    }
  };

  const filteredPrograms = useMemo(() => {
    let filtered = programs.filter((p) => p.status === statusFilter);

    // Filter by party if selected
    if (selectedParty) {
      filtered = filtered.filter((program) => {
        if (!program.lot_allocations || program.lot_allocations.length === 0) {
          return false;
        }
        return program.lot_allocations.some((alloc) => {
          const lot = lots.find((l) => l.id === alloc.lot);
          if (lot) {
            return lot.party === parseInt(selectedParty);
          }
          return false;
        });
      });
    }

    // Filter by quality type if selected
    if (selectedQualityType) {
      filtered = filtered.filter((program) => {
        if (!program.lot_allocations || program.lot_allocations.length === 0) {
          return false;
        }
        return program.lot_allocations.some((alloc) => {
          const lot = lots.find((l) => l.id === alloc.lot);
          if (lot) {
            return lot.quality_type === parseInt(selectedQualityType);
          }
          return false;
        });
      });
    }

    // Apply sorting
    const sorted = sortData(filtered, billingProgramsSortKey, billingProgramsSortDirection);
    return sorted;
  }, [programs, statusFilter, selectedParty, selectedQualityType, lots, billingProgramsSortKey, billingProgramsSortDirection]);

  // Sorted and paginated data for each section
  const sortedLots = useMemo(() => {
    return sortData(lots, lotsSortKey, lotsSortDirection);
  }, [lots, lotsSortKey, lotsSortDirection]);

  const paginatedLots = useMemo(() => {
    return paginateData(sortedLots, lotsCurrentPage, lotsPerPage);
  }, [sortedLots, lotsCurrentPage, lotsPerPage]);

  const sortedPrograms = useMemo(() => {
    return sortData(programs, programsSortKey, programsSortDirection);
  }, [programs, programsSortKey, programsSortDirection]);

  const paginatedPrograms = useMemo(() => {
    return paginateData(sortedPrograms, programsCurrentPage, programsPerPage);
  }, [sortedPrograms, programsCurrentPage, programsPerPage]);

  const paginatedBillingPrograms = useMemo(() => {
    return paginateData(filteredPrograms, billingCurrentPage, billingPerPage);
  }, [filteredPrograms, billingCurrentPage, billingPerPage]);

  const sortedParties = useMemo(() => {
    return sortData(parties, partiesSortKey, partiesSortDirection);
  }, [parties, partiesSortKey, partiesSortDirection]);

  const paginatedParties = useMemo(() => {
    return paginateData(sortedParties, partiesCurrentPage, partiesPerPage);
  }, [sortedParties, partiesCurrentPage, partiesPerPage]);

  const sortedQualities = useMemo(() => {
    return sortData(qualityTypes, qualitiesSortKey, qualitiesSortDirection);
  }, [qualityTypes, qualitiesSortKey, qualitiesSortDirection]);

  const paginatedQualities = useMemo(() => {
    return paginateData(sortedQualities, qualitiesCurrentPage, qualitiesPerPage);
  }, [sortedQualities, qualitiesCurrentPage, qualitiesPerPage]);

  return (
    <div className="improved-dashboard">
      {/* Sidebar */}
      <Sidebar
        activePage={activeSection}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      {/* Main Content */}
      <main className="main-content">
        <div className="analytics-header">
          <div className="header-left">
            <div className="header-icon">
              {activeSection === 'inward' && <Icons.Download size={24} />}
              {activeSection === 'program' && <Icons.Package size={24} />}
              {activeSection === 'billing' && <Icons.Billing size={24} />}
              {activeSection === 'settings' && <Icons.Factory size={24} />}
            </div>
            <h1>
              {activeSection === 'inward' && 'Inward Log'}
              {activeSection === 'program' && 'Program Entry'}
              {activeSection === 'billing' && 'Billing & Reports'}
              {activeSection === 'settings' && 'Settings'}
            </h1>
          </div>
          <div className="header-actions">
            {activeSection === 'inward' && (
              <button onClick={() => openInwardModal()} className="btn btn-primary">
                + Add New Lot
              </button>
            )}
            {activeSection === 'program' && (
              <button onClick={() => openProgramModal()} className="btn btn-primary">
                + Add New Program
              </button>
            )}
            {activeSection === 'billing' && (
              <button onClick={() => navigate('/bills-history')} className="btn btn-secondary">
                View Bills History
              </button>
            )}
            <button
              onClick={() => setShowNotifications(true)}
              className="btn-icon notification-bell"
              style={{ position: 'relative', marginLeft: '1rem' }}
            >
              <Icons.Bell size={20} />
              {unreadCount > 0 && (
                <span className="notification-badge">{unreadCount}</span>
              )}
            </button>
          </div>
        </div>

        <div className="content-body">
          <div className="section-content">
            {/* INWARD LOG SECTION */}
            {activeSection === 'inward' && (
              <>
                <div className="card">
                  <div className="card-body">
                    {/* Desktop Table View */}
                    <div className="table-container table-responsive">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th onClick={() => handleSort('lot_number', lotsSortKey, lotsSortDirection, setLotsSortKey, setLotsSortDirection, lots, setLots)} className="sortable-header">
                              Lot Number {renderSortIcon('lot_number', lotsSortKey, lotsSortDirection)}
                            </th>
                            <th onClick={() => handleSort('party_name', lotsSortKey, lotsSortDirection, setLotsSortKey, setLotsSortDirection, lots, setLots)} className="sortable-header">
                              Party {renderSortIcon('party_name', lotsSortKey, lotsSortDirection)}
                            </th>
                            <th onClick={() => handleSort('quality_name', lotsSortKey, lotsSortDirection, setLotsSortKey, setLotsSortDirection, lots, setLots)} className="sortable-header">
                              Quality {renderSortIcon('quality_name', lotsSortKey, lotsSortDirection)}
                            </th>
                            <th onClick={() => handleSort('total_meters', lotsSortKey, lotsSortDirection, setLotsSortKey, setLotsSortDirection, lots, setLots)} className="sortable-header">
                              Total Meters {renderSortIcon('total_meters', lotsSortKey, lotsSortDirection)}
                            </th>
                            <th onClick={() => handleSort('current_balance', lotsSortKey, lotsSortDirection, setLotsSortKey, setLotsSortDirection, lots, setLots)} className="sortable-header">
                              Balance {renderSortIcon('current_balance', lotsSortKey, lotsSortDirection)}
                            </th>
                            <th onClick={() => handleSort('fiscal_year', lotsSortKey, lotsSortDirection, setLotsSortKey, setLotsSortDirection, lots, setLots)} className="sortable-header">
                              Fiscal Year {renderSortIcon('fiscal_year', lotsSortKey, lotsSortDirection)}
                            </th>
                            <th onClick={() => handleSort('lr_number', lotsSortKey, lotsSortDirection, setLotsSortKey, setLotsSortDirection, lots, setLots)} className="sortable-header">
                              LR Number {renderSortIcon('lr_number', lotsSortKey, lotsSortDirection)}
                            </th>
                            <th onClick={() => handleSort('created_at', lotsSortKey, lotsSortDirection, setLotsSortKey, setLotsSortDirection, lots, setLots)} className="sortable-header">
                              Created {renderSortIcon('created_at', lotsSortKey, lotsSortDirection)}
                            </th>
                            <th onClick={() => handleSort('updated_at', lotsSortKey, lotsSortDirection, setLotsSortKey, setLotsSortDirection, lots, setLots)} className="sortable-header">
                              Updated {renderSortIcon('updated_at', lotsSortKey, lotsSortDirection)}
                            </th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedLots.length === 0 ? (
                            <tr>
                              <td colSpan="10" className="text-center">
                                No inward lots found. Click "Add New Lot" to create one.
                              </td>
                            </tr>
                          ) : (
                            paginatedLots.map((lot) => (
                              <tr key={lot.id}>
                                <td>{lot.lot_number}</td>
                                <td>{lot.party_name}</td>
                                <td>{lot.quality_name}</td>
                                <td>{parseFloat(lot.total_meters).toFixed(2)}m</td>
                                <td>
                                  {parseFloat(lot.current_balance).toFixed(2)}m
                                  <span className="text-muted text-sm">
                                    {' '}({lot.balance_percentage ? parseFloat(lot.balance_percentage).toFixed(1) : '0.0'}%)
                                  </span>
                                </td>
                                <td>{lot.fiscal_year}</td>
                                <td>{lot.lr_number || '-'}</td>
                                <td>{format(new Date(lot.created_at), 'dd MMM yyyy')}</td>
                                <td>{format(new Date(lot.updated_at), 'dd MMM yyyy HH:mm')}</td>
                                <td>
                                  <button
                                    onClick={() => openInwardModal(lot)}
                                    className="btn btn-sm btn-secondary"
                                    title="Edit"
                                  >
                                    Edit
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Controls */}
                    {renderPaginationControls(lotsCurrentPage, setLotsCurrentPage, sortedLots.length, lotsPerPage)}

                    {/* Mobile Card View */}
                    <div className="card-view">
                      {paginatedLots.length === 0 ? (
                        <div className="text-center" style={{ padding: '2rem' }}>
                          No inward lots found. Click "Add New Lot" to create one.
                        </div>
                      ) : (
                        paginatedLots.map((lot) => (
                          <div key={lot.id} className="data-card">
                            <div className="data-card-row">
                              <span className="data-card-label">Lot Number</span>
                              <strong className="data-card-value">{lot.lot_number}</strong>
                            </div>
                            <div className="data-card-row">
                              <span className="data-card-label">Party</span>
                              <span className="data-card-value">{lot.party_name}</span>
                            </div>
                            <div className="data-card-row">
                              <span className="data-card-label">Quality</span>
                              <span className="data-card-value">{lot.quality_name}</span>
                            </div>
                            <div className="data-card-row">
                              <span className="data-card-label">Total Meters</span>
                              <span className="data-card-value">{parseFloat(lot.total_meters).toFixed(2)}m</span>
                            </div>
                            <div className="data-card-row">
                              <span className="data-card-label">Balance</span>
                              <span className="data-card-value">
                                {parseFloat(lot.current_balance).toFixed(2)}m
                                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginLeft: '0.25rem' }}>
                                  ({lot.balance_percentage ? parseFloat(lot.balance_percentage).toFixed(1) : '0.0'}%)
                                </span>
                              </span>
                            </div>
                            <div className="data-card-row">
                              <span className="data-card-label">Fiscal Year</span>
                              <span className="data-card-value">{lot.fiscal_year}</span>
                            </div>
                            <div className="data-card-row">
                              <span className="data-card-label">LR Number</span>
                              <span className="data-card-value">{lot.lr_number || '-'}</span>
                            </div>
                            <div className="data-card-row">
                              <span className="data-card-label">Created</span>
                              <span className="data-card-value">{format(new Date(lot.created_at), 'dd MMM yyyy')}</span>
                            </div>
                            <div className="data-card-row">
                              <span className="data-card-label">Updated</span>
                              <span className="data-card-value">{format(new Date(lot.updated_at), 'dd MMM yyyy HH:mm')}</span>
                            </div>
                            <div className="data-card-actions">
                              <button
                                onClick={() => openInwardModal(lot)}
                                className="btn btn-sm btn-secondary"
                              >
                                Edit Lot
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* PROGRAM ENTRY SECTION */}
            {activeSection === 'program' && (
              <>
                <div className="card">
                  <div className="card-body">
                    {/* Desktop Table View */}
                    <div className="table-container table-responsive">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th onClick={() => handleSort('program_number', programsSortKey, programsSortDirection, setProgramsSortKey, setProgramsSortDirection, programs, setPrograms)} className="sortable-header">
                              Program Number {renderSortIcon('program_number', programsSortKey, programsSortDirection)}
                            </th>
                            <th onClick={() => handleSort('design_number', programsSortKey, programsSortDirection, setProgramsSortKey, setProgramsSortDirection, programs, setPrograms)} className="sortable-header">
                              Design Number {renderSortIcon('design_number', programsSortKey, programsSortDirection)}
                            </th>
                            <th onClick={() => handleSort('challan_no', programsSortKey, programsSortDirection, setProgramsSortKey, setProgramsSortDirection, programs, setPrograms)} className="sortable-header">
                              Challan No. {renderSortIcon('challan_no', programsSortKey, programsSortDirection)}
                            </th>
                            <th onClick={() => handleSort('input_meters', programsSortKey, programsSortDirection, setProgramsSortKey, setProgramsSortDirection, programs, setPrograms)} className="sortable-header">
                              Input Meters {renderSortIcon('input_meters', programsSortKey, programsSortDirection)}
                            </th>
                            <th onClick={() => handleSort('output_meters', programsSortKey, programsSortDirection, setProgramsSortKey, setProgramsSortDirection, programs, setPrograms)} className="sortable-header">
                              Output Meters {renderSortIcon('output_meters', programsSortKey, programsSortDirection)}
                            </th>
                            <th onClick={() => handleSort('wastage_percentage', programsSortKey, programsSortDirection, setProgramsSortKey, setProgramsSortDirection, programs, setPrograms)} className="sortable-header">
                              Wastage % {renderSortIcon('wastage_percentage', programsSortKey, programsSortDirection)}
                            </th>
                            <th onClick={() => handleSort('status', programsSortKey, programsSortDirection, setProgramsSortKey, setProgramsSortDirection, programs, setPrograms)} className="sortable-header">
                              Status {renderSortIcon('status', programsSortKey, programsSortDirection)}
                            </th>
                            <th onClick={() => handleSort('created_at', programsSortKey, programsSortDirection, setProgramsSortKey, setProgramsSortDirection, programs, setPrograms)} className="sortable-header">
                              Created {renderSortIcon('created_at', programsSortKey, programsSortDirection)}
                            </th>
                            <th onClick={() => handleSort('updated_at', programsSortKey, programsSortDirection, setProgramsSortKey, setProgramsSortDirection, programs, setPrograms)} className="sortable-header">
                              Updated {renderSortIcon('updated_at', programsSortKey, programsSortDirection)}
                            </th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedPrograms.length === 0 ? (
                            <tr>
                              <td colSpan="9" className="text-center">
                                No programs found. Click "Add New Program" to create one.
                              </td>
                            </tr>
                          ) : (
                            paginatedPrograms.map((program) => (
                              <tr key={program.id}>
                                <td>
                                  <span
                                    className="program-number-link"
                                    onClick={() => openProgramDetailView(program)}
                                  >
                                    {program.program_number}
                                  </span>
                                </td>
                                <td>{program.design_number}</td>
                                <td>{program.challan_no || '-'}</td>
                                <td>{parseFloat(program.input_meters).toFixed(2)}m</td>
                                <td>{parseFloat(program.output_meters || 0).toFixed(2)}m</td>
                                <td>
                                  <span className={program.is_wastage_high ? 'text-danger' : ''}>
                                    {program.wastage_percentage ? parseFloat(program.wastage_percentage).toFixed(2) : '0.00'}%
                                  </span>
                                </td>
                                <td>
                                  <span className={`badge badge-${program.status === 'Completed' ? 'completed' : 'pending'}`}>
                                    {program.status}
                                  </span>
                                </td>
                                <td>{format(new Date(program.created_at), 'dd MMM yyyy')}</td>
                                <td>{format(new Date(program.updated_at), 'dd MMM yyyy HH:mm')}</td>
                                <td>
                                  <button
                                    onClick={() => openProgramModal(program)}
                                    className="btn btn-sm btn-secondary"
                                    title="Edit"
                                  >
                                    Edit
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Controls */}
                    {renderPaginationControls(programsCurrentPage, setProgramsCurrentPage, sortedPrograms.length, programsPerPage)}

                    {/* Mobile Card View */}
                    <div className="card-view">
                      {paginatedPrograms.length === 0 ? (
                        <div className="text-center" style={{ padding: '2rem' }}>
                          No programs found. Click "Add New Program" to create one.
                        </div>
                      ) : (
                        paginatedPrograms.map((program) => (
                          <div key={program.id} className="data-card">
                            <div className="data-card-row">
                              <span className="data-card-label">Program Number</span>
                              <strong className="data-card-value program-number-link" onClick={() => openProgramDetailView(program)}>
                                {program.program_number}
                              </strong>
                            </div>
                            <div className="data-card-row">
                              <span className="data-card-label">Design Number</span>
                              <span className="data-card-value">{program.design_number}</span>
                            </div>
                            <div className="data-card-row">
                              <span className="data-card-label">Challan No.</span>
                              <span className="data-card-value">{program.challan_no || '-'}</span>
                            </div>
                            <div className="data-card-row">
                              <span className="data-card-label">Input Meters</span>
                              <span className="data-card-value">{parseFloat(program.input_meters).toFixed(2)}m</span>
                            </div>
                            <div className="data-card-row">
                              <span className="data-card-label">Output Meters</span>
                              <span className="data-card-value">{parseFloat(program.output_meters || 0).toFixed(2)}m</span>
                            </div>
                            <div className="data-card-row">
                              <span className="data-card-label">Wastage %</span>
                              <span className={`data-card-value ${program.is_wastage_high ? 'text-danger' : ''}`}>
                                {program.wastage_percentage ? parseFloat(program.wastage_percentage).toFixed(2) : '0.00'}%
                              </span>
                            </div>
                            <div className="data-card-row">
                              <span className="data-card-label">Status</span>
                              <span className={`badge badge-${program.status === 'Completed' ? 'completed' : 'pending'}`}>
                                {program.status}
                              </span>
                            </div>
                            <div className="data-card-row">
                              <span className="data-card-label">Created</span>
                              <span className="data-card-value">{format(new Date(program.created_at), 'dd MMM yyyy')}</span>
                            </div>
                            <div className="data-card-row">
                              <span className="data-card-label">Updated</span>
                              <span className="data-card-value">{format(new Date(program.updated_at), 'dd MMM yyyy HH:mm')}</span>
                            </div>
                            <div className="data-card-actions">
                              <button
                                onClick={() => openProgramModal(program)}
                                className="btn btn-sm btn-secondary"
                              >
                                Edit Program
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* BILLING SECTION */}
            {activeSection === 'billing' && (
              <>
                <div className="card">
                  <div className="card-body">
                    <div className="form-row">
                      <div className="form-group">
                        <label>Filter by Party (Optional)</label>
                        <select
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
                        <small className="help-text" style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                          Select a party to filter programs, or leave as "All Parties" to see everything
                        </small>
                      </div>

                      <div className="form-group">
                        <label>Status Filter</label>
                        <select
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
                          disabled={loading}
                        >
                          <option value="Completed">Completed</option>
                          <option value="Pending">Pending</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Quality Type</label>
                        <select
                          value={selectedQualityType}
                          onChange={(e) => setSelectedQualityType(e.target.value)}
                          disabled={loading}
                        >
                          <option value="">All Quality Types</option>
                          {qualityTypes.map((quality) => (
                            <option key={quality.id} value={quality.id}>
                              {quality.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Ledger Export Date Inputs Removed */}

                    <div className="action-buttons">
                      <button
                        onClick={handleGenerateBill}
                        disabled={loading || selectedPrograms.length === 0}
                        className="btn btn-primary"
                      >
                        Generate Bill ({selectedPrograms.length} programs)
                      </button>
                      <button
                        onClick={handleOpenLedgerModal}
                        disabled={loading}
                        className="btn btn-success"
                        title="Export comprehensive ledger for all parties"
                      >
                        <Icons.Download size={16} /> Export Comprehensive Ledger
                      </button>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-body">
                    {/* Select All Checkbox - Mobile Only */}
                    <div className="mobile-only" style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPrograms(filteredPrograms.map((p) => p.id));
                            } else {
                              setSelectedPrograms([]);
                            }
                          }}
                          checked={
                            filteredPrograms.length > 0 &&
                            selectedPrograms.length === filteredPrograms.length
                          }
                        />
                        <span style={{ fontWeight: '600' }}>Select All Programs ({filteredPrograms.length})</span>
                      </label>
                    </div>

                    {/* Desktop Table View */}
                    <div className="table-container table-responsive">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>
                              <input
                                type="checkbox"
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedPrograms(filteredPrograms.map((p) => p.id));
                                  } else {
                                    setSelectedPrograms([]);
                                  }
                                }}
                                checked={
                                  filteredPrograms.length > 0 &&
                                  selectedPrograms.length === filteredPrograms.length
                                }
                              />
                            </th>
                            <th onClick={() => { setBillingProgramsSortKey('program_number'); setBillingProgramsSortDirection(toggleSortDirection(billingProgramsSortKey, 'program_number', billingProgramsSortDirection)); setBillingCurrentPage(1); }} className="sortable-header">
                              Program Number {renderSortIcon('program_number', billingProgramsSortKey, billingProgramsSortDirection)}
                            </th>
                            <th onClick={() => { setBillingProgramsSortKey('design_number'); setBillingProgramsSortDirection(toggleSortDirection(billingProgramsSortKey, 'design_number', billingProgramsSortDirection)); setBillingCurrentPage(1); }} className="sortable-header">
                              Design Number {renderSortIcon('design_number', billingProgramsSortKey, billingProgramsSortDirection)}
                            </th>
                            <th onClick={() => { setBillingProgramsSortKey('challan_no'); setBillingProgramsSortDirection(toggleSortDirection(billingProgramsSortKey, 'challan_no', billingProgramsSortDirection)); setBillingCurrentPage(1); }} className="sortable-header">
                              Challan No. {renderSortIcon('challan_no', billingProgramsSortKey, billingProgramsSortDirection)}
                            </th>
                            <th onClick={() => { setBillingProgramsSortKey('is_billed'); setBillingProgramsSortDirection(toggleSortDirection(billingProgramsSortKey, 'is_billed', billingProgramsSortDirection)); setBillingCurrentPage(1); }} className="sortable-header">
                              Billing Status {renderSortIcon('is_billed', billingProgramsSortKey, billingProgramsSortDirection)}
                            </th>
                            <th>Quality Type</th>
                            <th>GST Status</th>
                            <th onClick={() => { setBillingProgramsSortKey('output_meters'); setBillingProgramsSortDirection(toggleSortDirection(billingProgramsSortKey, 'output_meters', billingProgramsSortDirection)); setBillingCurrentPage(1); }} className="sortable-header">
                              Output Meters {renderSortIcon('output_meters', billingProgramsSortKey, billingProgramsSortDirection)}
                            </th>
                            <th onClick={() => { setBillingProgramsSortKey('rate_per_meter'); setBillingProgramsSortDirection(toggleSortDirection(billingProgramsSortKey, 'rate_per_meter', billingProgramsSortDirection)); setBillingCurrentPage(1); }} className="sortable-header">
                              Rate/Meter {renderSortIcon('rate_per_meter', billingProgramsSortKey, billingProgramsSortDirection)}
                            </th>
                            <th onClick={() => { setBillingProgramsSortKey('total_amount'); setBillingProgramsSortDirection(toggleSortDirection(billingProgramsSortKey, 'total_amount', billingProgramsSortDirection)); setBillingCurrentPage(1); }} className="sortable-header">
                              Total Amount {renderSortIcon('total_amount', billingProgramsSortKey, billingProgramsSortDirection)}
                            </th>
                            <th onClick={() => { setBillingProgramsSortKey('created_at'); setBillingProgramsSortDirection(toggleSortDirection(billingProgramsSortKey, 'created_at', billingProgramsSortDirection)); setBillingCurrentPage(1); }} className="sortable-header">
                              Created {renderSortIcon('created_at', billingProgramsSortKey, billingProgramsSortDirection)}
                            </th>
                            <th onClick={() => { setBillingProgramsSortKey('updated_at'); setBillingProgramsSortDirection(toggleSortDirection(billingProgramsSortKey, 'updated_at', billingProgramsSortDirection)); setBillingCurrentPage(1); }} className="sortable-header">
                              Updated {renderSortIcon('updated_at', billingProgramsSortKey, billingProgramsSortDirection)}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedBillingPrograms.length === 0 ? (
                            <tr>
                              <td colSpan="11" className="text-center">
                                No programs found for selected filters.
                              </td>
                            </tr>
                          ) : (
                            paginatedBillingPrograms.map((program) => (
                              <tr key={program.id}>
                                <td>
                                  <input
                                    type="checkbox"
                                    checked={selectedPrograms.includes(program.id)}
                                    onChange={() => handleProgramSelection(program.id)}
                                  />
                                </td>
                                <td>
                                  <span
                                    className="program-number-link"
                                    onClick={() => openProgramDetailView(program)}
                                  >
                                    {program.program_number}
                                  </span>
                                </td>
                                <td>{program.design_number}</td>
                                <td>{program.challan_no || '-'}</td>
                                <td>
                                  {program.is_billed ? (
                                    <span style={{
                                      fontSize: '0.75rem',
                                      padding: '4px 8px',
                                      borderRadius: '4px',
                                      backgroundColor: '#10b981',
                                      color: 'white',
                                      fontWeight: '600',
                                      whiteSpace: 'nowrap',
                                      display: 'inline-block'
                                    }} title={`Billed in ${program.bill_number}`}>
                                      ✓ Billed ({program.bill_number})
                                    </span>
                                  ) : (
                                    <span style={{
                                      fontSize: '0.75rem',
                                      padding: '4px 8px',
                                      borderRadius: '4px',
                                      backgroundColor: '#f59e0b',
                                      color: 'white',
                                      fontWeight: '600',
                                      whiteSpace: 'nowrap',
                                      display: 'inline-block'
                                    }}>
                                      ⚠ Not Billed
                                    </span>
                                  )}
                                </td>
                                <td>
                                  {program.lot_allocations && program.lot_allocations.length > 0 ? (() => {
                                    const firstAllocation = program.lot_allocations[0];
                                    const lot = lots.find((lot) => lot.id === firstAllocation.lot);
                                    if (lot) {
                                      const quality = qualityTypes.find((q) => q.id === lot.quality_type);
                                      return quality ? quality.name : 'N/A';
                                    }
                                    return 'N/A';
                                  })() : 'N/A'}
                                </td>
                                <td>
                                  {(() => {
                                    const gstin = program.is_gstin_registered;
                                    return (
                                      <span style={{
                                        backgroundColor: gstin ? '#28a745' : '#6c757d',
                                        color: 'white',
                                        padding: '3px 8px',
                                        borderRadius: '3px',
                                        fontSize: '11px',
                                        fontWeight: 'bold'
                                      }}>
                                        {gstin ? 'GST' : 'Non-GST'}
                                      </span>
                                    );
                                  })()}
                                </td>
                                <td>{parseFloat(program.output_meters).toFixed(2)}m</td>
                                <td>₹{parseFloat(program.rate_per_meter || 0).toFixed(2)}</td>
                                <td>₹{parseFloat(program.total_amount || 0).toFixed(2)}</td>
                                <td>{format(new Date(program.created_at), 'dd MMM yyyy')}</td>
                                <td>{format(new Date(program.updated_at), 'dd MMM yyyy HH:mm')}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Controls */}
                    {renderPaginationControls(billingCurrentPage, setBillingCurrentPage, filteredPrograms.length, billingPerPage)}

                    {/* Mobile Card View */}
                    <div className="card-view">
                      {paginatedBillingPrograms.length === 0 ? (
                        <div className="text-center" style={{ padding: '2rem' }}>
                          No programs found for selected filters.
                        </div>
                      ) : (
                        paginatedBillingPrograms.map((program) => (
                          <div key={program.id} className="data-card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--bg-muted)' }}>
                              <input
                                type="checkbox"
                                checked={selectedPrograms.includes(program.id)}
                                onChange={() => handleProgramSelection(program.id)}
                                style={{ minWidth: '24px', minHeight: '24px' }}
                              />
                              <strong className="program-number-link" onClick={() => openProgramDetailView(program)} style={{ fontSize: '1.125rem' }}>
                                {program.program_number}
                              </strong>
                            </div>
                            <div className="data-card-row">
                              <span className="data-card-label">Billing Status</span>
                              <span className="data-card-value">
                                {program.is_billed ? (
                                  <span style={{
                                    fontSize: '0.75rem',
                                    padding: '4px 10px',
                                    borderRadius: '4px',
                                    backgroundColor: '#10b981',
                                    color: 'white',
                                    fontWeight: '600',
                                    whiteSpace: 'nowrap',
                                    display: 'inline-block'
                                  }}>
                                    ✓ Billed ({program.bill_number})
                                  </span>
                                ) : (
                                  <span style={{
                                    fontSize: '0.75rem',
                                    padding: '4px 10px',
                                    borderRadius: '4px',
                                    backgroundColor: '#f59e0b',
                                    color: 'white',
                                    fontWeight: '600',
                                    whiteSpace: 'nowrap',
                                    display: 'inline-block'
                                  }}>
                                    ⚠ Not Billed
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className="data-card-row">
                              <span className="data-card-label">Design Number</span>
                              <span className="data-card-value">{program.design_number}</span>
                            </div>
                            <div className="data-card-row">
                              <span className="data-card-label">Challan No.</span>
                              <span className="data-card-value">{program.challan_no || '-'}</span>
                            </div>
                            <div className="data-card-row">
                              <span className="data-card-label">Quality Type</span>
                              <span className="data-card-value">
                                {program.lot_allocations && program.lot_allocations.length > 0 ? (() => {
                                  const firstAllocation = program.lot_allocations[0];
                                  const lot = lots.find((lot) => lot.id === firstAllocation.lot);
                                  if (lot) {
                                    const quality = qualityTypes.find((q) => q.id === lot.quality_type);
                                    return quality ? quality.name : 'N/A';
                                  }
                                  return 'N/A';
                                })() : 'N/A'}
                              </span>
                            </div>
                            <div className="data-card-row">
                              <span className="data-card-label">GST Status</span>
                              <span className="data-card-value">
                                {(() => {
                                  const gstin = program.is_gstin_registered;
                                  return (
                                    <span style={{
                                      backgroundColor: gstin ? '#28a745' : '#6c757d',
                                      color: 'white',
                                      padding: '3px 8px',
                                      borderRadius: '3px',
                                      fontSize: '11px',
                                      fontWeight: 'bold'
                                    }}>
                                      {gstin ? 'GST' : 'Non-GST'}
                                    </span>
                                  );
                                })()}
                              </span>
                            </div>
                            <div className="data-card-row">
                              <span className="data-card-label">Output Meters</span>
                              <span className="data-card-value">{parseFloat(program.output_meters).toFixed(2)}m</span>
                            </div>
                            <div className="data-card-row">
                              <span className="data-card-label">Rate per Meter</span>
                              <strong className="data-card-value">₹{parseFloat(program.rate_per_meter || 0).toFixed(2)}</strong>
                            </div>
                            <div className="data-card-row">
                              <span className="data-card-label">Total Amount</span>
                              <strong className="data-card-value" style={{ fontSize: '1.125rem', color: 'var(--color-primary)' }}>
                                ₹{parseFloat(program.total_amount || 0).toFixed(2)}
                              </strong>
                            </div>
                            <div className="data-card-row">
                              <span className="data-card-label">Created</span>
                              <span className="data-card-value">{format(new Date(program.created_at), 'dd MMM yyyy')}</span>
                            </div>
                            <div className="data-card-row">
                              <span className="data-card-label">Updated</span>
                              <span className="data-card-value">{format(new Date(program.updated_at), 'dd MMM yyyy HH:mm')}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* SETTINGS SECTION */}
            {activeSection === 'settings' && (
              <>
                {/* Parties */}
                <div className="card">
                  <div className="table-section-header">
                    <div className="table-section-header-content">
                      <h3>Parties</h3>
                      <p>Manage business partners and clients</p>
                    </div>
                    <button onClick={() => openPartyModal()} className="btn btn-primary">
                      + Add Party
                    </button>
                  </div>
                  <div className="card-body">
                    {/* Desktop Table View */}
                    <div className="table-container table-responsive">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th onClick={() => handleSort('name', partiesSortKey, partiesSortDirection, setPartiesSortKey, setPartiesSortDirection, parties, setParties)} className="sortable-header">
                              Name {renderSortIcon('name', partiesSortKey, partiesSortDirection)}
                            </th>
                            <th onClick={() => handleSort('contact', partiesSortKey, partiesSortDirection, setPartiesSortKey, setPartiesSortDirection, parties, setParties)} className="sortable-header">
                              Contact{renderSortIcon('contact', partiesSortKey, partiesSortDirection)}
                            </th>
                            <th>Custom Rates</th>
                            <th onClick={() => handleSort('created_at', partiesSortKey, partiesSortDirection, setPartiesSortKey, setPartiesSortDirection, parties, setParties)} className="sortable-header">
                              Created {renderSortIcon('created_at', partiesSortKey, partiesSortDirection)}
                            </th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedParties.length === 0 ? (
                            <tr>
                              <td colSpan="5" className="text-center">
                                No parties found. Click "Add New Party" to create one.
                              </td>
                            </tr>
                          ) : (
                            paginatedParties.map((party) => (
                              <tr key={party.id}>
                                <td><strong>{party.name}</strong></td>
                                <td>{party.contact || '-'}</td>
                                <td>
                                  <button
                                    onClick={() => openCustomRatesModal(party)}
                                    className="btn btn-sm btn-info"
                                    title="Manage custom rates"
                                    style={{ fontSize: '0.85rem', padding: '0.25rem 0.75rem' }}
                                  >
                                    Manage Rates
                                  </button>
                                </td>
                                <td>{format(new Date(party.created_at), 'dd MMM yyyy')}</td>
                                <td>
                                  <div className="button-group">
                                    <button
                                      onClick={() => openPartyModal(party)}
                                      className="btn btn-sm btn-secondary"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeleteParty(party.id)}
                                      className="btn btn-sm btn-danger"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Controls */}
                    {renderPaginationControls(partiesCurrentPage, setPartiesCurrentPage, sortedParties.length, partiesPerPage)}

                    {/* Mobile Card View */}
                    <div className="card-view">
                      {paginatedParties.length === 0 ? (
                        <div className="text-center" style={{ padding: '2rem' }}>
                          No parties found. Click "Add Party" to create one.
                        </div>
                      ) : (
                        paginatedParties.map((party) => (
                          <div key={party.id} className="data-card">
                            <div className="data-card-row">
                              <span className="data-card-label">Party Name</span>
                              <strong className="data-card-value">{party.name}</strong>
                            </div>
                            <div className="data-card-row">
                              <span className="data-card-label">Contact</span>
                              <span className="data-card-value">{party.contact || '-'}</span>
                            </div>
                            <div className="data-card-row">
                              <span className="data-card-label">Address</span>
                              <span className="data-card-value">{party.address || '-'}</span>
                            </div>
                            <div className="data-card-row">
                              <span className="data-card-label">Created</span>
                              <span className="data-card-value">{format(new Date(party.created_at), 'dd MMM yyyy')}</span>
                            </div>
                            <div className="data-card-row">
                              <span className="data-card-label">Updated</span>
                              <span className="data-card-value">{format(new Date(party.updated_at), 'dd MMM yyyy HH:mm')}</span>
                            </div>
                            <div className="data-card-actions">
                              <button
                                onClick={() => openCustomRatesModal(party)}
                                className="btn btn-sm btn-info"
                                style={{ flex: 1 }}
                              >
                                Manage Rates
                              </button>
                              <button
                                onClick={() => openPartyModal(party)}
                                className="btn btn-sm btn-secondary"
                                style={{ flex: 1 }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteParty(party.id)}
                                className="btn btn-sm btn-danger"
                                style={{ flex: 1 }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Quality Types */}
                <div className="card">
                  <div className="table-section-header">
                    <div className="table-section-header-content">
                      <h3>Quality Types</h3>
                      <p>Define fabric quality types and default rates</p>
                    </div>
                    <button onClick={() => openQualityModal()} className="btn btn-primary">
                      + Add Quality
                    </button>
                  </div>
                  <div className="card-body">
                    {/* Desktop Table View */}
                    <div className="table-container table-responsive">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th onClick={() => handleSort('name', qualitiesSortKey, qualitiesSortDirection, setQualitiesSortKey, setQualitiesSortDirection, qualityTypes, setQualityTypes)} className="sortable-header">
                              Name {renderSortIcon('name', qualitiesSortKey, qualitiesSortDirection)}
                            </th>
                            <th onClick={() => handleSort('default_rate_per_meter', qualitiesSortKey, qualitiesSortDirection, setQualitiesSortKey, setQualitiesSortDirection, qualityTypes, setQualityTypes)} className="sortable-header">
                              Default Rate (₹/m) {renderSortIcon('default_rate_per_meter', qualitiesSortKey, qualitiesSortDirection)}
                            </th>
                            <th onClick={() => handleSort('created_at', qualitiesSortKey, qualitiesSortDirection, setQualitiesSortKey, setQualitiesSortDirection, qualityTypes, setQualityTypes)} className="sortable-header">
                              Created {renderSortIcon('created_at', qualitiesSortKey, qualitiesSortDirection)}
                            </th>
                            <th onClick={() => handleSort('updated_at', qualitiesSortKey, qualitiesSortDirection, setQualitiesSortKey, setQualitiesSortDirection, qualityTypes, setQualityTypes)} className="sortable-header">
                              Updated {renderSortIcon('updated_at', qualitiesSortKey, qualitiesSortDirection)}
                            </th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedQualities.length === 0 ? (
                            <tr>
                              <td colSpan="5" className="text-center">
                                No quality types found. Click "Add New Quality Type" to create one.
                              </td>
                            </tr>
                          ) : (
                            paginatedQualities.map((quality) => (
                              <tr key={quality.id}>
                                <td><strong>{quality.name}</strong></td>
                                <td>₹{parseFloat(quality.default_rate_per_meter).toFixed(2)}</td>
                                <td>{format(new Date(quality.created_at), 'dd MMM yyyy')}</td>
                                <td>{format(new Date(quality.updated_at), 'dd MMM yyyy HH:mm')}</td>
                                <td>
                                  <div className="button-group">
                                    <button
                                      onClick={() => openQualityModal(quality)}
                                      className="btn btn-sm btn-secondary"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeleteQuality(quality.id)}
                                      className="btn btn-sm btn-danger"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Controls */}
                    {renderPaginationControls(qualitiesCurrentPage, setQualitiesCurrentPage, sortedQualities.length, qualitiesPerPage)}

                    {/* Mobile Card View */}
                    <div className="card-view">
                      {paginatedQualities.length === 0 ? (
                        <div className="text-center" style={{ padding: '2rem' }}>
                          No quality types found. Click "Add Quality" to create one.
                        </div>
                      ) : (
                        paginatedQualities.map((quality) => (
                          <div key={quality.id} className="data-card">
                            <div className="data-card-row">
                              <span className="data-card-label">Quality Name</span>
                              <strong className="data-card-value">{quality.name}</strong>
                            </div>
                            <div className="data-card-row">
                              <span className="data-card-label">Default Rate</span>
                              <strong className="data-card-value">₹{parseFloat(quality.default_rate_per_meter).toFixed(2)}/m</strong>
                            </div>
                            <div className="data-card-row">
                              <span className="data-card-label">Created</span>
                              <span className="data-card-value">{format(new Date(quality.created_at), 'dd MMM yyyy')}</span>
                            </div>
                            <div className="data-card-row">
                              <span className="data-card-label">Updated</span>
                              <span className="data-card-value">{format(new Date(quality.updated_at), 'dd MMM yyyy HH:mm')}</span>
                            </div>
                            <div className="data-card-actions">
                              <button
                                onClick={() => openQualityModal(quality)}
                                className="btn btn-sm btn-secondary"
                                style={{ flex: 1 }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteQuality(quality.id)}
                                className="btn btn-sm btn-danger"
                                style={{ flex: 1 }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* MODALS */}

      {/* Inward Lot Modal */}
      <Modal
        isOpen={showInwardModal}
        onClose={() => setShowInwardModal(false)}
        title={editingInward ? 'Edit Inward Lot' : 'Add New Inward Lot'}
        size="medium"
      >
        <form onSubmit={handleInwardSubmit} className="form">
          <div className="form-group">
            <label>Party *</label>
            <select
              value={inwardFormData.party}
              onChange={(e) => setInwardFormData({ ...inwardFormData, party: e.target.value })}
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
            <label>Quality Type *</label>
            <select
              value={inwardFormData.quality_type}
              onChange={(e) => setInwardFormData({ ...inwardFormData, quality_type: e.target.value })}
              required
              disabled={loading}
            >
              <option value="">Select Quality Type</option>
              {qualityTypes.map((quality) => {
                const effectiveRate = getEffectiveRateForDisplay(quality.id);
                const customRate = inwardPartyRates.find(r => r.quality_type === quality.id);
                return (
                  <option key={quality.id} value={quality.id}>
                    {quality.name} (₹{effectiveRate}/m{customRate ? ' - Custom Rate' : ''})
                  </option>
                );
              })}
            </select>
            {inwardFormData.party && (
              <small className="help-text" style={{ color: '#666', marginTop: '0.25rem', display: 'block' }}>
                {inwardPartyRates.length > 0
                  ? 'Showing custom rates for selected party where applicable'
                  : 'No custom rates set for this party, showing default rates'}
              </small>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Total Meters *</label>
              <input
                type="number"
                step="0.01"
                value={inwardFormData.total_meters}
                onChange={(e) => setInwardFormData({ ...inwardFormData, total_meters: e.target.value })}
                required
                disabled={loading}
                placeholder="0.00"
              />
            </div>

            <div className="form-group">
              <label>Fiscal Year *</label>
              <input
                type="number"
                value={inwardFormData.fiscal_year}
                onChange={(e) => setInwardFormData({ ...inwardFormData, fiscal_year: e.target.value })}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={inwardFormData.is_gstin_registered || false}
                onChange={(e) => setInwardFormData({
                  ...inwardFormData,
                  is_gstin_registered: e.target.checked
                })}
                disabled={loading}
              />
              <span style={{ marginLeft: '10px' }}>GSTIN Registered Transaction</span>
            </label>
          </div>

          <div className="form-group">
            <label>LR Number</label>
            <input
              type="text"
              value={inwardFormData.lr_number}
              onChange={(e) => setInwardFormData({ ...inwardFormData, lr_number: e.target.value })}
              disabled={loading}
              placeholder="Enter LR (Lorry Receipt) Number"
            />
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea
              value={inwardFormData.notes}
              onChange={(e) => setInwardFormData({ ...inwardFormData, notes: e.target.value })}
              disabled={loading}
              rows="3"
            />
          </div>

          <div className="button-group">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : editingInward ? 'Update Lot' : 'Create Lot'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowInwardModal(false)}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Program Modal */}
      <Modal
        isOpen={showProgramModal}
        onClose={() => setShowProgramModal(false)}
        title={editingProgram ? 'Edit Program' : 'Add New Program'}
        size="large"
      >
        <form onSubmit={handleProgramSubmit} className="form">
          <div className="form-group">
            <label>Party *</label>
            <select
              name="party"
              value={programFormData.party}
              onChange={handleProgramChange}
              required
              disabled={loading || programFormData.status === 'Completed'}
            >
              <option value="">Select Party</option>
              {parties.map((party) => (
                <option key={party.id} value={party.id}>
                  {party.name}
                </option>
              ))}
            </select>
            <small className="help-text">
              Select the party first to filter available lots below
            </small>
          </div>

          {editingProgram && (
            <div className="status-toggle-container" style={{
              margin: '-0.5rem -1.5rem 1.5rem -1.5rem',
              padding: '1rem 1.5rem',
              background: programFormData.status === 'Completed' ? '#d4edda' : '#fff3cd',
              borderBottom: '2px solid' + (programFormData.status === 'Completed' ? '#28a745' : '#ffc107'),
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <strong style={{ fontSize: '1.1em', color: programFormData.status === 'Completed' ? '#155724' : '#856404', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {programFormData.status === 'Completed' ? <><Icons.Check size={18} /> Program Completed</> : <><Icons.Clock size={18} /> Program In Progress</>}
                </strong>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85em', color: '#666' }}>
                  {programFormData.status === 'Completed'
                    ? (editingProgram?.is_billed
                        ? `Cannot reopen - included in Bill ${editingProgram.bill_number}`
                        : 'Click Reopen to edit this program')
                    : 'Mark as complete when processing is finished.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  // Check if program is billed before allowing reopen
                  if (editingProgram?.is_billed && programFormData.status === 'Completed') {
                    setError(`Cannot reopen program. It has been included in Bill ${editingProgram.bill_number}. Remove it from the bill first.`);
                    return;
                  }
                  const newStatus = programFormData.status === 'Completed' ? 'Pending' : 'Completed';
                  setProgramFormData({ ...programFormData, status: newStatus });
                }}
                disabled={loading || (editingProgram?.is_billed && programFormData.status === 'Completed')}
                className="btn"
                style={{
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.95em',
                  fontWeight: '600',
                  background: (editingProgram?.is_billed && programFormData.status === 'Completed')
                    ? '#ccc'
                    : (programFormData.status === 'Completed' ? '#ffc107' : '#28a745'),
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: (loading || (editingProgram?.is_billed && programFormData.status === 'Completed')) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  opacity: (editingProgram?.is_billed && programFormData.status === 'Completed') ? 0.6 : 1
                }}
                onMouseOver={(e) => !loading && !(editingProgram?.is_billed && programFormData.status === 'Completed') && (e.target.style.transform = 'translateY(-1px)')}
                onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
              >
                {programFormData.status === 'Completed' ? <><Icons.Refresh size={16} /> Reopen Program</> : <><Icons.Check size={16} /> Mark as Complete</>}
              </button>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label>Design Number</label>
              <input
                type="text"
                name="design_number"
                value={programFormData.design_number}
                onChange={handleProgramChange}
                disabled={loading || programFormData.status === 'Completed'}
                placeholder="Optional"
              />
            </div>

            <div className="form-group">
              <label>Challan No.</label>
              <input
                type="text"
                name="challan_no"
                value={programFormData.challan_no}
                onChange={handleProgramChange}
                disabled={loading || programFormData.status === 'Completed'}
                placeholder="Optional"
                maxLength="100"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Input Meters *</label>
              <input
                type="number"
                step="0.01"
                name="input_meters"
                value={programFormData.input_meters}
                onChange={handleProgramChange}
                required
                disabled={loading || programFormData.status === 'Completed'}
              />
            </div>

            <div className="form-group">
              <label>Output Meters</label>
              <input
                type="number"
                step="0.01"
                name="output_meters"
                value={programFormData.output_meters}
                onChange={handleProgramChange}
                disabled={loading || programFormData.status === 'Completed'}
                placeholder="Optional - can be added later"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Rate Per Meter (₹)</label>
              <input
                type="number"
                step="0.01"
                name="rate_per_meter"
                value={programFormData.rate_per_meter}
                onChange={handleProgramChange}
                disabled={loading || programFormData.status === 'Completed'}
              />
            </div>

            <div className="form-group">
              <label>Tax Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                name="tax_amount"
                value={programFormData.tax_amount}
                onChange={handleProgramChange}
                disabled={loading || programFormData.status === 'Completed'}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Lot Allocations *</label>
            <small className="help-text">
              Total: {totalAllocated.toFixed(2)}m
              {programFormData.input_meters && (
                <span className={Math.abs(totalAllocated - parseFloat(programFormData.input_meters)) > 0.01 ? 'text-danger' : 'text-success'}>
                  {' '}(Must equal: {parseFloat(programFormData.input_meters).toFixed(2)}m)
                </span>
              )}
            </small>
            {!programFormData.party && (
              <p className="text-warning" style={{ marginBottom: '1rem' }}>
                Please select a party first to see available lots
              </p>
            )}
            {programFormData.party && filteredAvailableLots.length === 0 && (
              <p className="text-warning" style={{ marginBottom: '1rem' }}>
                No available lots found for the selected party
              </p>
            )}
            {programFormData.lot_allocations.map((allocation, index) => (
              <div key={index} className="lot-allocation-row">
                <select
                  value={allocation.lot_id}
                  onChange={(e) => handleLotAllocationChange(index, 'lot_id', e.target.value)}
                  required
                  disabled={loading || programFormData.status === 'Completed' || !programFormData.party}
                >
                  <option value="">Select Lot</option>
                  {filteredAvailableLots.map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      {lot.lot_number} - {lot.party_name} ({lot.quality_name}) - Bal: {parseFloat(lot.current_balance).toFixed(2)}m {lot.is_gstin_registered ? '[GST]' : '[Non-GST]'}
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
                  disabled={loading || programFormData.status === 'Completed'}
                  placeholder="Meters to allocate"
                />
                {programFormData.lot_allocations.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLotAllocation(index)}
                    className="btn btn-sm btn-danger"
                    disabled={loading || programFormData.status === 'Completed'}
                  >
                    <Icons.Close size={16} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addLotAllocation}
              className="btn btn-secondary btn-sm"
              disabled={loading || !programFormData.party || programFormData.status === 'Completed'}
            >
              + Add Another Lot
            </button>
          </div>

          <div className="form-group">
            <label>Design Photo</label>
            {!photoPreview ? (
              <button
                type="button"
                onClick={() => setShowCamera(true)}
                className="btn btn-camera"
                disabled={loading || programFormData.status === 'Completed'}
              >
                ● Capture Photo
              </button>
            ) : (
              <div className="photo-preview">
                <img src={photoPreview} alt="Design Preview" />
                <button
                  type="button"
                  onClick={() => {
                    setPhotoPreview(null);
                    setPhotoFile(null);
                  }}
                  className="btn-remove-photo"
                  disabled={programFormData.status === 'Completed'}
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea
              name="notes"
              value={programFormData.notes}
              onChange={handleProgramChange}
              rows="3"
              disabled={loading || programFormData.status === 'Completed'}
            />
          </div>

          <div className="button-group">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : editingProgram ? 'Update Program' : 'Create Program'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowProgramModal(false)}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Party Modal */}
      <Modal
        isOpen={showPartyModal}
        onClose={() => setShowPartyModal(false)}
        title={editingParty ? 'Edit Party' : 'Add New Party'}
        size="medium"
      >
        <form onSubmit={handlePartySubmit} className="form">
          <div className="form-group">
            <label>Party Name *</label>
            <input
              type="text"
              value={partyFormData.name}
              onChange={(e) => setPartyFormData({ ...partyFormData, name: e.target.value })}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Contact</label>
            <input
              type="text"
              value={partyFormData.contact}
              onChange={(e) => setPartyFormData({ ...partyFormData, contact: e.target.value })}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Address</label>
            <textarea
              value={partyFormData.address}
              onChange={(e) => setPartyFormData({ ...partyFormData, address: e.target.value })}
              disabled={loading}
              rows="3"
            />
          </div>

          <div className="button-group">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : editingParty ? 'Update Party' : 'Create Party'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowPartyModal(false)}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Quality Type Modal */}
      <Modal
        isOpen={showQualityModal}
        onClose={() => setShowQualityModal(false)}
        title={editingQuality ? 'Edit Quality Type' : 'Add New Quality Type'}
        size="medium"
      >
        <form onSubmit={handleQualitySubmit} className="form">
          <div className="form-group">
            <label>Quality Type Name *</label>
            <input
              type="text"
              value={qualityFormData.name}
              onChange={(e) => setQualityFormData({ ...qualityFormData, name: e.target.value })}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Default Rate Per Meter (₹) *</label>
            <input
              type="number"
              step="0.01"
              value={qualityFormData.default_rate_per_meter}
              onChange={(e) => setQualityFormData({ ...qualityFormData, default_rate_per_meter: e.target.value })}
              required
              disabled={loading}
            />
          </div>

          <div className="button-group">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : editingQuality ? 'Update Quality Type' : 'Create Quality Type'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowQualityModal(false)}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Custom Rates Modal */}
      {showCustomRatesModal && selectedPartyForRates && (
        <Modal
          isOpen={showCustomRatesModal}
          onClose={() => setShowCustomRatesModal(false)}
          title={`Custom Rates for ${selectedPartyForRates.name}`}
          size="large"
        >
          <div>
            <p style={{ marginBottom: '1rem', color: '#666' }}>
              Set custom rates for specific quality types. These rates will override the default rates for this party.
            </p>

            {/* Existing Custom Rates */}
            {partyCustomRates.length > 0 && (
              <div style={{ marginBottom: '2rem' }}>
                <h4 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Existing Custom Rates</h4>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Quality Type</th>
                        <th>Custom Rate (₹/m)</th>
                        <th>Notes</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partyCustomRates.map((rate) => (
                        <tr key={rate.id}>
                          <td><strong>{rate.quality_type_name}</strong></td>
                          <td>₹{parseFloat(rate.rate_per_meter).toFixed(2)}</td>
                          <td>{rate.notes || '-'}</td>
                          <td>
                            <button
                              onClick={() => handleDeleteCustomRate(rate.id)}
                              className="btn btn-sm btn-danger"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Add New Custom Rate */}
            <div>
              <h4 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Add New Custom Rate</h4>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.target);
                  const qualityTypeId = formData.get('quality_type');
                  const rate = formData.get('rate');
                  const notes = formData.get('notes');
                  handleAddCustomRate(qualityTypeId, rate, notes);
                  e.target.reset();
                }}
                className="form"
              >
                <div className="form-group">
                  <label>Quality Type *</label>
                  <select name="quality_type" required>
                    <option value="">Select Quality Type</option>
                    {qualityTypes
                      .filter(qt => !partyCustomRates.some(r => r.quality_type === qt.id))
                      .map(quality => (
                        <option key={quality.id} value={quality.id}>
                          {quality.name} (Default: ₹{parseFloat(quality.default_rate_per_meter).toFixed(2)}/m)
                        </option>
                      ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Custom Rate (₹/meter) *</label>
                  <input
                    type="number"
                    name="rate"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="Enter custom rate"
                  />
                </div>

                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    name="notes"
                    rows="2"
                    placeholder="Optional notes about this rate"
                  />
                </div>

                <div className="button-group">
                  <button type="submit" className="btn btn-primary">
                    Add Custom Rate
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowCustomRatesModal(false)}
                  >
                    Close
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Modal>
      )}

      {/* Camera Modal */}
      {
        showCamera && (
          <CameraCapture
            onCapture={handlePhotoCapture}
            onClose={() => setShowCamera(false)}
          />
        )
      }

      <LedgerExportModal
        show={showLedgerModal}
        onClose={() => setShowLedgerModal(false)}
        onExport={executeLedgerExport}
        loading={loading}
      />

      {/* Program Detail View Modal */}
      {showProgramDetailModal && selectedProgramForView && (
        <Modal isOpen={showProgramDetailModal} onClose={() => setShowProgramDetailModal(false)} title="Program Details" size="large">
          <div className="program-detail-view">
            <div className="detail-section">
              <h3>Basic Information</h3>
              <div className="detail-grid">
                <div className="detail-item">
                  <label>Program Number:</label>
                  <strong>{selectedProgramForView.program_number}</strong>
                </div>
                <div className="detail-item">
                  <label>Design Number:</label>
                  <strong>{selectedProgramForView.design_number}</strong>
                </div>
                {selectedProgramForView.challan_no && (
                  <div className="detail-item">
                    <label>Challan No.:</label>
                    <strong>{selectedProgramForView.challan_no}</strong>
                  </div>
                )}
                <div className="detail-item">
                  <label>Status:</label>
                  <span className={`badge badge-${selectedProgramForView.status === 'Completed' ? 'completed' : 'pending'}`}>
                    {selectedProgramForView.status}
                  </span>
                </div>
                <div className="detail-item">
                  <label>Created:</label>
                  <span>{format(new Date(selectedProgramForView.created_at), 'dd MMM yyyy HH:mm')}</span>
                </div>
                <div className="detail-item">
                  <label>Updated:</label>
                  <span>{format(new Date(selectedProgramForView.updated_at), 'dd MMM yyyy HH:mm')}</span>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <h3>Lot Allocations</h3>
              {selectedProgramForView.lot_allocations && selectedProgramForView.lot_allocations.length > 0 ? (
                <div className="lot-allocations-list">
                  {selectedProgramForView.lot_allocations.map((allocation, index) => {
                    const lot = lots.find(l => l.id === allocation.lot);
                    return (
                      <div key={index} className="allocation-item">
                        <span className="allocation-label">Lot {lot?.lot_number || allocation.lot}:</span>
                        <strong>{parseFloat(allocation.allocated_meters).toFixed(2)}m</strong>
                        {lot && <span className="allocation-party">({lot.party_name})</span>}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted">No lot allocations</p>
              )}
            </div>

            <div className="detail-section">
              <h3>Measurements</h3>
              <div className="detail-grid">
                <div className="detail-item">
                  <label>Input Meters:</label>
                  <strong>{parseFloat(selectedProgramForView.input_meters).toFixed(2)}m</strong>
                </div>
                <div className="detail-item">
                  <label>Output Meters:</label>
                  <strong>{parseFloat(selectedProgramForView.output_meters || 0).toFixed(2)}m</strong>
                </div>
                <div className="detail-item">
                  <label>Wastage Meters:</label>
                  <strong>{parseFloat(selectedProgramForView.wastage_meters || 0).toFixed(2)}m</strong>
                </div>
                <div className="detail-item">
                  <label>Wastage Percentage:</label>
                  <span className={selectedProgramForView.is_wastage_high ? 'text-danger' : ''}>
                    <strong>{parseFloat(selectedProgramForView.wastage_percentage || 0).toFixed(2)}%</strong>
                    {selectedProgramForView.is_wastage_high && <span className="badge badge-danger ml-2">High</span>}
                  </span>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <h3>Billing Information</h3>
              <div className="detail-grid">
                <div className="detail-item">
                  <label>Rate per Meter:</label>
                  <strong>₹{parseFloat(selectedProgramForView.rate_per_meter || 0).toFixed(2)}</strong>
                </div>
                <div className="detail-item">
                  <label>Total Amount:</label>
                  <strong>₹{parseFloat(selectedProgramForView.total_amount || 0).toFixed(2)}</strong>
                </div>
              </div>
            </div>

            {selectedProgramForView.design_photo_base64 && (
              <div className="detail-section">
                <h3>Design Photo</h3>
                <div className={`design-photo-container ${imageZoomed ? 'zoomed' : ''}`}>
                  <img
                    src={`data:image/jpeg;base64,${selectedProgramForView.design_photo_base64}`}
                    alt="Design"
                    className="detail-design-photo"
                    onClick={() => setImageZoomed(!imageZoomed)}
                  />
                  {imageZoomed && (
                    <div className="image-zoom-overlay" onClick={() => setImageZoomed(false)}>
                      <img src={`data:image/jpeg;base64,${selectedProgramForView.design_photo_base64}`} alt="Design Zoomed" />
                    </div>
                  )}
                </div>
                <p className="text-muted text-sm" style={{ marginTop: '0.5rem' }}>Click image to {imageZoomed ? 'minimize' : 'expand'}</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Notification Center */}
      <NotificationCenter
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
      />

      {/* Bill Date Selection Modal */}
      <BillDateModal
        isOpen={showBillDateModal}
        onClose={() => setShowBillDateModal(false)}
        onConfirm={handleConfirmBillGeneration}
        loading={loading}
      />
    </div >
  );
};

export default ImprovedDashboard;
