/**
 * duration.js — parse human duration specs into milliseconds.
 *   "1h" "90m" "7d" "2w" "6mo" "1y"  ->  ms
 * Months = 30d, years = 365d (calendar-agnostic; fixed dates use --expires-at).
 */

'use strict';

const UNIT_MS = {
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
  mo: 30 * 24 * 60 * 60 * 1000,
  y: 365 * 24 * 60 * 60 * 1000
};

function parseDuration(spec) {
  const s = String(spec || '').trim().toLowerCase();
  const match = s.match(/^(\d+(?:\.\d+)?)\s*(mo|m|h|d|w|y)$/);
  if (!match) {
    throw new Error(
      `Invalid duration "${spec}". Use e.g. 1h, 90m, 7d, 2w, 6mo, 1y.`
    );
  }
  const value = parseFloat(match[1]);
  const unit = match[2];
  if (!(unit in UNIT_MS) || value <= 0) {
    throw new Error(`Invalid duration "${spec}".`);
  }
  return Math.round(value * UNIT_MS[unit]);
}

module.exports = { parseDuration, UNIT_MS };
