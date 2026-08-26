// Centralized Fetch API Client for Backend REST Communications

const API_BASE_URL = (typeof window !== 'undefined' && window.location.protocol === 'file:') ? 'http://127.0.0.1:5050/api' : '/api';

const TOKEN_KEY = 'nexus_auth_jwt_token';
const DEVICE_KEY = 'nexus_device_id';

export function getDeviceId() {
  if (typeof window === 'undefined') return 'DEV_SERVER';
  let deviceId = localStorage.getItem(DEVICE_KEY);
  if (!deviceId) {
    deviceId = `DEV_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    localStorage.setItem(DEVICE_KEY, deviceId);
    // On fresh system installation / new device creation, clear any stale session tokens so login screen is required
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  }
  return deviceId;
}

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

let ACTIVE_PORT = 5050;

async function request(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Device-Id': getDeviceId(),
    ...options.headers
  };

  const token = tokenStorage.get();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const timeoutMs = options.timeout || (endpoint.includes('/backup') || endpoint.includes('/sync') ? 60000 : 30000);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const getUrl = (port) => (typeof window !== 'undefined' && window.location.protocol === 'file:') ? `http://127.0.0.1:${port}/api` : '/api';

  try {
    const response = await fetch(`${getUrl(ACTIVE_PORT)}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const data = await response.json().catch(() => ({
      success: false,
      message: response.status === 404 ? 'No cloud records found' : `HTTP Error ${response.status}`
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

    if (error.name === 'AbortError') {
      const err = new Error('Server request timed out. Please check internet connection.');
      err.status = 408;
      throw err;
    }

    if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
      const portsToTry = [5051, 50501, 5052];
      for (const fallbackPort of portsToTry) {
        if (fallbackPort === ACTIVE_PORT) continue;
        try {
          const retryController = new AbortController();
          const retryTimeout = setTimeout(() => retryController.abort(), Math.min(timeoutMs, 5000));
          const retryRes = await fetch(`${getUrl(fallbackPort)}${endpoint}`, {
            ...options,
            headers,
            signal: retryController.signal
          });
          clearTimeout(retryTimeout);
          if (retryRes.ok) {
            ACTIVE_PORT = fallbackPort;
            return await retryRes.json();
          }
        } catch (e2) {}
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

  // Backup Endpoints
  createBackup: (payload) => request('/business/backup', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),

  getLatestBackup: () => request('/business/backup/latest', { method: 'GET' }),

  getBackupList: () => request('/business/backup/list', { method: 'GET' }),

  restoreBackup: (payload) => request('/business/backup/restore', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),

  // Multi-Device Sync Endpoints
  pushSyncChanges: (changes) => request('/business/sync/push', {
    method: 'POST',
    body: JSON.stringify({ changes })
  }),

  pullSyncChanges: (since) => request(`/business/sync/pull?since=${encodeURIComponent(since || '')}`, {
    method: 'GET'
  }),

  // Device Management Endpoints
  registerDevice: (deviceName) => request('/business/devices/register', {
    method: 'POST',
    body: JSON.stringify({ deviceName })
  }),

  getDevices: () => request('/business/devices', { method: 'GET' }),

  revokeDevice: (deviceId) => request(`/business/devices/${encodeURIComponent(deviceId)}`, { method: 'DELETE' }),

  checkHealth: async () => {
    try {
      const data = await request('/health', { method: 'GET' });
      return !!(data && data.status === 'online' && data.database === 'connected');
    } catch {
      return false;
    }
  }
};
