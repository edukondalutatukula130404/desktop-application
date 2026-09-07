/**
 * trustedTime.js — obtain a time value the customer cannot fake locally.
 *
 * Source of truth = the MongoDB Atlas server clock (TLS-authenticated; the
 * customer cannot forge it without breaking the connection). Falls back to the
 * local system clock, flagged as untrusted, when Atlas is unreachable.
 */

'use strict';

const mongoose = require('mongoose');

let _lastTrusted = null; // { time: Date, at: number(hrtime ms) }

function _hrNowMs() {
  return Number(process.hrtime.bigint() / 1000000n);
}

/**
 * @returns {Promise<{ time: Date, trusted: boolean, source: string }>}
 */
async function getTrustedTime() {
  // Test aid: force the offline path without pulling the network. Never set in
  // a production build (asserted by the Phase 6 afterPack check).
  if (process.env.LICENSE_FORCE_OFFLINE === '1') {
    if (_lastTrusted) {
      const elapsed = Math.max(0, _hrNowMs() - _lastTrusted.at);
      return { time: new Date(_lastTrusted.time.getTime() + elapsed), trusted: false, source: 'forced-offline' };
    }
    return { time: new Date(), trusted: false, source: 'forced-offline' };
  }

  try {
    if (mongoose.connection && mongoose.connection.readyState === 1 && mongoose.connection.db) {
      const admin = mongoose.connection.db.admin();
      let res;
      try {
        res = await admin.command({ hello: 1 });
      } catch (e) {
        res = await admin.command({ isMaster: 1 });
      }
      const t = res && res.localTime ? new Date(res.localTime) : null;
      if (t && !Number.isNaN(t.getTime())) {
        _lastTrusted = { time: t, at: _hrNowMs() };
        return { time: t, trusted: true, source: 'atlas' };
      }
    }
  } catch (e) {
    // fall through
  }

  // Offline: project the last trusted time forward by monotonic elapsed if we have one.
  if (_lastTrusted) {
    const elapsed = Math.max(0, _hrNowMs() - _lastTrusted.at);
    return {
      time: new Date(_lastTrusted.time.getTime() + elapsed),
      trusted: false,
      source: 'projected'
    };
  }

  return { time: new Date(), trusted: false, source: 'system' };
}

function getLastTrusted() {
  return _lastTrusted ? new Date(_lastTrusted.time.getTime()) : null;
}

module.exports = { getTrustedTime, getLastTrusted };
