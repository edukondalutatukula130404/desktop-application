'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { parseDuration } = require('../../tools/license-cli/lib/duration');

const H = 3600e3, D = 24 * H;

test('parses common specs', () => {
  assert.strictEqual(parseDuration('1h'), H);
  assert.strictEqual(parseDuration('90m'), 90 * 60e3);
  assert.strictEqual(parseDuration('7d'), 7 * D);
  assert.strictEqual(parseDuration('2w'), 14 * D);
  assert.strictEqual(parseDuration('6mo'), 6 * 30 * D);
  assert.strictEqual(parseDuration('1y'), 365 * D);
});

test('tolerates whitespace and case', () => {
  assert.strictEqual(parseDuration(' 30D '), 30 * D);
  assert.strictEqual(parseDuration('1 H'), H);
});

test('rejects nonsense', () => {
  for (const bad of ['', 'abc', '10', '-5d', '0h', '5x', '1 month', '1.d']) {
    assert.throws(() => parseDuration(bad), new RegExp('Invalid'), `should reject "${bad}"`);
  }
});
