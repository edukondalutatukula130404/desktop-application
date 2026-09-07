#!/usr/bin/env node
/**
 * issue.js — create ONE signed license. Offline operator machine only.
 *
 *   npm run license:issue -- --customer "ABC Clothing" --customer-id cus_abc --duration 30d
 *   npm run license:issue -- --customer "XYZ" --customer-id cus_xyz --expires-at 2027-12-31T23:59:59+05:30
 *
 * Flags:
 *   --customer <name>            (required)
 *   --customer-id <id>           (required)
 *   --duration <spec>            1h | 90m | 7d | 2w | 6mo | 1y     (mutually exclusive with --expires-at)
 *   --expires-at <ISO-8601>      fixed calendar instant, keep the timezone offset
 *   --features a,b,c             default from .env.license (DEFAULT_FEATURES)
 *   --edition <name>             default "standard"
 *   --max-activations <n>        default 2
 *   --binding soft|strict|none   default "soft"
 *   --offline-grace-hours <n>    default 72
 *   --key-id <keyId>             default from LICENSE_KEY_ID
 *   --not-before <ISO>           default now
 *   --no-db                      sign + write the .lic file, but do NOT touch Atlas (dry sign)
 *   --out <dir>                  default dist-licenses/
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
const {
  PRODUCT_ID, LICENSE_TYPE, BINDING_MODE, canonicalPayload, decodeLicenseFile,
  base64UrlDecode
} = require('../../backend/src/licensing/licenseFormat');
const { getPublicKeyPem } = require('../../backend/src/licensing/publicKeys');

require('dotenv').config({ path: path.join(__dirname, '.env.license') });

const args = parseArgs(process.argv.slice(2), ['no-db']);

function die(msg) { console.error('issue: ' + msg); process.exit(1); }

const customerName = args.customer;
const customerId = args['customer-id'];
if (!customerName) die('--customer is required');
if (!customerId) die('--customer-id is required');
if (args.duration && args['expires-at']) die('use either --duration OR --expires-at, not both');
if (!args.duration && !args['expires-at']) die('one of --duration or --expires-at is required');

const keyId = args['key-id'] || process.env.LICENSE_KEY_ID;
if (!keyId) die('no key id (pass --key-id or set LICENSE_KEY_ID)');
if (!getPublicKeyPem(keyId)) {
  die(`keyId "${keyId}" has no matching public key in backend/src/licensing/publicKeys.js — add it before issuing`);
}

const now = new Date();
const notBefore = args['not-before'] ? parseFlexibleToDate(args['not-before']) : now;
if (Number.isNaN(notBefore.getTime())) die('bad --not-before');

let expiresAt;
let licenseType;
let durationSpec = '';
if (args.duration) {
  licenseType = LICENSE_TYPE.DURATION;
  durationSpec = String(args.duration);
  expiresAt = new Date(notBefore.getTime() + parseDuration(args.duration));
} else {
  licenseType = LICENSE_TYPE.FIXED;
  // Offset-aware value is respected; a bare date/time is read as IST wall-clock.
  expiresAt = parseFlexibleToDate(args['expires-at']);
  if (Number.isNaN(expiresAt.getTime())) die('bad --expires-at (ISO-8601; bare time = IST)');
}
if (expiresAt <= now) die('computed expiresAt is in the past');

const features = (args.features || process.env.DEFAULT_FEATURES || 'invoicing,backup,multi-device')
  .split(',').map(s => s.trim()).filter(Boolean);
const edition = args.edition || process.env.DEFAULT_EDITION || 'standard';
const maxActivations = parseInt(args['max-activations'] || process.env.DEFAULT_MAX_ACTIVATIONS || '2', 10);
const bindingMode = args.binding || process.env.DEFAULT_BINDING_MODE || BINDING_MODE.SOFT;
const offlineGraceHours = parseInt(args['offline-grace-hours'] || process.env.DEFAULT_OFFLINE_GRACE_HOURS || '72', 10);

if (![BINDING_MODE.SOFT, BINDING_MODE.STRICT, BINDING_MODE.NONE].includes(bindingMode)) die('bad --binding');
if (!Number.isInteger(maxActivations) || maxActivations < 1) die('bad --max-activations');
if (!Number.isInteger(offlineGraceHours) || offlineGraceHours < 0) die('bad --offline-grace-hours');

const licenseId = 'lic_' + crypto.randomBytes(8).toString('hex');

const payloadFields = {
  keyId,
  licenseId,
  customerId,
  customerName,
  productId: PRODUCT_ID,
  edition,
  features,
  licenseType,
  issuedAt: now.toISOString(),
  notBefore: notBefore.toISOString(),
  expiresAt: expiresAt.toISOString(),
  maxActivations,
  bindingMode,
  offlineGraceHours
};

(async () => {
  let privateKey;
  try {
    privateKey = loadPrivateKey({
      keyId,
      privateKeyPath: process.env.LICENSE_PRIVATE_KEY_PATH || undefined
    });
  } catch (e) {
    die(e.message);
  }

  const { payload, signature, licenseFile } = signLicense(payloadFields, privateKey);

  // self-verify before we hand anything out
  const { payload: p2, signature: s2 } = decodeLicenseFile(licenseFile);
  const ok = crypto.verify(
    null, canonicalPayload(p2), crypto.createPublicKey(getPublicKeyPem(keyId)), base64UrlDecode(s2)
  );
  if (!ok) die('internal error: freshly signed license failed self-verification');

  const outDir = path.resolve(args.out || path.join(__dirname, '..', '..', 'dist-licenses'));
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${customerId}__${licenseId}.lic`);
  fs.writeFileSync(outPath, licenseFile + '\n', 'utf8');

  if (!args['no-db']) {
    const db = require('./lib/db');
    try {
      await db.connect();
      await db.License.updateOne(
        { licenseId },
        {
          $set: {
            licenseId, customerId, customerName,
            productId: PRODUCT_ID, edition, features,
            licenseType, durationSpec,
            issuedAt: now, notBefore, expiresAt,
            maxActivations, bindingMode, offlineGraceHours,
            keyId, status: 'ACTIVE', activationCount: 0,
            signedLicense: licenseFile,
            createdBy: 'license-cli'
          }
        },
        { upsert: true }
      );
      await db.audit('LICENSE_CREATED', {
        licenseId, customerId,
        detail: { licenseType, durationSpec, expiresAt: expiresAt.toISOString(), maxActivations, bindingMode }
      });
      console.log('  Atlas: licenses row upserted + audit logged');
    } catch (e) {
      console.error('  Atlas write FAILED:', e.message);
      console.error('  The .lic file was still written. Re-run with a working LICENSE_ADMIN_MONGO_URI,');
      console.error('  or use --no-db to skip Atlas (offline-only license, no revocation).');
      process.exitCode = 2;
    } finally {
      await db.disconnect();
    }
  }

  console.log('\nLicense issued');
  console.log('  licenseId   :', licenseId);
  console.log('  customer    :', customerName, `(${customerId})`);
  console.log('  type        :', licenseType, durationSpec ? `(${durationSpec})` : '');
  console.log('  valid from  :', fmtIST(payload.notBefore), ' (' + payload.notBefore + ')');
  console.log('  expires at  :', fmtIST(payload.expiresAt), ' (' + payload.expiresAt + ')');
  console.log('  activations :', maxActivations, '| binding:', bindingMode, '| offline grace:', offlineGraceHours + 'h');
  console.log('  keyId       :', keyId);
  console.log('  file        :', outPath);
  console.log('\nDeliver: the SAME ProductionApp.exe  +  this .lic file.\n');
})();
