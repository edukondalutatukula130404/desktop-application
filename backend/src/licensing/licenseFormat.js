/**
 * licenseFormat.js — SINGLE SOURCE OF TRUTH for the license wire format.
 *
 * Required by BOTH:
 *   - the offline signer  (tools/license-cli/*)
 *   - the desktop verifier (backend/src/licensing/verifyLicense.js)
 *
 * Never import anything environment-specific here. No secrets. Pure functions only.
 * Any change to canonicalPayload() is a BREAKING change to every issued license —
 * bump PAYLOAD_VERSION and keep the old branch.
 */

'use strict';

const PAYLOAD_VERSION = 1;
const SIGNING_ALG = 'Ed25519';
const PRODUCT_ID = 'nexussuite-desktop';

/** License lifecycle status (authoritative copy lives in the `licenses` Atlas collection). */
const LICENSE_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
  SUSPENDED: 'SUSPENDED'
});

/** How the license is tied to a machine. */
const BINDING_MODE = Object.freeze({
  SOFT: 'soft',     // weighted fingerprint match, tolerates hardware changes (default)
  STRICT: 'strict', // exact fingerprint match
  NONE: 'none'      // no device binding (VDI / shared terminals)
});

const LICENSE_TYPE = Object.freeze({
  DURATION: 'duration', // expiresAt = issuedAt + duration
  FIXED: 'fixed'        // expiresAt is an explicit calendar instant
});

/** Client-facing failure codes. Kept here so the desktop + backend never drift. */
const LICENSE_ERROR = Object.freeze({
  LICENSE_NOT_FOUND: 'LICENSE_NOT_FOUND',
  LICENSE_NOT_ACTIVATED: 'LICENSE_NOT_ACTIVATED',
  INVALID_LICENSE: 'INVALID_LICENSE',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  LICENSE_CORRUPTED: 'LICENSE_CORRUPTED',
  LICENSE_TAMPERED: 'LICENSE_TAMPERED',
  LICENSE_EXPIRED: 'LICENSE_EXPIRED',
  LICENSE_REVOKED: 'LICENSE_REVOKED',
  LICENSE_SUSPENDED: 'LICENSE_SUSPENDED',
  DEVICE_NOT_AUTHORIZED: 'DEVICE_NOT_AUTHORIZED',
  ACTIVATION_LIMIT_REACHED: 'ACTIVATION_LIMIT_REACHED',
  OFFLINE_GRACE_EXCEEDED: 'OFFLINE_GRACE_EXCEEDED',
  CLOCK_CHANGE_DETECTED: 'CLOCK_CHANGE_DETECTED',
  PRODUCT_MISMATCH: 'PRODUCT_MISMATCH',
  NOT_YET_VALID: 'NOT_YET_VALID',
  SERVER_UNAVAILABLE: 'SERVER_UNAVAILABLE'
});

/**
 * The exact set of fields that are signed, in a fixed order.
 * Anything not in this list is NOT covered by the signature and must never be
 * trusted for enforcement.
 */
const SIGNED_FIELDS = [
  'v',
  'alg',
  'keyId',
  'licenseId',
  'customerId',
  'customerName',
  'productId',
  'edition',
  'features',
  'licenseType',
  'issuedAt',
  'notBefore',
  'expiresAt',
  'maxActivations',
  'bindingMode',
  'offlineGraceHours'
];

function base64UrlEncode(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str) {
  const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s + pad, 'base64');
}

/**
 * Deterministic byte representation of the payload for signing / verifying.
 * Rules: only SIGNED_FIELDS, in SIGNED_FIELDS order, arrays kept as-is,
 * JSON with no whitespace, UTF-8. Identical on signer and verifier.
 */
function canonicalPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('canonicalPayload: payload must be an object');
  }
  const ordered = {};
  for (const key of SIGNED_FIELDS) {
    if (payload[key] === undefined) {
      throw new Error(`canonicalPayload: missing signed field "${key}"`);
    }
    ordered[key] = payload[key];
  }
  return Buffer.from(JSON.stringify(ordered), 'utf8');
}

/**
 * Envelope = base64url( JSON.stringify({ payload, signature }) ).
 * Single line, safe to paste into a text field or ship as a .lic file.
 */
function encodeLicenseFile(payload, signatureB64Url) {
  const envelope = { payload, signature: signatureB64Url };
  return base64UrlEncode(Buffer.from(JSON.stringify(envelope), 'utf8'));
}

function decodeLicenseFile(licString) {
  const raw = String(licString || '').trim().replace(/\s+/g, '');
  if (!raw) {
    const e = new Error('Empty license');
    e.code = LICENSE_ERROR.INVALID_LICENSE;
    throw e;
  }
  let envelope;
  try {
    envelope = JSON.parse(base64UrlDecode(raw).toString('utf8'));
  } catch (err) {
    const e = new Error('License is not valid base64url JSON');
    e.code = LICENSE_ERROR.LICENSE_CORRUPTED;
    throw e;
  }
  if (!envelope || typeof envelope !== 'object' || !envelope.payload || !envelope.signature) {
    const e = new Error('License envelope missing payload/signature');
    e.code = LICENSE_ERROR.LICENSE_CORRUPTED;
    throw e;
  }
  return { payload: envelope.payload, signature: envelope.signature };
}

/** Structural checks only — does NOT verify the signature or expiry. */
function assertPayloadShape(payload) {
  const fail = (msg, code) => {
    const e = new Error(msg);
    e.code = code || LICENSE_ERROR.INVALID_LICENSE;
    throw e;
  };
  if (!payload || typeof payload !== 'object') fail('payload not an object');
  if (payload.v !== PAYLOAD_VERSION) fail(`unsupported license version ${payload.v}`);
  if (payload.alg !== SIGNING_ALG) fail(`unsupported alg ${payload.alg}`);
  if (typeof payload.keyId !== 'string' || !payload.keyId) fail('missing keyId');
  if (typeof payload.licenseId !== 'string' || !payload.licenseId) fail('missing licenseId');
  if (payload.productId !== PRODUCT_ID) fail('product mismatch', LICENSE_ERROR.PRODUCT_MISMATCH);
  if (!Array.isArray(payload.features)) fail('features must be an array');
  if (![LICENSE_TYPE.DURATION, LICENSE_TYPE.FIXED].includes(payload.licenseType)) fail('bad licenseType');
  if (![BINDING_MODE.SOFT, BINDING_MODE.STRICT, BINDING_MODE.NONE].includes(payload.bindingMode)) fail('bad bindingMode');
  for (const k of ['issuedAt', 'notBefore', 'expiresAt']) {
    if (Number.isNaN(Date.parse(payload[k]))) fail(`bad date field ${k}`);
  }
  if (!Number.isInteger(payload.maxActivations) || payload.maxActivations < 1) fail('bad maxActivations');
  if (!Number.isInteger(payload.offlineGraceHours) || payload.offlineGraceHours < 0) fail('bad offlineGraceHours');
  return true;
}

module.exports = {
  PAYLOAD_VERSION,
  SIGNING_ALG,
  PRODUCT_ID,
  LICENSE_STATUS,
  BINDING_MODE,
  LICENSE_TYPE,
  LICENSE_ERROR,
  SIGNED_FIELDS,
  base64UrlEncode,
  base64UrlDecode,
  canonicalPayload,
  encodeLicenseFile,
  decodeLicenseFile,
  assertPayloadShape
};
