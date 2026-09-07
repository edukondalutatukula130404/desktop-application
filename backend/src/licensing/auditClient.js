/**
 * auditClient.js — best-effort license audit writes from the desktop side.
 * Never throws, never blocks enforcement. No secrets in `detail`.
 */

'use strict';

async function audit(event, fields = {}) {
  try {
    const LicenseAuditLog = require('../models/LicenseAuditLog');
    const mongoose = require('mongoose');
    if (!mongoose.connection || mongoose.connection.readyState !== 1) return; // offline: skip
    await LicenseAuditLog.create({
      event,
      source: 'desktop',
      serverTime: new Date(),
      ...fields
    });
  } catch (e) {
    // swallow — audit is advisory
  }
}

module.exports = { audit };
