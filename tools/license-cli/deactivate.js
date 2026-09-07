#!/usr/bin/env node
/**
 * deactivate.js — free an activation slot (customer replaced a device).
 *
 *   npm run license:list       -- --license lic_xxx --activations   # find the deviceHash
 *   npm run license:deactivate -- --license lic_xxx --device <deviceHash or its prefix>
 *   npm run license:deactivate -- --license lic_xxx --all           # free every slot
 *
 * The old device locks (DEVICE_NOT_AUTHORIZED) at its next online check; the
 * freed slot lets the new device activate.
 */

'use strict';

const { parseArgs } = require('./lib/args');
const args = parseArgs(process.argv.slice(2), ['all']);

function die(m) { console.error('deactivate: ' + m); process.exit(1); }
const licenseId = args.license || args._[0];
if (!licenseId) die('--license <licenseId> is required');
if (!args.all && !args.device) die('pass --device <deviceHash|prefix> or --all');

(async () => {
  const db = require('./lib/db');
  try {
    await db.connect();
    const lic = await db.License.findOne({ licenseId });
    if (!lic) die(`no license found with id ${licenseId}`);

    const rows = await db.LicenseActivation.find({ licenseId, status: 'ACTIVE' });
    if (!rows.length) die('no active activations to free');

    const targets = args.all
      ? rows
      : rows.filter((r) => r.deviceHash.startsWith(String(args.device)));
    if (!targets.length) die(`no active activation matches device "${args.device}"`);

    const now = new Date();
    for (const r of targets) {
      r.status = 'DEACTIVATED';
      r.deactivatedAt = now;
      r.deactivatedReason = args.reason || 'operator deactivate';
      await r.save();
      await db.audit('LICENSE_DEACTIVATED', { licenseId, deviceHash: r.deviceHash });
      console.log(`  freed  ${r.deviceHash.slice(0, 16)}…`);
    }
    await db.License.updateOne(
      { licenseId },
      { $inc: { activationCount: -targets.length } }
    );

    const left = Math.max(0, (lic.activationCount || 0) - targets.length);
    console.log(`\n${licenseId}: ${targets.length} slot(s) freed  (now ${left}/${lic.maxActivations} used)\n`);
  } catch (e) {
    die(e.message);
  } finally {
    await db.disconnect();
  }
})();
