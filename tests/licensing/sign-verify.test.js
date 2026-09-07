'use strict';
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');

const { signLicense } = require('../../tools/license-cli/lib/sign');
const { verifyLicense } = require('../../backend/src/licensing/verifyLicense');
const {
  decodeLicenseFile, encodeLicenseFile, LICENSE_ERROR,
  PRODUCT_ID, LICENSE_TYPE, BINDING_MODE
} = require('../../backend/src/licensing/licenseFormat');
const publicKeys = require('../../backend/src/licensing/publicKeys');

// Install a throwaway keypair under a test keyId so we don't depend on the
// committed dev key being present.
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const TEST_KEY_ID = 'test-key';
publicKeys.PUBLIC_KEYS[TEST_KEY_ID] = publicKey.export({ type: 'spki', format: 'pem' });

function fields(over = {}) {
  const now = new Date();
  return {
    keyId: TEST_KEY_ID, licenseId: 'lic_x', customerId: 'cus_x', customerName: 'X',
    productId: PRODUCT_ID, edition: 'standard', features: ['invoicing'],
    licenseType: LICENSE_TYPE.DURATION,
    issuedAt: now.toISOString(), notBefore: now.toISOString(),
    expiresAt: new Date(now.getTime() + 3600e3).toISOString(),
    maxActivations: 2, bindingMode: BINDING_MODE.SOFT, offlineGraceHours: 72,
    ...over
  };
}

test('valid license verifies and round-trips fields', () => {
  const { licenseFile, payload } = signLicense(fields(), privateKey);
  const { payload: got } = verifyLicense(licenseFile);
  assert.strictEqual(got.licenseId, payload.licenseId);
  assert.strictEqual(got.expiresAt, payload.expiresAt);
});

test('tampering with expiresAt but keeping the signature is rejected', () => {
  const { licenseFile } = signLicense(fields(), privateKey);
  const { payload, signature } = decodeLicenseFile(licenseFile);
  payload.expiresAt = new Date(Date.now() + 3650 * 24 * 3600e3).toISOString();
  const forged = encodeLicenseFile(payload, signature);
  assert.throws(() => verifyLicense(forged), (e) => e.code === LICENSE_ERROR.INVALID_SIGNATURE);
});

test('unknown keyId is rejected', () => {
  const { licenseFile } = signLicense(fields({ keyId: 'no-such-key' }), privateKey);
  assert.throws(() => verifyLicense(licenseFile), (e) => e.code === LICENSE_ERROR.INVALID_SIGNATURE);
});

test('wrong-key signature is rejected', () => {
  const other = crypto.generateKeyPairSync('ed25519').privateKey;
  const { licenseFile } = signLicense(fields(), other);
  assert.throws(() => verifyLicense(licenseFile), (e) => e.code === LICENSE_ERROR.INVALID_SIGNATURE);
});

test('expired license is rejected on time check but ok with skipTimeChecks', () => {
  const past = new Date(Date.now() - 10 * 60e3).toISOString();
  const { licenseFile } = signLicense(fields({
    notBefore: new Date(Date.now() - 3600e3).toISOString(), expiresAt: past
  }), privateKey);
  assert.throws(() => verifyLicense(licenseFile), (e) => e.code === LICENSE_ERROR.LICENSE_EXPIRED);
  assert.doesNotThrow(() => verifyLicense(licenseFile, { skipTimeChecks: true }));
});

test('not-yet-valid license is rejected', () => {
  const future = new Date(Date.now() + 3600e3).toISOString();
  const { licenseFile } = signLicense(fields({
    notBefore: future, expiresAt: new Date(Date.now() + 7200e3).toISOString()
  }), privateKey);
  assert.throws(() => verifyLicense(licenseFile), (e) => e.code === LICENSE_ERROR.NOT_YET_VALID);
});
