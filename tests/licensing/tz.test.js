'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { fmtIST, parseFlexibleToDate } = require('../../tools/license-cli/lib/tz');

test('fmtIST shifts UTC by +05:30 (HH:mm:ss IST)', () => {
  assert.strictEqual(fmtIST('2026-09-07T06:47:41.000Z'), '2026-09-07 12:17:41 IST');
  assert.strictEqual(fmtIST('2026-01-01T00:00:00Z'), '2026-01-01 05:30:00 IST');
  assert.strictEqual(fmtIST('2026-01-01T20:00:00Z'), '2026-01-02 01:30:00 IST');
});

test('parseFlexibleToDate respects an explicit offset', () => {
  const d = parseFlexibleToDate('2027-12-31T23:59:59+05:30');
  assert.strictEqual(d.toISOString(), '2027-12-31T18:29:59.000Z');
});

test('parseFlexibleToDate treats a bare timestamp as IST', () => {
  assert.strictEqual(parseFlexibleToDate('2027-12-31T23:59:59').toISOString(), '2027-12-31T18:29:59.000Z');
  assert.strictEqual(parseFlexibleToDate('2027-12-31 23:59:59').toISOString(), '2027-12-31T18:29:59.000Z');
});

test('parseFlexibleToDate keeps Z as UTC', () => {
  assert.strictEqual(parseFlexibleToDate('2027-12-31T23:59:59Z').toISOString(), '2027-12-31T23:59:59.000Z');
});
