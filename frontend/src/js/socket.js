import { io } from 'socket.io-client';
import { tokenStorage, getSocketBaseUrl } from './api.js';

let socket = null;
let currentCompanyId = null;
const eventListeners = new Map();

function getSocketUrl() {
  return getSocketBaseUrl();
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

export function updateSyncStatusBadge(state, customText = '') {
  const badge = document.getElementById('cloud-sync-status-badge');
  const settingsBadge = document.getElementById('sync-status-badge');

  let text = customText;
  let dotSymbol = '●';
  if (!text) {
    switch (state) {
      case 'online':
        text = 'Online';
        dotSymbol = '●';
        break;
      case 'offline':
        text = 'Offline';
        dotSymbol = '●';
        break;
      case 'syncing':
        text = 'Syncing...';
        dotSymbol = '↻';
        break;
      case 'synced':
        text = 'Synced';
        dotSymbol = '✓';
        break;
      case 'conflict':
        text = 'Sync Conflict';
        dotSymbol = '⚠';
        break;
      default:
        text = 'Online';
        dotSymbol = '●';
    }
  }

  [badge, settingsBadge].forEach(el => {
    if (el) {
      el.style.display = 'inline-flex';
      el.className = `cloud-sync-badge sync-status-${state}`;
      el.innerHTML = `
        <span class="sync-status-dot" style="font-weight: bold; margin-right: 4px;">${dotSymbol}</span>
        <span class="sync-status-text">${text}</span>
      `;
    }
  });
}

function updateUIConnectionBadge(state, text) {
  updateSyncStatusBadge(state, text);
}

