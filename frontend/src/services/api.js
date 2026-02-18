import axios from 'axios';

// Use environment variable if available, fallback to localhost
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Helper to get CSRF token from cookie
const getCsrfToken = () => {
  const name = 'csrftoken';
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
};

// Initialize CSRF token by calling the CSRF endpoint
export const initializeCSRF = async () => {
  try {
    await api.get('/csrf/');
  } catch (error) {
    console.error('Failed to initialize CSRF token:', error);
  }
};

// Request interceptor for authentication and CSRF
api.interceptors.request.use(
  (config) => {
    // Add CSRF token to all non-GET requests
    if (config.method !== 'get') {
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        config.headers['X-CSRFToken'] = csrfToken;
      }
    }

    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Token ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Authentication
export const authAPI = {
  login: (username, password) =>
    api.post('/api-auth/login/', { username, password }),

  logout: () =>
    api.post('/api-auth/logout/'),

  getCurrentUser: () =>
    api.get('/auth/user/'),
};

// Parties
export const partiesAPI = {
  getAll: (params) => api.get('/parties/', { params }),
  getOne: (id) => api.get(`/parties/${id}/`),
  create: (data) => api.post('/parties/', data),
  update: (id, data) => api.put(`/parties/${id}/`, data),
  delete: (id) => api.delete(`/parties/${id}/`),
};

// Quality Types
export const qualityTypesAPI = {
  getAll: (params) => api.get('/quality-types/', { params }),
  getOne: (id) => api.get(`/quality-types/${id}/`),
  create: (data) => api.post('/quality-types/', data),
  update: (id, data) => api.put(`/quality-types/${id}/`, data),
  delete: (id) => api.delete(`/quality-types/${id}/`),
};

// Inward Lots
export const inwardLotsAPI = {
  getAll: (params) => api.get('/inward-lots/', { params }),
  getOne: (id) => api.get(`/inward-lots/${id}/`),
  create: (data) => api.post('/inward-lots/', data),
  update: (id, data) => api.put(`/inward-lots/${id}/`, data),
  getAvailableBalance: (id) => api.get(`/inward-lots/${id}/available_balance/`),
  getAvailableLots: (params) => api.get('/inward-lots/available_lots/', { params }),
};

// Process Programs
export const programsAPI = {
  getAll: (params) => api.get('/programs/', { params }),
  getOne: (id) => api.get(`/programs/${id}/`),
  create: (data) => api.post('/programs/', data),
  update: (id, data) => api.put(`/programs/${id}/`, data),
  uploadPhoto: (id, file) => {
    const formData = new FormData();
    formData.append('photo', file);
    return api.post(`/programs/${id}/upload-photo/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  complete: (id) => api.post(`/programs/${id}/complete/`),
  getHighWastage: () => api.get('/programs/high-wastage/'),
};

// Bills
export const billsAPI = {
  getAll: (params) => api.get('/bills/', { params }),
  getOne: (id) => api.get(`/bills/${id}/`),
  generate: (data) => api.post('/bills/generate/', data, {
    responseType: 'blob',
  }),
  getPDF: (id) => api.get(`/bills/${id}/pdf/`, {
    responseType: 'blob',
  }),
  exportLedger: (params) => api.get('/bills/export-ledger/', {
    params,
    responseType: 'blob',
  }),
  markSent: (id) => api.post(`/bills/${id}/mark_sent/`),
  markPaid: (id) => api.post(`/bills/${id}/mark_paid/`),
  markScrap: (id) => api.post(`/bills/${id}/mark_scrap/`),
};

// Notifications
export const notificationsAPI = {
  getAll: (params) => api.get('/notifications/', { params }),
  getOne: (id) => api.get(`/notifications/${id}/`),
  getUnreadCount: () => api.get('/notifications/unread_count/'),
  markRead: (id) => api.post(`/notifications/${id}/mark_read/`),
  dismiss: (id) => api.post(`/notifications/${id}/dismiss/`),
  markAllRead: () => api.post('/notifications/mark_all_read/'),
};

// System Config
export const configAPI = {
  getAll: () => api.get('/config/'),
  getConfig: (key) => api.get('/config/get_config/', { params: { key } }),
  setConfig: (data) => api.post('/config/set_config/', data),
};

// Rates
export const ratesAPI = {
  getPartyQualityRate: (partyId, qualityTypeId) =>
    api.get('/rates/party-quality/', {
      params: { party_id: partyId, quality_type_id: qualityTypeId }
    }),
};

// Party Quality Rates (Custom Rates)
export const partyRatesAPI = {
  getAll: (params) => api.get('/party-rates/', { params }),
  getOne: (id) => api.get(`/party-rates/${id}/`),
  create: (data) => api.post('/party-rates/', data),
  update: (id, data) => api.put(`/party-rates/${id}/`, data),
  delete: (id) => api.delete(`/party-rates/${id}/`),
  getByParty: (partyId) => api.get('/party-rates/', { params: { party: partyId } }),
};

export default api;
