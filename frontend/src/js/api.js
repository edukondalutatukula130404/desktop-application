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

let ACTIVE_PORT = 5000;
let PRODUCTION_API_URL = typeof import.meta !== 'undefined' && import.meta.env ? (import.meta.env.VITE_API_URL || '') : '';

async function detectActivePort() {
  if (PRODUCTION_API_URL) return PRODUCTION_API_URL;

  const ports = [5000, 5001, 5002, 5003, 5004, 5005, 5050, 5051, 5052];
  for (const p of ports) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 600);
      const res = await fetch(`http://127.0.0.1:${p}/api/health`, { method: 'GET', signal: controller.signal });
      clearTimeout(t);
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.status === 'online' || data.service) {
          ACTIVE_PORT = p;
          return p;
        }
      }
    } catch (e) {}
  }
  return ACTIVE_PORT;
}

let initialPortDetected = false;

async function ensurePortDetected() {
  if (!initialPortDetected && !PRODUCTION_API_URL) {
    await detectActivePort();
    initialPortDetected = true;
  }
}

detectActivePort().then(() => { initialPortDetected = true; });

function getApiBaseUrl(port) {
  if (PRODUCTION_API_URL) {
    return PRODUCTION_API_URL.endsWith('/api') ? PRODUCTION_API_URL : `${PRODUCTION_API_URL}/api`;
  }
  if (typeof window !== 'undefined') {
    if (window.location.protocol === 'file:' || window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
      return `http://127.0.0.1:${port}/api`;
    }
  }
  return '/api';
}

export function getActiveApiPort() {
  return ACTIVE_PORT;
}

export function getSocketBaseUrl() {
  if (PRODUCTION_API_URL) {
    return PRODUCTION_API_URL.replace(/\/api\/?$/, '');
  }
  const host = (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost') ? window.location.hostname : '127.0.0.1';
  return `http://${host}:${ACTIVE_PORT}`;
}

async function request(endpoint, options = {}) {
  await ensurePortDetected();
  const devId = (typeof localStorage !== 'undefined' && localStorage.getItem('nexus_device_id')) ? localStorage.getItem('nexus_device_id') : 'DEV_DEFAULT';
  const headers = {
    'Content-Type': 'application/json',
    'x-device-id': devId,
    ...options.headers
  };

  const token = tokenStorage.get();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(`${getApiBaseUrl(ACTIVE_PORT)}${endpoint}`, {
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
      const err = new Error(data.message || `HTTP Error ${response.status}`);
      err.status = response.status;
      throw err;
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);

    const detectedPort = await detectActivePort();
    if (detectedPort) {
      ACTIVE_PORT = detectedPort;
      try {
        const retryController = new AbortController();
        const retryTimeout = setTimeout(() => retryController.abort(), 4000);
        const retryRes = await fetch(`${getApiBaseUrl(ACTIVE_PORT)}${endpoint}`, {
          ...options,
          headers,
          signal: retryController.signal
        });
        clearTimeout(retryTimeout);
        if (retryRes.ok) {
          return await retryRes.json();
        } else {
          const errData = await retryRes.json().catch(() => ({}));
          const err = new Error(errData.message || `HTTP Error ${retryRes.status}`);
          err.status = retryRes.status;
          throw err;
        }
      } catch (e2) {
        if (e2.status) throw e2;
      }
    }

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

  createBackup: () => request('/business/backup', { method: 'POST' }),
  getLatestBackup: () => request('/business/backup/latest', { method: 'GET' }),
  getBackupList: () => request('/business/backup/list', { method: 'GET' }),
  restoreBackup: (backupId = null) => request('/business/backup/restore', { method: 'POST', body: JSON.stringify({ backupId }) }),

  // Sync Status & Device API Endpoints
  getSyncStatus: () => request('/sync/status', { method: 'GET' }),
  triggerSync: () => request('/sync/trigger', { method: 'POST' }),
  getRegisteredDevices: () => request('/business/devices', { method: 'GET' }),
  registerDevice: (payload) => request('/business/devices/register', { method: 'POST', body: JSON.stringify(payload) }),
  revokeDevice: (deviceId) => request(`/business/devices/${encodeURIComponent(deviceId)}`, { method: 'DELETE' }),

  checkHealth: async () => {
    try {
      await ensurePortDetected();
      const res = await fetch(`${getApiBaseUrl(ACTIVE_PORT)}/health`);
      return res.ok;
    } catch {
      return false;
    }
  }
};
