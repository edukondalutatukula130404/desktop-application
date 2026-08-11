// Centralized Fetch API Client for Backend REST Communications

const API_BASE_URL = '/api';

const TOKEN_KEY = 'nexus_auth_jwt_token';

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY),
  set: (token, remember = true) => {
    if (remember) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      sessionStorage.setItem(TOKEN_KEY, token);
    }
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  }
};

async function request(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  const token = tokenStorage.get();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers
    });

    const data = await response.json().catch(() => ({
      success: false,
      message: 'Server returned an invalid JSON response.'
    }));

    if (!response.ok) {
      throw new Error(data.message || `HTTP Error ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
}

export const api = {
  register: (payload) => request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),

  login: (payload) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),

  getMe: () => request('/auth/me', {
    method: 'GET'
  }),

  forgotPassword: (email) => request('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email })
  }),

  // Business API Endpoints
  getInvoices: () => request('/business/invoices', { method: 'GET' }),

  createInvoice: (payload) => request('/business/invoices', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),

  updateInvoiceStatus: (id, status) => request(`/business/invoices/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  }),

  getBills: () => request('/business/bills', { method: 'GET' }),

  createBill: (payload) => request('/business/bills', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),

  payBill: (id) => request(`/business/bills/${id}/pay`, { method: 'POST' }),


  toggleBillStatus: (id) => request(`/business/bills/${id}/status`, { method: 'PATCH' }),

  toggleBillAutoPay: (id) => request(`/business/bills/${id}/autopay`, { method: 'PATCH' }),

  getClients: () => request('/business/clients', { method: 'GET' }),

  toggleClientStatus: (id) => request(`/business/clients/${id}/status`, { method: 'PATCH' }),

  getProducts: () => request('/business/products', { method: 'GET' }),

  createProduct: (payload) => request('/business/products', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),

  getCategories: () => request('/business/categories', { method: 'GET' }),

  createCategory: (payload) => request('/business/categories', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),

  toggleCategoryStatus: (id) => request(`/business/categories/${id}/status`, { method: 'PATCH' }),

  getClientRelatedData: (id) => request(`/business/clients/${encodeURIComponent(id)}/related`, { method: 'GET' }),

  getCategoryRelatedData: (id) => request(`/business/categories/${encodeURIComponent(id)}/related`, { method: 'GET' }),

  getRelationalSummary: () => request('/business/summary/relational', { method: 'GET' }),

  checkHealth: async () => {
    try {
      const res = await fetch('/api/health');
      return res.ok;
    } catch {
      return false;
    }
  }
};
