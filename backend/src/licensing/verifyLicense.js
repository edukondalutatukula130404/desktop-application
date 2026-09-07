/**
 * verifyLicense.js — cryptographic + structural verification of a .lic string.
 *
 * Pure and synchronous. No DB, no network, no clock policy beyond a caller-
 * supplied `now`. Used by both online and offline paths in licenseState.js.
 */

'use strict';

const crypto = require('crypto');
const {
  canonicalPayload,
  decodeLicenseFile,
  base64UrlDecode,
  assertPayloadShape,
  LICENSE_ERROR
} = require('./licenseFormat');
const { getPublicKeyPem } = require('./publicKeys');

function err(code, message) {
  const e = new Error(message || code);
  e.code = code;
  return e;
}

/**
 * @param {string} licString                 the .lic envelope
 * @param {object} [opts]
 * @param {Date}   [opts.now]                 trusted "now" for time checks (default: system time)
 * @param {boolean}[opts.skipTimeChecks]      verify signature/shape only
 * @returns {{ payload: object }}             on success
 * @throws  {Error & { code }}                LICENSE_ERROR.* on failure
 */
function verifyLicense(licString, opts = {}) {
  const now = opts.now instanceof Date ? opts.now : new Date();

  const { payload, signature } = decodeLicenseFile(licString); // throws LICENSE_CORRUPTED / INVALID_LICENSE
  assertPayloadShape(payload); // throws INVALID_LICENSE / PRODUCT_MISMATCH

  const pubPem = getPublicKeyPem(payload.keyId);
  if (!pubPem) {
    throw err(LICENSE_ERROR.INVALID_SIGNATURE, `unknown signing key "${payload.keyId}"`);
  }

  let sigOk = false;
  try {
    sigOk = crypto.verify(
      null,
      canonicalPayload(payload),
      crypto.createPublicKey(pubPem),
      base64UrlDecode(signature)
    );
  } catch (e) {
    throw err(LICENSE_ERROR.INVALID_SIGNATURE, 'signature verification error: ' + e.message);
  }
  if (!sigOk) throw err(LICENSE_ERROR.INVALID_SIGNATURE, 'signature does not match');

  if (!opts.skipTimeChecks) {
    const nb = new Date(payload.notBefore);
    const exp = new Date(payload.expiresAt);
    if (now.getTime() < nb.getTime()) {
      throw err(LICENSE_ERROR.NOT_YET_VALID, `license not valid before ${payload.notBefore}`);
    }
    if (now.getTime() >= exp.getTime()) {
      throw err(LICENSE_ERROR.LICENSE_EXPIRED, `license expired at ${payload.expiresAt}`);
    }
  }

  return { payload };
}

module.exports = { verifyLicense };
