/**
 * publicKeys.js — Ed25519 PUBLIC verification keys, keyed by keyId.
 *
 * SAFE to ship inside the desktop .exe. Contains no secret material — a public
 * key can only VERIFY a signature, never create one.
 *
 * Key rotation:
 *   1. `npm run license:keygen -- nxs-2027-01`
 *   2. add the new public key below (keep the old one so existing licenses verify)
 *   3. issue new licenses with LICENSE_KEY_ID=nxs-2027-01
 *   4. retire the old key only after every license signed with it has expired
 *
 * The matching PRIVATE keys live ONLY in tools/license-cli/keys/ on the
 * operator's machine and are gitignored.
 */

'use strict';

const PUBLIC_KEYS = {
  // Production signing key — used to sign customer licenses.
  'nxs-2026-01': `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAFlENP+6AC1FJ7q5DqFC4gIz7w4PnRkFDEm0KwF5vHZc=
-----END PUBLIC KEY-----`,

  // Development / internal testing key — kept for the test suite only.
  'nxs-dev-2026': `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA3yapc56dfMChHLvPdOXj4XUWFc8zB0aPkGVrBK85KEk=
-----END PUBLIC KEY-----`
};

/** keyId used when the desktop needs to display/report which key it trusts. */
const DEFAULT_KEY_ID = 'nxs-2026-01';

function getPublicKeyPem(keyId) {
  return PUBLIC_KEYS[keyId] || null;
}

function hasKey(keyId) {
  return Object.prototype.hasOwnProperty.call(PUBLIC_KEYS, keyId);
}

function listKeyIds() {
  return Object.keys(PUBLIC_KEYS);
}

module.exports = { PUBLIC_KEYS, DEFAULT_KEY_ID, getPublicKeyPem, hasKey, listKeyIds };
