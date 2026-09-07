#!/usr/bin/env node
/**
 * extend.js — push a license's expiry further out.
 *
 *   npm run license:extend -- --license lic_xxx --expires-at 2027-06-30T23:59:59+05:30
 *   npm run license:extend -- --license lic_xxx --by 30d
 *   npm run license:extend -- --license lic_xxx --by 30d --reissue     (also write a new .lic)
 *
 * Atlas update alone is enough for ONLINE clients: the desktop verifier uses
 * max(signed expiresAt, Atlas expiresAt) while online + status ACTIVE.
 * Use --reissue to also give the customer a fresh .lic that carries the new
 * date for OFFLINE use.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { parseArgs } = require('./lib/args');
const { parseDuration } = require('./lib/duration');
const { loadPrivateKey } = require('./lib/keys');
const { signLicense } = require('./lib/sign');
const { fmtIST, parseFlexibleToDate } = require('./lib/tz');
const { LICENSE_TYPE } = require('../../backend/src/licensing/licenseFormat');
const { getPublicKeyPem } = require('../../backend/src/licensing/publicKeys');

const args = parseArgs(process.argv.slice(2), ['reissue']);
function die(m) { console.error('extend: ' + m); process.exit(1); }

const licenseId = args.license || args._[0];
if (!licenseId) die('--license <licenseId> is required');
if (!args['expires-at'] && !args.by) die('one of --expires-at or --by is required');

(async () => {
  const db = require('./lib/db');
  try {
    await db.connect();
    const lic = await db.License.findOne({ licenseId });
    if (!lic) die(`no license found with id ${licenseId}`);

    const current = new Date(lic.expiresAt);
    let next;
    if (args['expires-at']) {
      next = parseFlexibleToDate(args['expires-at']); // bare time = IST
      if (Number.isNaN(next.getTime())) die('bad --expires-at (ISO-8601; bare time = IST)');
    } else {
      next = new Date(current.getTime() + parseDuration(args.by));
    }
    if (next <= current) die(`new expiry ${fmtIST(next)} is not after current ${fmtIST(current)}`);

    await db.License.updateOne(
      { licenseId },
      { $set: { expiresAt: next, status: 'ACTIVE', durationSpec: args.by ? `${lic.durationSpec || ''}+${args.by}` : lic.durationSpec } }
    );
    await db.audit('LICENSE_EXTENDED', {
      licenseId, customerId: lic.customerId,
      detail: { from: current.toISOString(), to: next.toISOString() }
    });
    console.log(`\n${licenseId}: expires  ${fmtIST(current)}  ->  ${fmtIST(next)}`);
    console.log('Online clients pick this up at their next validation.');

    if (args.reissue) {
      const keyId = lic.keyId;
      if (!getPublicKeyPem(keyId)) die(`keyId "${keyId}" missing from publicKeys.js — cannot reissue`);
      const privateKey = loadPrivateKey({ keyId, privateKeyPath: process.env.LICENSE_PRIVATE_KEY_PATH || undefined });
      const now = new Date();
      const { licenseFile } = signLicense({
        keyId,
        licenseId: lic.licenseId, // same identity — activations and the Atlas row carry over
        customerId: lic.customerId,
        customerName: lic.customerName,
        productId: lic.productId,
        edition: lic.edition,
        features: lic.features,
        licenseType: LICENSE_TYPE.FIXED,
        issuedAt: now.toISOString(),
        notBefore: now.toISOString(),
        expiresAt: next.toISOString(),
        maxActivations: lic.maxActivations,
        bindingMode: lic.bindingMode,
        offlineGraceHours: lic.offlineGraceHours
      }, privateKey);

      const outDir = path.resolve(path.join(__dirname, '..', '..', 'dist-licenses'));
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      const outPath = path.join(outDir, `${lic.customerId}__${lic.licenseId}__renew_${Date.now()}.lic`);
      fs.writeFileSync(outPath, licenseFile + '\n', 'utf8');
      console.log('  reissued .lic:', outPath);
      console.log('  Same licenseId — the customer replaces their .lic file; activation is unaffected.');
    }
    console.log('');
  } catch (e) {
    die(e.message);
  } finally {
    await db.disconnect();
  }
})();
