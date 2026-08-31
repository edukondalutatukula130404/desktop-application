import { io } from 'socket.io-client';
import { tokenStorage } from './api.js';

let socket = null;
let currentCompanyId = null;
const eventListeners = new Map();

function getSocketUrl() {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname || '127.0.0.1';
    // If running via Vite dev server on port 3001 or Electron file protocol, connect to backend server on port 5050
    if (window.location.port === '3001' || window.location.protocol === 'file:') {
      return `http://${host}:5050`;
    }
    if (window.location.port === '5050') {
      return window.location.origin;
    }
    return `http://${host}:5050`;
  }
  return 'http://127.0.0.1:5050';
}


export function initSocketConnection(companyId = null, onStatusChange = null) {
  const token = tokenStorage.get();
  const targetCompany = companyId || currentCompanyId || 'shop_default';
  currentCompanyId = targetCompany;

  if (socket && socket.connected) {
    socket.emit('join_company', targetCompany);
    return socket;
  }

  if (socket) {
    socket.disconnect();
  }

  const serverUrl = getSocketUrl();
  console.log(`🔌 [Socket.IO Client] Connecting to Cloud Real-Time Server at ${serverUrl}...`);

  socket = io(serverUrl, {
    auth: { token, companyId: targetCompany },
    query: { token, companyId: targetCompany, deviceId: `device_${Math.random().toString(36).substring(2, 7)}` },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    transports: ['websocket', 'polling']
  });

  socket.on('connect', () => {
    console.log(`🟢 [Socket.IO Client] Connected to Cloud Server! Socket ID: ${socket.id}`);
    updateUIConnectionBadge('online', '🟢 Connected (Real-Time Cloud Sync)');
    if (typeof onStatusChange === 'function') onStatusChange('connected');
    triggerRegisteredListeners('connect', { socketId: socket.id });
  });

  socket.on('disconnect', (reason) => {
    console.warn(`🔴 [Socket.IO Client] Disconnected: ${reason}`);
    updateUIConnectionBadge('offline', '🔴 Offline Mode');
    if (typeof onStatusChange === 'function') onStatusChange('disconnected');
    triggerRegisteredListeners('disconnect', { reason });
  });

  socket.on('connect_error', (error) => {
    console.warn(`🟡 [Socket.IO Client] Connection Error / Reconnecting: ${error.message}`);
    updateUIConnectionBadge('reconnecting', '🟡 Reconnecting to Cloud...');
    if (typeof onStatusChange === 'function') onStatusChange('reconnecting');
  });

  // Listen to generic data sync events
  const syncEvents = [
    'product:created',
    'product:updated',
    'product:deleted',
    'stock:updated',
    'invoice:created',
    'invoice:updated',
    'sale:created',
    'customer:created',
    'customer:updated',
    'category:created',
    'category:updated',
    'category:deleted',
    'bill:created',
    'bill:updated',
    'brand:created',
    'brand:updated',
    'brand:deleted',
    'supplier:created',
    'supplier:updated',
    'supplier:deleted',
    'inventory:adjusted',
    'dashboard:updated'
  ];

  syncEvents.forEach(evt => {
    socket.on(evt, (data) => {
      console.log(`⚡ [Socket.IO Event Received] '${evt}':`, data);
      triggerRegisteredListeners(evt, data);
    });
  });

  return socket;
}

export function subscribeToRealtimeEvent(eventName, callback) {
  if (!eventListeners.has(eventName)) {
    eventListeners.set(eventName, new Set());
  }
  eventListeners.get(eventName).add(callback);

  return () => {
    if (eventListeners.has(eventName)) {
      eventListeners.get(eventName).delete(callback);
    }
  };
}

function triggerRegisteredListeners(eventName, data) {
  if (eventListeners.has(eventName)) {
    eventListeners.get(eventName).forEach(cb => {
      try {
        cb(data);
      } catch (err) {
        console.error(`Error in event listener for [${eventName}]:`, err);
      }
    });
  }
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

function updateUIConnectionBadge(state, text) {
  const badge = document.getElementById('cloud-sync-status-badge');
  if (badge) {
    badge.className = `cloud-sync-badge sync-status-${state}`;
    const cleanText = text.replace(/^[🟢🟡🔴]\s*/, '');
    badge.innerHTML = `
      <span class="sync-status-dot" style="width: 8px; height: 8px; border-radius: 50%; background-color: currentColor; display: inline-block;"></span>
      <span class="sync-status-text">${cleanText}</span>
      <button type="button" onclick="this.parentElement.style.display='none'" style="background: none; border: none; cursor: pointer; opacity: 0.6; font-size: 14px; line-height: 1; padding: 0 0 0 6px; color: inherit;" title="Dismiss">&times;</button>
    `;
  }
}

