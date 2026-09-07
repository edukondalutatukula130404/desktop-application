/**
 * keys.js — Ed25519 key handling for the OFFLINE license signer.
 *
 * This file runs ONLY on the license operator's machine (never shipped in the
 * .exe, never deployed). The private key it loads must never leave this machine
 * and must never be committed.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KEYS_DIR = path.join(__dirname, '..', 'keys');

function ensureKeysDir() {
  if (!fs.existsSync(KEYS_DIR)) fs.mkdirSync(KEYS_DIR, { recursive: true });
}

/** Generate a fresh Ed25519 keypair and persist both PEM files under tools/license-cli/keys/. */
function generateKeyPair(keyId) {
  if (!/^[a-z0-9-]{3,40}$/.test(keyId || '')) {
    throw new Error('keyId must match /^[a-z0-9-]{3,40}$/ (e.g. "nxs-2026-01")');
  }
  ensureKeysDir();
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const pubPem = publicKey.export({ type: 'spki', format: 'pem' });

  const privPath = path.join(KEYS_DIR, `${keyId}.private.pem`);
  const pubPath = path.join(KEYS_DIR, `${keyId}.public.pem`);
  if (fs.existsSync(privPath)) {
    throw new Error(`Refusing to overwrite existing private key: ${privPath}`);
  }
  fs.writeFileSync(privPath, privPem, { mode: 0o600 });
  fs.writeFileSync(pubPath, pubPem);

  return { keyId, privPath, pubPath, privPem, pubPem };
}

/** Load a private key by keyId (from tools/license-cli/keys/) or from an explicit path. */
function loadPrivateKey({ keyId, privateKeyPath, privateKeyPem } = {}) {
  let pem = privateKeyPem;
  if (!pem && privateKeyPath) pem = fs.readFileSync(privateKeyPath, 'utf8');
  if (!pem && keyId) {
    const p = path.join(KEYS_DIR, `${keyId}.private.pem`);
    if (fs.existsSync(p)) pem = fs.readFileSync(p, 'utf8');
  }
  if (!pem) {
    throw new Error(
      'No private key found. Run "npm run license:keygen -- <keyId>" or set LICENSE_PRIVATE_KEY_PATH.'
    );
  }
  return crypto.createPrivateKey(pem);
}

/** Load a public key PEM for a keyId (used to self-check a freshly signed license). */
function loadPublicKeyPem(keyId) {
  const p = path.join(KEYS_DIR, `${keyId}.public.pem`);
  if (!fs.existsSync(p)) throw new Error(`Public key not found for keyId "${keyId}": ${p}`);
  return fs.readFileSync(p, 'utf8');
}

module.exports = { KEYS_DIR, generateKeyPair, loadPrivateKey, loadPublicKeyPem };
