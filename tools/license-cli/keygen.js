#!/usr/bin/env node
/**
 * keygen.js — generate an Ed25519 signing keypair for licenses.
 *
 *   npm run license:keygen -- <keyId>
 *   node tools/license-cli/keygen.js nxs-2026-01
 *
 * Writes:
 *   tools/license-cli/keys/<keyId>.private.pem   → KEEP SECRET. Never commit. Never ship.
 *   tools/license-cli/keys/<keyId>.public.pem    → paste into backend/src/licensing/publicKeys.js
 *
 * The keys/ directory is gitignored. Back up the private key somewhere safe and
 * offline — if you lose it you cannot issue or renew licenses for that keyId.
 */

'use strict';

const { generateKeyPair } = require('./lib/keys');

const keyId = (process.argv[2] || '').trim();
if (!keyId) {
  console.error('Usage: node tools/license-cli/keygen.js <keyId>   e.g. nxs-2026-01');
  process.exit(1);
}

try {
  const { privPath, pubPath, pubPem } = generateKeyPair(keyId);
  console.log('\nEd25519 keypair generated.\n');
  console.log('  Private key :', privPath, '  (SECRET — do not commit, do not ship)');
  console.log('  Public key  :', pubPath);
  console.log('\nAdd this entry to backend/src/licensing/publicKeys.js  ->  PUBLIC_KEYS:\n');
  console.log(`  '${keyId}': \`` + pubPem.trim() + '`,\n');
  console.log('Then set  LICENSE_KEY_ID=' + keyId + '  in tools/license-cli/.env.license');
} catch (err) {
  console.error('keygen failed:', err.message);
  process.exit(1);
}
