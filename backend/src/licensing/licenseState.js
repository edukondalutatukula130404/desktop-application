/**
 * licenseState.js — the enforcement brain. Singleton in the Electron main
 * process (the embedded Express backend is require()'d into the same process,
 * so middleware and main share this instance directly — no IPC).
 *
 * Responsibilities:
 *   - hold the current signed license + local "anchor" (persisted, tamper-proofed
 *     by the caller's writeVault adapter — DPAPI in Phase 4)
 *   - evaluate() : decide ACTIVE / EXPIRED / REVOKED / SUSPENDED / GRACE / … using
 *     trusted time (Atlas) online and monotonic-guarded local time offline
 *   - activate() : bind this device, register with Atlas when online
 *   - getState() : cheap sync snapshot for middleware / IPC
 *
 * Adapters (wired by electron/main.cjs in Phase 4; safe in-memory defaults here):
 *   readVault()            -> object | null
 *   writeVault(obj)        -> void
 *   getMachineFingerprint()-> { hash, signals }
 */

'use strict';

const { LICENSE_ERROR, LICENSE_STATUS } = require('./licenseFormat');
const { verifyLicense } = require('./verifyLicense');
const { getTrustedTime } = require('./trustedTime');
const { getMachineFingerprint, fingerprintMatchRatio } = require('./machineId');

const EXPIRY_WARNING_MS = 10 * 60 * 1000;     // "expiring soon" threshold
const SOFT_MATCH_THRESHOLD = 0.6;             // weighted fingerprint match for soft re-bind
const CLOCK_BACKSTOP_MS = 24 * 60 * 60 * 1000; // unexplained forward jump tolerance (Phase 9 tightens this)
const ACT_HEARTBEAT_MS = 5 * 60 * 1000;       // throttle the lastValidatedAt write (checks still run every tick)

let _lastActWriteMs = 0;

let _mem = null; // in-memory vault fallback

const adapters = {
  readVault: () => _mem,
  writeVault: (obj) => { _mem = obj; },
  getMachineFingerprint
};

let _state = {
  ok: false,
  status: 'NOT_ACTIVATED',
  code: LICENSE_ERROR.LICENSE_NOT_ACTIVATED,
  reason: 'No license activated on this device.',
  online: false,
  evaluatedAt: null,
  expiresAt: null,
  graceRemainingMs: null,
  warning: null,
  licenseId: null,
  customerName: null,
  features: []
};

let _licString = null;
let _payload = null;
let _loadError = null;

// A license bundled into the build (per-client installers). If this device has
// no vault, or a vault for a DIFFERENT license, evaluate() keeps trying to
// activate this one every cycle — so freeing a slot / bumping maxActivations
// recovers the device automatically, no restart.
let _embeddedLicString = null;
let _embeddedId = null;

function setEmbeddedLicense(licString) {
  _embeddedLicString = (licString && String(licString).trim()) || null;
  try {
    _embeddedId = _embeddedLicString
      ? require('./licenseFormat').decodeLicenseFile(_embeddedLicString).payload.licenseId
      : null;
  } catch (e) { _embeddedId = null; }
}

function init(customAdapters = {}) {
  Object.assign(adapters, customAdapters);
  loadFromVault();
}

function loadFromVault() {
  _licString = null;
  _payload = null;
  _loadError = null;
  try {
    const v = adapters.readVault();
    if (v && v.licString) {
      _licString = v.licString;
      try {
        _payload = verifyLicense(_licString, { skipTimeChecks: true }).payload;
      } catch (e) {
        // license present but won't verify -> tampered, not "unactivated"
        _loadError = e.code || LICENSE_ERROR.LICENSE_TAMPERED;
      }
    }
  } catch (e) {
    _loadError = LICENSE_ERROR.LICENSE_TAMPERED;
  }
}

function _vault() {
  return adapters.readVault() || {};
}

function _persist(patch) {
  const next = Object.assign({}, _vault(), patch, { updatedAt: new Date().toISOString() });
  adapters.writeVault(next);
  return next;
}

function _num(d) {
  const t = d instanceof Date ? d.getTime() : Date.parse(d);
  return Number.isFinite(t) ? t : 0;
}

function _set(partial) {
  _state = Object.assign({}, _state, partial, { evaluatedAt: new Date().toISOString() });
  return _state;
}

/** Cheap synchronous snapshot for middleware / IPC. Never throws. */
function getState() {
  return _state;
}

function isProtectedAllowed() {
  return _state.ok === true;
}

/**
 * Activate a license on this device.
 * @param {{ licString: string }} input
 * @returns {Promise<object>} the new state
 */
async function activate({ licString }) {
  if (!licString || typeof licString !== 'string') {
    const e = new Error('No license provided'); e.code = LICENSE_ERROR.INVALID_LICENSE; throw e;
  }

  // 1. signature + shape + time (rejects an already-expired license outright)
  const tt = await getTrustedTime();
  const { payload } = verifyLicense(licString, { now: tt.time });

  // 2. device identity
  const fp = adapters.getMachineFingerprint();

  // 3. if online, register with Atlas (enforce maxActivations + soft re-bind)
  let atlas = null;
  if (tt.trusted) {
    atlas = await _registerWithAtlas(payload, fp, tt.time);
  }

  // 4. persist the anchor
  _licString = licString;
  _payload = payload;
  _persist({
    licString,
    licenseId: payload.licenseId,
    deviceHash: fp.hash,
    fingerprintSignals: fp.signals,
    activatedAt: new Date().toISOString(),
    lastOnlineValidationAt: tt.trusted ? tt.time.toISOString() : null,
    maxSeenServerTime: tt.trusted ? tt.time.toISOString() : (_vault().maxSeenServerTime || null),
    maxSeenAnyTime: new Date(Math.max(_num(tt.time), Date.now(), _num(_vault().maxSeenAnyTime))).toISOString(),
    atlasStatus: atlas ? atlas.status : null,
    atlasExpiresAt: atlas ? new Date(atlas.expiresAt).toISOString() : null,
    offlineGraceHours: payload.offlineGraceHours
  });

  return evaluate({ force: true });
}

async function _registerWithAtlas(payload, fp, trustedNow) {
  const License = require('../models/License');
  const LicenseActivation = require('../models/LicenseActivation');
  const { audit } = require('./auditClient');

  const lic = await License.findOne({ licenseId: payload.licenseId }).lean();
  if (!lic) {
    const e = new Error('License not recognised by the server'); e.code = LICENSE_ERROR.LICENSE_NOT_FOUND; throw e;
  }
  if (lic.status === LICENSE_STATUS.REVOKED) { const e = new Error('License revoked'); e.code = LICENSE_ERROR.LICENSE_REVOKED; throw e; }
  if (lic.status === LICENSE_STATUS.SUSPENDED) { const e = new Error('License suspended'); e.code = LICENSE_ERROR.LICENSE_SUSPENDED; throw e; }

  let act = await LicenseActivation.findOne({ licenseId: payload.licenseId, deviceHash: fp.hash });

  if (!act) {
    // soft re-bind: is this "the same machine" as an existing activation?
    if (payload.bindingMode === 'soft') {
      const existing = await LicenseActivation.find({ licenseId: payload.licenseId, status: 'ACTIVE' });
      const near = existing.find((a) => fingerprintMatchRatio(a.fingerprintSignals, fp.signals) >= SOFT_MATCH_THRESHOLD);
      if (near) {
        near.deviceHash = fp.hash;
        near.fingerprintSignals = fp.signals;
        near.lastValidatedAt = trustedNow;
        await near.save();
        await audit('DEVICE_CHANGED', { licenseId: payload.licenseId, deviceHash: fp.hash, source: 'desktop' });
        act = near;
      }
    }
  }

  if (!act) {
    const activeCount = await LicenseActivation.countDocuments({ licenseId: payload.licenseId, status: 'ACTIVE' });
    if (activeCount >= (lic.maxActivations || 1)) {
      await audit('ACTIVATION_LIMIT_REACHED', { licenseId: payload.licenseId, deviceHash: fp.hash, source: 'desktop' });
      const e = new Error('Activation limit reached'); e.code = LICENSE_ERROR.ACTIVATION_LIMIT_REACHED; e.limit = (lic.maxActivations || 1); e.current = activeCount; throw e;
    }
    act = await LicenseActivation.create({
      licenseId: payload.licenseId,
      deviceHash: fp.hash,
      fingerprintSignals: fp.signals,
      activatedAt: trustedNow,
      lastValidatedAt: trustedNow,
      status: 'ACTIVE'
    });
    await License.updateOne({ licenseId: payload.licenseId }, { $inc: { activationCount: 1 } });
    await audit('LICENSE_ACTIVATED', { licenseId: payload.licenseId, deviceHash: fp.hash, source: 'desktop' });
  } else if (act.status === 'DEACTIVATED') {
    // Same physical device coming back. Allow it to re-claim a slot if the
    // license still has capacity; otherwise it stays blocked.
    const activeCount = await LicenseActivation.countDocuments({ licenseId: payload.licenseId, status: 'ACTIVE' });
    if (activeCount >= (lic.maxActivations || 1)) {
      await audit('ACTIVATION_LIMIT_REACHED', { licenseId: payload.licenseId, deviceHash: fp.hash, source: 'desktop' });
      const e = new Error('Activation limit reached'); e.code = LICENSE_ERROR.ACTIVATION_LIMIT_REACHED; e.limit = (lic.maxActivations || 1); e.current = activeCount; throw e;
    }
    act.status = 'ACTIVE';
    act.deactivatedAt = null;
    act.deactivatedReason = '';
    act.fingerprintSignals = fp.signals;
    act.lastValidatedAt = trustedNow;
    await act.save();
    await License.updateOne({ licenseId: payload.licenseId }, { $inc: { activationCount: 1 } });
    await audit('LICENSE_ACTIVATED', { licenseId: payload.licenseId, deviceHash: fp.hash, source: 'desktop' });
  }

  return { status: lic.status, expiresAt: lic.expiresAt };
}

/**
 * Decide the current enforcement state. Safe to call frequently.
 * Online: one Atlas findOne. Offline: no I/O.
 * @param {{ force?: boolean }} [opts]
 */
async function evaluate(opts = {}) {
  if ((!_licString && !_loadError) || (_licString && !_payload && !_loadError)) {
    loadFromVault();
  }

  // Bundled-license installs: if there's no vault, or the vault belongs to a
  // DIFFERENT license than this build ships with (stale from an earlier build),
  // (re)try activating the embedded one. Runs every watchdog cycle, so freeing
  // an activation slot / raising maxActivations recovers the device on its own.
  if (_embeddedLicString && (!_licString || (_embeddedId && _payload && _payload.licenseId !== _embeddedId) || (_embeddedId && _loadError))) {
    try {
      if (_licString && _payload && _payload.licenseId !== _embeddedId) {
        try { adapters.writeVault(null); } catch (e) {}
        _mem = null; _licString = null; _payload = null; _loadError = null;
      }
      return await activate({ licString: _embeddedLicString });
    } catch (e) {
      return _fail(e.code || LICENSE_ERROR.INVALID_LICENSE,
        e.message || 'Could not activate this device.',
        { online: true, limit: e.limit, current: e.current });
    }
  }

  if (!_licString && !_loadError) {
    return _set({
      ok: false, status: 'NOT_ACTIVATED', code: LICENSE_ERROR.LICENSE_NOT_ACTIVATED,
      reason: 'No license activated on this device.', online: false,
      expiresAt: null, graceRemainingMs: null, warning: null,
      licenseId: null, customerName: null, features: []
    });
  }

  const tt = await getTrustedTime();
  const online = tt.trusted === true;
  const systemNow = Date.now();
  const vault = _vault();
  const seenAny = _num(vault.maxSeenAnyTime);

  // effective "now": online -> Atlas time; offline -> the latest defensible value
  // (system clock, highest time ever seen, and the projected-from-last-trusted
  // value from trustedTime.js). Rollback below any of these is ignored.
  let effectiveNow = online
    ? _num(tt.time)
    : Math.max(systemNow, seenAny, _num(tt.time));

  // clock-tamper: (a) system clock far ahead of the highest time ever seen, or
  // (b) the watchdog reports wall-clock racing ahead of monotonic time.
  let clockTamper = false;
  if (!online && seenAny && systemNow > seenAny + CLOCK_BACKSTOP_MS) {
    clockTamper = true;
  }
  if (!online && typeof opts.divergenceMs === 'number' && opts.divergenceMs > CLOCK_BACKSTOP_MS) {
    clockTamper = true;
  }

  // always re-verify signature (skip its own time check; we do expiry below)
  let vres;
  try {
    vres = verifyLicense(_licString, { skipTimeChecks: true });
  } catch (e) {
    return _fail(e.code || _loadError || LICENSE_ERROR.LICENSE_TAMPERED, 'License integrity check failed.', { online });
  }
  _payload = vres.payload;
  _loadError = null;

  // identity: the vault must belong to this license
  if (vault.licenseId && vault.licenseId !== _payload.licenseId) {
    return _fail(LICENSE_ERROR.INVALID_LICENSE, 'License does not match this installation.', { online });
  }

  let effectiveExpiresAt = _num(_payload.expiresAt);
  let atlasStatus = vault.atlasStatus || null;

  if (online) {
    try {
      const License = require('../models/License');
      const LicenseActivation = require('../models/LicenseActivation');
      let lic = await License.findOne({ licenseId: _payload.licenseId }).lean();

      // If our license is gone or no longer ACTIVE, but the customer HAS a
      // current ACTIVE license (e.g. the build was regenerated), adopt that
      // one — its signature is verified against the embedded public key, so a
      // tampered row can't get in. This makes a rebuild take effect without a
      // reinstall.
      if (!lic || lic.status !== LICENSE_STATUS.ACTIVE) {
        const live = await License.findOne({
          customerId: _payload.customerId, status: LICENSE_STATUS.ACTIVE
        }).lean();
        if (live && live.signedLicense && live.licenseId !== _payload.licenseId) {
          try {
            verifyLicense(live.signedLicense, { now: tt.time }); // sig + not expired
            return await activate({ licString: live.signedLicense });
          } catch (e) { /* fall through to the normal failure below */ }
        }
      }

      if (!lic) return _fail(LICENSE_ERROR.LICENSE_NOT_FOUND, 'License not recognised by the server.', { online });

      atlasStatus = lic.status;
      if (lic.status === LICENSE_STATUS.REVOKED) return _fail(LICENSE_ERROR.LICENSE_REVOKED, 'License has been revoked.', { online, expiresAt: effectiveExpiresAt });
      if (lic.status === LICENSE_STATUS.SUSPENDED) return _fail(LICENSE_ERROR.LICENSE_SUSPENDED, 'License is suspended.', { online, expiresAt: effectiveExpiresAt });

      // extension: server may push expiry OUT, never pull it in
      effectiveExpiresAt = Math.max(effectiveExpiresAt, _num(lic.expiresAt));

      if (_payload.bindingMode !== 'none') {
        // read every tick (catches revoke / deactivate fast); write lastValidatedAt
        // at most once per ACT_HEARTBEAT_MS to keep Atlas write load low.
        const act = await LicenseActivation.findOne({ licenseId: _payload.licenseId, deviceHash: vault.deviceHash });
        if (!act || act.status === 'DEACTIVATED') {
          return _fail(LICENSE_ERROR.DEVICE_NOT_AUTHORIZED, 'This device is not authorised for the license.', { online, expiresAt: effectiveExpiresAt });
        }
        if (Date.now() - _lastActWriteMs > ACT_HEARTBEAT_MS) {
          _lastActWriteMs = Date.now();
          act.lastValidatedAt = new Date(tt.time);
          act.save().catch(() => {});
        }
      }

      _persist({
        lastOnlineValidationAt: new Date(tt.time).toISOString(),
        maxSeenServerTime: new Date(Math.max(_num(vault.maxSeenServerTime), _num(tt.time))).toISOString(),
        maxSeenAnyTime: new Date(Math.max(seenAny, _num(tt.time), systemNow)).toISOString(),
        atlasStatus: lic.status,
        atlasExpiresAt: new Date(_num(lic.expiresAt)).toISOString()
      });
    } catch (e) {
      // Atlas hiccup mid-request: fall back to offline evaluation this cycle
      return _evaluateOffline({ systemNow, seenAny, effectiveNow, clockTamper, vault });
    }

    return _finish({ effectiveNow, effectiveExpiresAt, online: true, atlasStatus, clockTamper: false });
  }

  return _evaluateOffline({ systemNow, seenAny, effectiveNow, clockTamper, vault });
}

function _evaluateOffline({ systemNow, seenAny, effectiveNow, clockTamper, vault }) {
  if (clockTamper) {
    return _fail(LICENSE_ERROR.CLOCK_CHANGE_DETECTED,
      'System clock change detected. Connect to the internet to continue.',
      { online: false });
  }

  // last-known-trusted atlas expiry is safe to honour (it was trusted when written
  // and only ever moves forward)
  let effectiveExpiresAt = Math.max(_num(_payload.expiresAt), _num(vault.atlasExpiresAt));

  // last-known-trusted revocation
  if (vault.atlasStatus === LICENSE_STATUS.REVOKED) {
    return _fail(LICENSE_ERROR.LICENSE_REVOKED, 'License has been revoked.', { online: false, expiresAt: effectiveExpiresAt });
  }
  if (vault.atlasStatus === LICENSE_STATUS.SUSPENDED) {
    return _fail(LICENSE_ERROR.LICENSE_SUSPENDED, 'License is suspended.', { online: false, expiresAt: effectiveExpiresAt });
  }

  // offline grace
  const graceMs = Math.max(0, (_payload.offlineGraceHours || 0) * 3600 * 1000);
  const anchor = _num(vault.lastOnlineValidationAt) || _num(vault.activatedAt);
  if (anchor) {
    const offlineFor = effectiveNow - anchor;
    if (offlineFor > graceMs) {
      return _fail(LICENSE_ERROR.OFFLINE_GRACE_EXCEEDED,
        'Offline for too long. Connect to the internet to re-validate your license.',
        { online: false, expiresAt: effectiveExpiresAt, graceRemainingMs: 0 });
    }
  }

  _persist({ maxSeenAnyTime: new Date(Math.max(seenAny, effectiveNow, systemNow)).toISOString() });
  return _finish({ effectiveNow, effectiveExpiresAt, online: false, atlasStatus: vault.atlasStatus || null, clockTamper: false });
}

function _finish({ effectiveNow, effectiveExpiresAt, online }) {
  if (effectiveNow >= effectiveExpiresAt) {
    return _fail(LICENSE_ERROR.LICENSE_EXPIRED, 'License expired. Please contact your administrator.', {
      online, expiresAt: effectiveExpiresAt
    });
  }
  const remaining = effectiveExpiresAt - effectiveNow;
  return _set({
    ok: true,
    status: remaining <= EXPIRY_WARNING_MS ? 'EXPIRING_SOON' : 'ACTIVE',
    code: null,
    reason: null,
    online,
    expiresAt: effectiveExpiresAt,
    graceRemainingMs: null,
    warning: remaining <= EXPIRY_WARNING_MS ? 'EXPIRING_SOON' : null,
    licenseId: _payload.licenseId,
    customerName: _payload.customerName,
    features: Array.isArray(_payload.features) ? _payload.features : []
  });
}

function _fail(code, reason, extra = {}) {
  const statusByCode = {
    [LICENSE_ERROR.LICENSE_EXPIRED]: 'EXPIRED',
    [LICENSE_ERROR.LICENSE_REVOKED]: 'REVOKED',
    [LICENSE_ERROR.LICENSE_SUSPENDED]: 'SUSPENDED',
    [LICENSE_ERROR.OFFLINE_GRACE_EXCEEDED]: 'GRACE',
    [LICENSE_ERROR.CLOCK_CHANGE_DETECTED]: 'CLOCK_TAMPER',
    [LICENSE_ERROR.DEVICE_NOT_AUTHORIZED]: 'DEVICE_BLOCKED',
    [LICENSE_ERROR.ACTIVATION_LIMIT_REACHED]: 'DEVICE_LIMIT',
    [LICENSE_ERROR.LICENSE_TAMPERED]: 'TAMPERED',
    [LICENSE_ERROR.INVALID_SIGNATURE]: 'TAMPERED',
    [LICENSE_ERROR.LICENSE_CORRUPTED]: 'TAMPERED',
    [LICENSE_ERROR.INVALID_LICENSE]: 'INVALID',
    [LICENSE_ERROR.LICENSE_NOT_FOUND]: 'INVALID',
    [LICENSE_ERROR.LICENSE_NOT_ACTIVATED]: 'NOT_ACTIVATED'
  };
  return _set({
    ok: false,
    status: statusByCode[code] || 'BLOCKED',
    code,
    reason,
    online: !!extra.online,
    expiresAt: extra.expiresAt != null ? extra.expiresAt : _state.expiresAt,
    graceRemainingMs: extra.graceRemainingMs != null ? extra.graceRemainingMs : null,
    warning: null,
    limit: extra.limit != null ? extra.limit : null,
    current: extra.current != null ? extra.current : null,
    licenseId: _payload ? _payload.licenseId : null,
    customerName: _payload ? _payload.customerName : null,
    features: []
  });
}

/** Local deactivation / wipe (does not free the Atlas slot — use the CLI for that). */
function clearLocal() {
  _licString = null;
  _payload = null;
  try { adapters.writeVault(null); } catch (e) {}
  _mem = null;
  return _set({
    ok: false, status: 'NOT_ACTIVATED', code: LICENSE_ERROR.LICENSE_NOT_ACTIVATED,
    reason: 'License removed from this device.', online: false,
    expiresAt: null, graceRemainingMs: null, warning: null,
    licenseId: null, customerName: null, features: []
  });
}

module.exports = {
  init,
  loadFromVault,
  setEmbeddedLicense,
  activate,
  evaluate,
  getState,
  isProtectedAllowed,
  clearLocal,
  _internals: { EXPIRY_WARNING_MS, SOFT_MATCH_THRESHOLD }
};
