// Centralized Fetch API Client for Backend REST Communications

const API_BASE_URL = (typeof window !== 'undefined' && window.location.protocol === 'file:') ? 'http://127.0.0.1:5050/api' : '/api';

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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const data = await response.json().catch(() => ({
      success: false,
      message: 'Server returned an invalid JSON response.'
    }));

    if (!response.ok) {
      if (response.status === 401) {
        tokenStorage.clear();
      }
      const err = new Error(data.message || `HTTP Error ${response.status}`);
      err.status = response.status;
      throw err;
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    console.warn(`API Request [${endpoint}] error:`, error.message);
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

  createClient: (payload) => request('/business/clients', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),

  toggleClientStatus: (id) => request(`/business/clients/${id}/status`, { method: 'PATCH' }),

  getProducts: () => request('/business/products', { method: 'GET' }),

  createProduct: (payload) => request('/business/products', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),

  updateProduct: (id, payload) => request(`/business/products/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  }),

  updateProductStock: (id, payload) => request(`/business/products/${encodeURIComponent(id)}/stock`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  }),

  deleteProduct: (id, name = '') => request(`/business/products/${encodeURIComponent(id)}?name=${encodeURIComponent(name || '')}`, { method: 'DELETE' }),

  getCategories: () => request('/business/categories', { method: 'GET' }),

  createCategory: (payload) => request('/business/categories', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),

  updateCategory: (id, payload) => request(`/business/categories/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  }),

  deleteCategory: (id, name = '') => request(`/business/categories/${encodeURIComponent(id)}?name=${encodeURIComponent(name || '')}`, { method: 'DELETE' }),

  toggleCategoryStatus: (id) => request(`/business/categories/${id}/status`, { method: 'PATCH' }),

  getClientRelatedData: (id) => request(`/business/clients/${encodeURIComponent(id)}/related`, { method: 'GET' }),

  getCategoryRelatedData: (id) => request(`/business/categories/${encodeURIComponent(id)}/related`, { method: 'GET' }),

  getRelationalSummary: () => request('/business/summary/relational', { method: 'GET' }),

  backupDatabase: (payload) => request('/business/backup', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),

  checkHealth: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/health`);
      return res.ok;
    } catch {
      return false;
    }
  }
};
