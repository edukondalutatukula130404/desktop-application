/**
 * sign.js — produce a signed license envelope. OFFLINE operator machine only.
 */

'use strict';

const crypto = require('crypto');
const {
  PAYLOAD_VERSION,
  SIGNING_ALG,
  canonicalPayload,
  encodeLicenseFile,
  base64UrlEncode,
  assertPayloadShape
} = require('../../../backend/src/licensing/licenseFormat');

/**
 * @param {object} payloadFields  fully-populated payload minus v/alg (added here)
 * @param {import('crypto').KeyObject} privateKey  Ed25519 private key
 * @returns {{ payload: object, signature: string, licenseFile: string }}
 */
function signLicense(payloadFields, privateKey) {
  const payload = { v: PAYLOAD_VERSION, alg: SIGNING_ALG, ...payloadFields };
  assertPayloadShape(payload);

  const message = canonicalPayload(payload);
  // Ed25519: pass null as the digest algorithm.
  const sig = crypto.sign(null, message, privateKey);
  const signature = base64UrlEncode(sig);

  return {
    payload,
    signature,
    licenseFile: encodeLicenseFile(payload, signature)
  };
}

module.exports = { signLicense };
