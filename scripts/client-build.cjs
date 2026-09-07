#!/usr/bin/env node
/**
 * client-build.cjs — build the shippable installer with the license EMBEDDED, so
 * the client only receives a .exe and types NOTHING (it auto-activates on first
 * launch). After that, manage the license entirely from the cloud (CLI -> Atlas).
 *
 * SINGLE-CLIENT (normal) — uses the MongoDB already in electron/app.secret.env:
 *   npm run client:build -- --customer "Srikanth" --duration 30d --max-activations 2
 *   npm run client:build -- --customer "Srikanth" --expires-at 2026-12-31T23:59:59
 *
 * MULTI-CLIENT (optional) — give a per-client DB; a fresh JWT secret is generated
 * and electron/app.secret.env is written for this build then restored:
 *   npm run client:build -- --customer "ABC" --customer-id cus_abc \
 *     --mongo-uri "mongodb+srv://user:pass@host/abc_db" --duration 30d
 *
 * Steps: issue a signed .lic + register it in the target DB -> embed it in the
 * build -> dist:installer -> rename to NexusSuite-<id>.exe -> clean up.
 *
 * Manage the client afterwards (no new .exe, propagates in ~20-40s):
 *   npm run license:extend  -- --license lic_xxx --by 30d
 *   npm run license:update  -- --license lic_xxx --max-activations 3
 *   npm run license:revoke  -- --license lic_xxx --suspend | --reactivate | --reason "..."
 *   npm run license:list    -- --customer-id <id> --activations
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { parseArgs } = require('../tools/license-cli/lib/args');

const ROOT = path.join(__dirname, '..');
const args = parseArgs(process.argv.slice(2), []);

function die(m) { console.error('client:build: ' + m); process.exit(1); }

const secretEnvPath = path.join(ROOT, 'electron', 'app.secret.env');
const embeddedLicPath = path.join(ROOT, 'electron', 'embedded-license.lic');
const installerPath = path.join(ROOT, 'dist-installer', 'NexusSuite-Windows-Installer.exe');

const customer = args.customer || 'Client';
let customerId = args['customer-id'];
if (!customerId) customerId = 'cus_' + customer.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
if (!/^[a-zA-Z0-9_.-]+$/.test(customerId)) die('bad --customer-id');

if (args.duration && args['expires-at']) die('use either --duration OR --expires-at');
if (!args.duration && !args['expires-at']) die('one of --duration or --expires-at is required');

const keyId = args['key-id'] || process.env.LICENSE_KEY_ID || 'nxs-2026-01';
const maxAct = String(args['max-activations'] || 2);

// ── resolve the target MongoDB ──────────────────────────────────────────────
let mongoUri = args['mongo-uri'] || '';
const multiClient = !!mongoUri;

if (!mongoUri) {
  if (!fs.existsSync(secretEnvPath)) {
    die('no --mongo-uri and no electron/app.secret.env — set one up (see docs/LICENSING.md)');
  }
  const m = fs.readFileSync(secretEnvPath, 'utf8').match(/^\s*MONGO_URI\s*=\s*(.+)$/m);
  if (!m) die('electron/app.secret.env has no MONGO_URI');
  mongoUri = m[1].trim();
}
if (!/^mongodb(\+srv)?:\/\/.+/.test(mongoUri)) die('MONGO_URI looks invalid');

const outPath = path.join(ROOT, 'dist-installer', `NexusSuite-${customerId}.exe`);

// ── only back up / rewrite app.secret.env in multi-client mode ──────────────
const secretBak = multiClient && fs.existsSync(secretEnvPath) ? fs.readFileSync(secretEnvPath) : null;

function cleanup() {
  try { if (fs.existsSync(embeddedLicPath)) fs.unlinkSync(embeddedLicPath); } catch (e) {}
  if (multiClient) {
    try {
      if (secretBak) fs.writeFileSync(secretEnvPath, secretBak);
      else if (fs.existsSync(secretEnvPath)) fs.unlinkSync(secretEnvPath);
    } catch (e) {}
  }
}

(async () => {
try {
  if (multiClient) {
    const jwt = crypto.randomBytes(48).toString('base64url');
    fs.writeFileSync(secretEnvPath, `JWT_SECRET=${jwt}\nMONGO_URI=${mongoUri}\n`);
    console.log('[client:build] app.secret.env -> this client DB, fresh JWT secret');
  } else {
    console.log('[client:build] using existing electron/app.secret.env (single client)');
  }

  // Supersede any earlier licenses for this customer so there is exactly ONE
  // live license per client (avoids "which licenseId do I manage?" confusion).
  try {
    const db = require('../tools/license-cli/lib/db');
    process.env.LICENSE_ADMIN_MONGO_URI = mongoUri;
    await db.connect();
    const r = await db.License.updateMany(
      { customerId, status: { $in: ['ACTIVE', 'SUSPENDED'] } },
      { $set: { status: 'REVOKED', revokedAt: new Date(), revokedReason: 'superseded by a newer build' } }
    );
    if (r.modifiedCount) console.log(`[client:build] superseded ${r.modifiedCount} earlier license(s) for ${customerId}`);
    await db.disconnect();
  } catch (e) {
    console.warn('[client:build] could not supersede earlier licenses:', e.message);
  }

  const issueArgs = [
    'tools/license-cli/issue.js',
    '--customer', customer,
    '--customer-id', customerId,
    '--max-activations', maxAct,
    '--key-id', keyId
  ];
  if (args.duration) issueArgs.push('--duration', args.duration);
  else issueArgs.push('--expires-at', args['expires-at']);
  if (args.features) issueArgs.push('--features', args.features);
  if (args.binding) issueArgs.push('--binding', args.binding);

  const issueOut = execFileSync('node', issueArgs, {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, LICENSE_ADMIN_MONGO_URI: mongoUri, LICENSE_KEY_ID: keyId }
  });
  process.stdout.write(issueOut);
  if (/Atlas write FAILED/.test(issueOut)) die('license signed but NOT registered in the DB — check the MongoDB URL');
  const mFile = issueOut.match(/file\s*:\s*(.+?\.lic)\s*$/m);
  if (!mFile) die('could not locate the issued .lic in issue.js output');

  fs.copyFileSync(mFile[1].trim(), embeddedLicPath);
  console.log(`[client:build] embedded ${path.basename(mFile[1].trim())} into the app`);

  console.log('[client:build] running dist:installer ...');
  execFileSync('npm', ['run', 'dist:installer'], { cwd: ROOT, stdio: 'inherit', shell: true });

  if (!fs.existsSync(installerPath)) die('installer not produced');
  fs.copyFileSync(installerPath, outPath);

  console.log('\n[client:build] DONE');
  console.log(`  ship ONLY this file to ${customer}:`);
  console.log(`    ${outPath}`);
  console.log('  manage the license later (no new .exe):');
  console.log(`    npm run license:list -- --customer-id ${customerId} --activations`);
  console.log('');
} catch (e) {
  console.error('[client:build] FAILED:', e.message);
  process.exitCode = 1;
} finally {
  cleanup();
  console.log('[client:build] cleaned up (removed embedded license' + (multiClient ? '; restored app.secret.env' : '') + ')');
}
})();
