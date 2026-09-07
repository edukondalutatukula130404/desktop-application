#!/usr/bin/env node
/**
 * revoke.js — mark a license REVOKED (or SUSPENDED) in Atlas.
 *
 *   npm run license:revoke -- --license lic_xxx --reason "non-payment"
 *   npm run license:revoke -- --license lic_xxx --suspend --reason "payment pending"
 *   npm run license:revoke -- --license lic_xxx --reactivate
 *
 * The desktop app applies this on its next ONLINE validation (<= 10 min).
 * A fully-offline machine keeps working on its signed .lic until it reconnects
 * or the license's own expiresAt passes — this is a documented limitation.
 */

'use strict';

const { parseArgs } = require('./lib/args');
const args = parseArgs(process.argv.slice(2), ['suspend', 'reactivate']);

function die(m) { console.error('revoke: ' + m); process.exit(1); }
const licenseId = args.license || args._[0];
if (!licenseId) die('--license <licenseId> is required');

const targetStatus = args.reactivate ? 'ACTIVE' : (args.suspend ? 'SUSPENDED' : 'REVOKED');

(async () => {
  const db = require('./lib/db');
  try {
    await db.connect();
    const lic = await db.License.findOne({ licenseId });
    if (!lic) die(`no license found with id ${licenseId}`);

    const now = new Date();
    const set = { status: targetStatus };
    if (targetStatus === 'REVOKED') { set.revokedAt = now; set.revokedReason = args.reason || ''; }
    if (targetStatus === 'SUSPENDED') { set.suspendedAt = now; }
    if (targetStatus === 'ACTIVE') { set.revokedAt = null; set.revokedReason = ''; set.suspendedAt = null; }

    await db.License.updateOne({ licenseId }, { $set: set });
    await db.audit(
      targetStatus === 'REVOKED' ? 'LICENSE_REVOKED'
        : targetStatus === 'SUSPENDED' ? 'LICENSE_SUSPENDED'
        : 'LICENSE_VALIDATED',
      { licenseId, customerId: lic.customerId, detail: { from: lic.status, to: targetStatus, reason: args.reason || '' } }
    );

    console.log(`\n${licenseId}: ${lic.status} -> ${targetStatus}`);
    console.log(`customer: ${lic.customerName} (${lic.customerId})`);
    console.log('Takes effect on the client at its next online validation.\n');
  } catch (e) {
    die(e.message);
  } finally {
    await db.disconnect();
  }
})();
