/**
 * licenseMiddleware — blocks protected API traffic whenever the license is not
 * in an OK state. Reads the cached licenseState snapshot (sync, no I/O); a
 * background timer / the main-process watchdog keeps that snapshot fresh.
 *
 * This is the defense-in-depth layer: even if the renderer UI is bypassed, the
 * data APIs stop responding the moment the license lapses.
 */

'use strict';

const licenseState = require('../licensing/licenseState');
const { ENFORCED } = require('../licensing/enforcement');

// Background reconciliation (multi-device sync) is NEVER license-gated: a
// briefly-locked device must keep its local data in sync with the cloud so it
// is current the moment the license is renewed. The UI is still locked, and
// user *actions* (create/update/delete) go through the gated /api/business/*
// routes, so nothing new can be written from a locked device.
const SYNC_PATH = /\/sync(\/|$)/;

module.exports = function licenseMiddleware(req, res, next) {
  if (!ENFORCED) return next();
  if (SYNC_PATH.test(req.originalUrl || req.url || '')) return next();

  const st = licenseState.getState();
  if (st && st.ok === true) return next();

  const httpStatus = (st && st.status === 'NOT_ACTIVATED') ? 402 : 403;
  return res.status(httpStatus).json({
    success: false,
    licenseBlocked: true,
    code: (st && st.code) || 'LICENSE_INVALID',
    licenseStatus: (st && st.status) || 'BLOCKED',
    message: (st && st.reason) || 'This application is not licensed. Please contact your administrator.'
  });
};
