'use strict';
const test = require('node:test');
const assert = require('node:assert');
const {
  canonicalPayload, encodeLicenseFile, decodeLicenseFile,
  assertPayloadShape, base64UrlEncode, base64UrlDecode,
  PRODUCT_ID, PAYLOAD_VERSION, SIGNING_ALG, LICENSE_TYPE, BINDING_MODE, LICENSE_ERROR
} = require('../../backend/src/licensing/licenseFormat');

function validPayload(over = {}) {
  const now = new Date().toISOString();
  return {
    v: PAYLOAD_VERSION, alg: SIGNING_ALG, keyId: 'k1',
    licenseId: 'lic_1', customerId: 'cus_1', customerName: 'C',
    productId: PRODUCT_ID, edition: 'standard', features: ['invoicing'],
    licenseType: LICENSE_TYPE.DURATION, issuedAt: now, notBefore: now,
    expiresAt: new Date(Date.now() + 3600e3).toISOString(),
    maxActivations: 2, bindingMode: BINDING_MODE.SOFT, offlineGraceHours: 72,
    ...over
  };
}

test('canonicalPayload is deterministic regardless of key insertion order', () => {
  const a = validPayload();
  const b = {};
  Object.keys(a).reverse().forEach((k) => { b[k] = a[k]; });
  assert.strictEqual(canonicalPayload(a).toString(), canonicalPayload(b).toString());
});

test('canonicalPayload ignores unsigned extra fields', () => {
  const a = validPayload();
  const b = { ...a, sneaky: 'x', signature: 'nope' };
  assert.strictEqual(canonicalPayload(a).toString(), canonicalPayload(b).toString());
});

test('canonicalPayload throws on a missing signed field', () => {
  const a = validPayload();
  delete a.expiresAt;
  assert.throws(() => canonicalPayload(a), /expiresAt/);
});

test('base64url round-trips arbitrary bytes', () => {
  const buf = Buffer.from([0, 255, 10, 13, 43, 47, 61, 200]);
  assert.deepStrictEqual(base64UrlDecode(base64UrlEncode(buf)), buf);
});

test('encode/decode license envelope round-trips', () => {
  const p = validPayload();
  const s = encodeLicenseFile(p, 'SIG');
  assert.strictEqual(typeof s, 'string');
  assert.ok(!/\s/.test(s), 'envelope must be single-line');
  const { payload, signature } = decodeLicenseFile(s);
  assert.deepStrictEqual(payload, p);
  assert.strictEqual(signature, 'SIG');
});

test('decodeLicenseFile rejects garbage with LICENSE_CORRUPTED', () => {
  try { decodeLicenseFile('!!!not-base64!!!'); assert.fail('should throw'); }
  catch (e) { assert.strictEqual(e.code, LICENSE_ERROR.LICENSE_CORRUPTED); }
});

test('decodeLicenseFile rejects empty input', () => {
  assert.throws(() => decodeLicenseFile('  '));
});

test('assertPayloadShape rejects wrong productId', () => {
  try { assertPayloadShape(validPayload({ productId: 'other-app' })); assert.fail(); }
  catch (e) { assert.strictEqual(e.code, LICENSE_ERROR.PRODUCT_MISMATCH); }
});

test('assertPayloadShape rejects unknown version / alg / bindingMode / bad dates', () => {
  assert.throws(() => assertPayloadShape(validPayload({ v: 99 })));
  assert.throws(() => assertPayloadShape(validPayload({ alg: 'RS256' })));
  assert.throws(() => assertPayloadShape(validPayload({ bindingMode: 'weird' })));
  assert.throws(() => assertPayloadShape(validPayload({ expiresAt: 'not-a-date' })));
  assert.throws(() => assertPayloadShape(validPayload({ maxActivations: 0 })));
});
