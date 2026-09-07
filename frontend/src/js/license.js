/**
 * license.js — desktop license gate + runtime enforcement (renderer side).
 *
 *   initLicensing({ onContinue, onLock })  -> call ONCE at boot, before initSession()
 *
 * Responsibilities:
 *   - block boot behind a valid license (Activation screen if none)
 *   - poll + listen for state changes; on expiry/revocation force a logout and
 *     lock the whole UI (not just hide it)
 *   - never require internet for a still-valid offline license
 */

import { api, tokenStorage } from './api.js';
import { subscribeToRealtimeEvent, disconnectSocket } from './socket.js';

const POLL_MS = 90 * 1000;           // renderer backup re-validate (main-process watchdog is primary, 20s)
const OK_STATES = new Set(['ACTIVE', 'EXPIRING_SOON']);

let _started = false;
let _lastStatus = null;
let _onLock = () => {};
let _refreshing = false;
let _bootRetried = false;
let _onContinue = null;
let _continued = false;
let _wasLocked = false;

function doContinue() {
  if (_continued) return;
  _continued = true;
  try { if (typeof _onContinue === 'function') _onContinue(); } catch (e) {}
}

function hasIpc() {
  return typeof window !== 'undefined' && window.electronAPI && window.electronAPI.license;
}

// India Standard Time (fixed UTC+05:30, no DST) — display only.
function fmtIST(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const s = new Date(d.getTime() + 330 * 60000);
  const p = (n) => String(n).padStart(2, '0');
  return `${s.getUTCFullYear()}-${p(s.getUTCMonth() + 1)}-${p(s.getUTCDate())} ` +
    `${p(s.getUTCHours())}:${p(s.getUTCMinutes())} IST`;
}

async function fetchState() {
  try {
    if (hasIpc()) return await window.electronAPI.license.getState();
    const res = await api.licenseStatus();
    return (res && res.license) || { ok: false, status: 'INVALID', code: 'LICENSE_UNKNOWN' };
  } catch (e) {
    // Backend unreachable at boot: fail closed but recoverable (poll will retry).
    return { ok: false, status: 'INVALID', code: 'LICENSE_UNREACHABLE', reason: e && e.message };
  }
}

async function refreshNow() {
  if (_refreshing) return _lastState;
  _refreshing = true;
  try {
    if (hasIpc()) { try { await window.electronAPI.license.refresh(); } catch (e) {} }
    const st = await fetchState();
    applyState(st);
    return st;
  } finally {
    _refreshing = false;
  }
}

let _lastState = null;

/* ───────────────────────── boot gate ───────────────────────── */

function fillDeviceIdBadges() {
  const paint = (id) => {
    const s = id ? String(id) : '';
    document.querySelectorAll('.license-device-id-badge').forEach((el) => {
      el.textContent = s ? s.slice(0, 16) + '…' : 'n/a';
      el.title = s || '';            // full hash on hover (matches `license:list --activations`)
      el.style.cursor = s ? 'copy' : '';
      el.onclick = s ? () => { try { navigator.clipboard.writeText(s); } catch (e) {} } : null;
    });
  };
  if (hasIpc() && window.electronAPI.license.getMachineId) {
    window.electronAPI.license.getMachineId().then(paint).catch(() => paint(null));
  } else {
    paint(null);
  }
}

export async function initLicensing({ onContinue, onLock } = {}) {
  injectStyles();
  ensureOverlay();
  fillDeviceIdBadges();
  _onLock = typeof onLock === 'function' ? onLock : _onLock;
  _onContinue = typeof onContinue === 'function' ? onContinue : null;

  if (hasIpc() && typeof window.electronAPI.license.onStateChange === 'function') {
    window.electronAPI.license.onStateChange((st) => applyState(st));
  }
  window.addEventListener('license:blocked', () => { refreshNow(); });
  window.addEventListener('online', () => { refreshNow(); });
  ['license:revoked', 'license:suspended', 'license:expired', 'license:updated'].forEach((evt) => {
    try { subscribeToRealtimeEvent(evt, () => refreshNow()); } catch (e) {}
  });
  setInterval(() => { fetchState().then(applyState); }, POLL_MS);

  const st = await fetchState();

  // Development builds with enforcement off: never gate, never lock.
  if (st && st.enforced === false) {
    hideOverlay();
    hideBanner();
    doContinue();
    return;
  }

  applyState(st, { initial: true });
  // applyState() calls doContinue() itself once the license is OK — either now,
  // or shortly after the main process auto-activates a bundled license. If it
  // never becomes OK, the lock/activation overlay stays up.
}

/* ─────────────────────── state application ─────────────────── */

function applyState(st, opts = {}) {
  if (!st || typeof st !== 'object') return;
  if (st.enforced === false) { hideOverlay(); hideBanner(); return; }
  _lastState = st;
  const prev = _lastStatus;
  _lastStatus = st.status;

  if (st.ok) {
    // Recovering from a locked state (suspend/revoke/limit/expiry lifted): the
    // dashboard AND the login screen were hidden by lock(); the cleanest way
    // back to a working login screen is a full reload.
    if (_wasLocked) {
      _wasLocked = false;
      try { window.location.reload(); return; } catch (e) {}
    }
    hideOverlay();
    doContinue();
    if (st.warning === 'EXPIRING_SOON') showBanner(st);
    else hideBanner();
    return;
  }

  hideBanner();

  if (st.status === 'NOT_ACTIVATED') {
    // Per-client build: the main process is auto-activating the bundled license.
    // Give it a moment, then show a "could not activate" screen (never a paste box).
    if (hasIpc() && !_bootRetried) {
      _bootRetried = true;
      setTimeout(() => {
        refreshNow().then((s) => {
          if (!s || (!s.ok && s.status === 'NOT_ACTIVATED')) lock(s || st);
        });
      }, 3000);
      return;
    }
  }

  // Any not-ok state = hard lock + logout. If we were previously running, this
  // is the automatic logout the moment the license changes.
  lock(st);
}

function lock(st) {
  _wasLocked = true;
  try { tokenStorage.clear(); } catch (e) {}
  ['nexus_auth_user', 'nexus_active_view', 'nexus_last_auth_email'].forEach((k) => {
    try { localStorage.removeItem(k); } catch (e) {}
  });
  try { disconnectSocket(); } catch (e) {}
  try { _onLock(st); } catch (e) {}
  try {
    window.dispatchEvent(new CustomEvent('nexus:license-lock', { detail: st }));
  } catch (e) {}

  document.getElementById('saas-dashboard')?.classList.add('hidden');
  document.getElementById('auth-viewport')?.classList.add('hidden');
  showOverlay(st);
}

/* ─────────────────────────── UI ───────────────────────────── */
/* No license-key entry: the client never types anything. Every locked state is
   a clear message + "contact your administrator". */

function msgFor(st) {
  const code = st && st.code;
  const status = st && st.status;
  const plural = (n) => (n === 1 ? 'device' : 'devices');

  if (code === 'ACTIVATION_LIMIT_REACHED' || status === 'DEVICE_LIMIT') {
    const lim = (st && st.limit) || null;
    return {
      badge: 'DEVICE LIMIT',
      title: 'Device Limit Reached',
      body: lim
        ? `Your plan allows ${lim} ${plural(lim)}. This computer would be an extra one, so it can't be used. `
          + `Ask your administrator to increase your device limit or remove another device — this screen clears on its own once they do.`
        : `Your plan's device limit has been reached. Ask your administrator to increase it or remove another device.`
    };
  }
  if (code === 'LICENSE_EXPIRED' || status === 'EXPIRED') {
    const when = st && st.expiresAt ? ` on ${fmtIST(st.expiresAt)}` : '';
    return {
      badge: 'EXPIRED',
      title: 'License Expired',
      body: `Your license expired${when}. Please contact your administrator to renew it.`
    };
  }
  if (code === 'LICENSE_REVOKED' || status === 'REVOKED') {
    return {
      badge: 'REVOKED',
      title: 'Access Revoked',
      body: 'Your access to this application has been revoked. Please contact your administrator.'
    };
  }
  if (code === 'LICENSE_SUSPENDED' || status === 'SUSPENDED') {
    return {
      badge: 'PAUSED',
      title: 'Access Paused',
      body: 'Your access is temporarily paused. Please contact your administrator to resume it.'
    };
  }
  if (code === 'OFFLINE_GRACE_EXCEEDED' || status === 'GRACE') {
    return {
      badge: 'OFFLINE',
      title: 'Reconnection Required',
      body: 'This computer has been offline too long. Connect it to the internet to continue. If it stays locked, contact your administrator.'
    };
  }
  if (code === 'CLOCK_CHANGE_DETECTED' || status === 'CLOCK_TAMPER') {
    return {
      badge: 'CLOCK',
      title: 'Clock Change Detected',
      body: "This computer's date/time has changed unexpectedly. Connect to the internet to continue, or contact your administrator."
    };
  }
  if (code === 'DEVICE_NOT_AUTHORIZED' || status === 'DEVICE_BLOCKED') {
    return {
      badge: 'BLOCKED',
      title: 'This Device Was Removed',
      body: "This computer's access has been removed by your administrator. Please contact them if this is unexpected."
    };
  }
  if (status === 'TAMPERED' || code === 'LICENSE_TAMPERED' || code === 'INVALID_SIGNATURE' || code === 'LICENSE_CORRUPTED') {
    return {
      badge: 'PROBLEM',
      title: 'License Problem',
      body: 'The license on this computer could not be verified. Please contact your administrator.'
    };
  }
  if (status === 'NOT_ACTIVATED' || code === 'LICENSE_NOT_ACTIVATED') {
    return {
      badge: 'SETUP',
      title: "Couldn't Activate",
      body: 'This installation could not be activated. Check the internet connection and press Retry, or contact your administrator.'
    };
  }
  return {
    badge: 'LOCKED',
    title: 'Application Locked',
    body: 'This application is not licensed for use on this computer. Please contact your administrator.'
  };
}

function ensureOverlay() {
  if (document.getElementById('nx-license-overlay')) return;
  const el = document.createElement('div');
  el.id = 'nx-license-overlay';
  el.hidden = true;
  el.innerHTML = `
    <div class="nx-lic-card" role="dialog" aria-modal="true" aria-labelledby="nx-lic-title">
      <div class="nx-lic-badge" id="nx-lic-badge">LICENSE</div>
      <h1 id="nx-lic-title">Application Locked</h1>
      <p id="nx-lic-body">This application is not licensed for use on this computer.</p>

      <div class="nx-lic-actions">
        <button type="button" id="nx-lic-retry" class="nx-lic-secondary">Retry</button>
        <button type="button" id="nx-lic-quit" class="nx-lic-primary">Close application</button>
      </div>

      <div class="nx-lic-meta">
        <span>Device ID: <code id="nx-lic-machine">…</code></span>
      </div>
    </div>`;
  document.body.appendChild(el);

  el.querySelector('#nx-lic-retry').addEventListener('click', () => refreshNow());
  el.querySelector('#nx-lic-quit').addEventListener('click', () => {
    if (window.electronAPI && window.electronAPI.quitApp) window.electronAPI.quitApp();
    else window.close();
  });

  if (hasIpc() && window.electronAPI.license.getMachineId) {
    window.electronAPI.license.getMachineId().then((id) => {
      const code = el.querySelector('#nx-lic-machine');
      if (code && id) code.textContent = String(id).slice(0, 16) + '…';
    }).catch(() => {});
  } else {
    el.querySelector('#nx-lic-machine').textContent = 'n/a';
  }
}

function showOverlay(st) {
  ensureOverlay();
  const el = document.getElementById('nx-license-overlay');
  const m = msgFor(st);
  el.querySelector('#nx-lic-badge').textContent = m.badge;
  el.querySelector('#nx-lic-title').textContent = m.title;
  el.querySelector('#nx-lic-body').textContent = m.body;
  el.hidden = false;
  document.documentElement.style.overflow = 'hidden';
}

function hideOverlay() {
  const el = document.getElementById('nx-license-overlay');
  if (el) el.hidden = true;
  document.documentElement.style.overflow = '';
}

/* expiring-soon banner */
function ensureBanner() {
  let b = document.getElementById('nx-license-banner');
  if (b) return b;
  b = document.createElement('div');
  b.id = 'nx-license-banner';
  b.hidden = true;
  b.innerHTML = `<span id="nx-license-banner-text"></span>`;
  document.body.appendChild(b);
  return b;
}
function showBanner(st) {
  const b = ensureBanner();
  const t = b.querySelector('#nx-license-banner-text');
  let mins = null;
  if (st && st.expiresAt) mins = Math.max(0, Math.round((new Date(st.expiresAt).getTime() - Date.now()) / 60000));
  const at = st && st.expiresAt ? ` (expires ${fmtIST(st.expiresAt)})` : '';
  t.textContent = mins != null
    ? `Your license expires in ${mins} minute${mins === 1 ? '' : 's'}${at}. Contact your administrator to renew.`
    : 'Your license is expiring soon. Contact your administrator to renew.';
  b.hidden = false;
}
function hideBanner() {
  const b = document.getElementById('nx-license-banner');
  if (b) b.hidden = true;
}

/* ─────────────────────────── styles ───────────────────────── */

function injectStyles() {
  if (document.getElementById('nx-license-styles')) return;
  const s = document.createElement('style');
  s.id = 'nx-license-styles';
  s.textContent = `
  #nx-license-overlay{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;
    justify-content:center;padding:24px;background:rgba(15,23,42,.72);
    -webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);}
  #nx-license-overlay[hidden]{display:none!important;}
  #nx-license-overlay .nx-lic-card{width:100%;max-width:460px;background:var(--card-bg,#fff);
    border:1px solid var(--border-light,#ece3f7);border-radius:20px;padding:34px 34px 26px;
    box-shadow:0 24px 60px rgba(15,23,42,.28);font-family:var(--font-family,'Hanken Grotesk',system-ui,sans-serif);
    color:var(--text-main,#1e293b);}
  #nx-license-overlay .nx-lic-badge{display:inline-block;font-size:.68rem;font-weight:800;letter-spacing:.09em;
    text-transform:uppercase;color:var(--primary-accent,#9333ea);
    background:color-mix(in srgb,var(--primary-accent,#9333ea) 10%,transparent);
    padding:5px 11px;border-radius:999px;margin-bottom:14px;}
  #nx-license-overlay h1{font-family:var(--font-heading,'Bricolage Grotesque',system-ui,sans-serif);
    font-size:1.5rem;font-weight:800;margin:0 0 8px;color:var(--text-main,#0f172a);}
  #nx-license-overlay p{margin:0 0 20px;font-size:.94rem;line-height:1.6;color:var(--text-muted,#64748b);}
  #nx-license-overlay button{font-family:inherit;font-size:.9rem;font-weight:700;cursor:pointer;
    border-radius:11px;padding:11px 18px;border:1px solid transparent;width:100%;}
  #nx-license-overlay .nx-lic-actions{display:flex;flex-direction:column;gap:10px;}
  #nx-license-overlay .nx-lic-primary{background:var(--primary-accent,#9333ea);color:#fff;}
  #nx-license-overlay .nx-lic-secondary{background:#fff;color:var(--primary-accent,#9333ea);
    border-color:var(--border-light,#ece3f7);}
  #nx-license-overlay .nx-lic-meta{margin-top:18px;padding-top:14px;border-top:1px solid var(--border-light,#eee);
    font-size:.74rem;color:var(--text-subtle,#94a3b8);}
  #nx-license-overlay .nx-lic-meta code{font-family:ui-monospace,monospace;}
  #nx-license-banner{position:fixed;left:0;right:0;bottom:0;z-index:2147482000;
    background:color-mix(in srgb,var(--amber,#f59e0b) 14%,#fff);
    border-top:1px solid color-mix(in srgb,var(--amber,#f59e0b) 45%,transparent);
    color:#7c4a03;font-family:var(--font-family,'Hanken Grotesk',system-ui,sans-serif);
    font-size:.85rem;font-weight:600;text-align:center;padding:9px 16px;}
  #nx-license-banner[hidden]{display:none!important;}
  @media (prefers-color-scheme:dark){
    #nx-license-overlay .nx-lic-card{background:#1e1b2e;color:#e9e5f5;}
  }`;
  document.head.appendChild(s);
}

export function getLicenseSnapshot() {
  return _lastState;
}
