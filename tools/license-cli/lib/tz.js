/**
 * tz.js — India Standard Time helpers for the license CLI.
 *
 * IST is a fixed UTC+05:30 (no DST), so we can format/parse without any
 * timezone database. The stored value in the .lic / Atlas stays a UTC instant;
 * this is display + input convenience only.
 */

'use strict';

const IST_OFFSET_MIN = 330; // +05:30

/** Format a Date as "YYYY-MM-DD HH:mm:ss IST". */
function fmtIST(d) {
  const t = (d instanceof Date ? d : new Date(d));
  if (Number.isNaN(t.getTime())) return String(d);
  const shifted = new Date(t.getTime() + IST_OFFSET_MIN * 60000);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return (
    `${shifted.getUTCFullYear()}-${p(shifted.getUTCMonth() + 1)}-${p(shifted.getUTCDate())} ` +
    `${p(shifted.getUTCHours())}:${p(shifted.getUTCMinutes())}:${p(shifted.getUTCSeconds())} IST`
  );
}

/**
 * Parse an --expires-at value. If it carries a timezone (Z or +hh:mm) it is
 * respected; a bare "YYYY-MM-DDTHH:mm[:ss]" (or with a space) is interpreted as
 * IST wall-clock time.
 */
function parseFlexibleToDate(str) {
  const s = String(str || '').trim();
  if (!s) return new Date(NaN);
  const hasTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(s);
  if (hasTz) return new Date(s);
  // bare local time -> treat as IST
  const norm = s.replace(' ', 'T');
  return new Date(norm + '+05:30');
}

module.exports = { fmtIST, parseFlexibleToDate, IST_OFFSET_MIN };
