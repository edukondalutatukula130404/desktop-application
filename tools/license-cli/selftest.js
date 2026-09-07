#!/usr/bin/env node
/**
 * selftest.js — Phase 1 contract check.
 *
 * Proves the sign (CLI) / verify (desktop) round-trip using the shared
 * licenseFormat module and the committed public key. No DB, no network.
 *
 *   npm run license:selftest
 */

'use strict';

const crypto = require('crypto');
const {
  PRODUCT_ID,
  LICENSE_TYPE,
  BINDING_MODE,
  canonicalPayload,
  encodeLicenseFile,
  decodeLicenseFile,
  base64UrlDecode,
  assertPayloadShape
} = require('../../backend/src/licensing/licenseFormat');
const { getPublicKeyPem } = require('../../backend/src/licensing/publicKeys');
const { loadPrivateKey } = require('./lib/keys');
const { signLicense } = require('./lib/sign');

const KEY_ID = process.env.LICENSE_KEY_ID || 'nxs-dev-2026';

function check(name, cond) {
  if (cond) { console.log('  ok  ', name); return; }
  console.error('  FAIL', name);
  process.exitCode = 1;
}

function verify(licString) {
  const { payload, signature } = decodeLicenseFile(licString);
  assertPayloadShape(payload);
  const pubPem = getPublicKeyPem(payload.keyId);
  if (!pubPem) throw new Error(`no public key for keyId ${payload.keyId}`);
  const ok = crypto.verify(
    null,
    canonicalPayload(payload),
    crypto.createPublicKey(pubPem),
    base64UrlDecode(signature)
  );
  return { ok, payload };
}

(function main() {
  console.log(`\nPhase 1 licensing self-test (keyId=${KEY_ID})\n`);

  let privateKey;
  try {
    privateKey = loadPrivateKey({ keyId: KEY_ID });
  } catch (e) {
    console.error('Cannot load private key:', e.message);
    console.error('Run: npm run license:keygen -- ' + KEY_ID);
    process.exit(1);
  }

  const now = new Date();
  const fields = {
    keyId: KEY_ID,
    licenseId: 'lic_selftest_' + crypto.randomBytes(4).toString('hex'),
    customerId: 'cus_selftest',
    customerName: 'Self Test Co',
    productId: PRODUCT_ID,
    edition: 'standard',
    features: ['invoicing', 'backup', 'multi-device'],
    licenseType: LICENSE_TYPE.DURATION,
    issuedAt: now.toISOString(),
    notBefore: now.toISOString(),
    expiresAt: new Date(now.getTime() + 3600 * 1000).toISOString(),
    maxActivations: 2,
    bindingMode: BINDING_MODE.SOFT,
    offlineGraceHours: 72
  };

  const { licenseFile, payload } = signLicense(fields, privateKey);
  check('sign produced a non-empty license string', typeof licenseFile === 'string' && licenseFile.length > 40);

  const good = verify(licenseFile);
  check('valid license verifies', good.ok === true);
  check('payload round-trips licenseId', good.payload.licenseId === payload.licenseId);
  check('payload round-trips expiresAt', good.payload.expiresAt === payload.expiresAt);

  // Tamper: decode, bump expiresAt by 10 years, re-encode with the ORIGINAL signature.
  const { payload: p2, signature: sig2 } = decodeLicenseFile(licenseFile);
  p2.expiresAt = new Date(now.getTime() + 3600 * 1000 * 24 * 3650).toISOString();
  const forged = encodeLicenseFile(p2, sig2);
  let forgedRejected = false;
  try {
    const r = verify(forged);
    forgedRejected = r.ok === false;
  } catch (e) {
    forgedRejected = true;
  }
  check('tampered expiresAt is rejected', forgedRejected);

  // Tamper: flip one signature byte.
  const flipped = encodeLicenseFile(payload, sig2.slice(0, -2) + (sig2.slice(-2) === 'AA' ? 'AB' : 'AA'));
  let flippedRejected = false;
  try { flippedRejected = verify(flipped).ok === false; } catch (e) { flippedRejected = true; }
  check('flipped signature byte is rejected', flippedRejected);

  console.log(process.exitCode ? '\nSELF-TEST FAILED\n' : '\nAll Phase 1 checks passed.\n');
})();
