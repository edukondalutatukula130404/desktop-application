#!/usr/bin/env node
/**
 * list.js — show licenses and their activations from Atlas.
 *
 *   npm run license:list
 *   npm run license:list -- --customer-id cus_abc
 *   npm run license:list -- --license lic_xxx --activations
 *   npm run license:list -- --status ACTIVE
 */

'use strict';

const { parseArgs } = require('./lib/args');
const { fmtIST } = require('./lib/tz');
const args = parseArgs(process.argv.slice(2), ['activations', 'json']);

(async () => {
  const db = require('./lib/db');
  try {
    await db.connect();

    const q = {};
    if (args['customer-id']) q.customerId = args['customer-id'];
    if (args.license) q.licenseId = args.license;
    if (args.status) q.status = String(args.status).toUpperCase();

    const licenses = await db.License.find(q).sort({ createdAt: -1 }).lean();

    if (args.json) {
      console.log(JSON.stringify(licenses, null, 2));
      return;
    }

    if (!licenses.length) { console.log('no licenses match'); return; }

    const now = Date.now();
    for (const l of licenses) {
      const exp = new Date(l.expiresAt).getTime();
      const daysLeft = ((exp - now) / 86400000);
      const left = exp < now ? 'EXPIRED' : `${daysLeft.toFixed(1)}d left`;
      console.log(
        `\n${l.licenseId}  [${l.status}]  ${left}` +
        `\n  customer   : ${l.customerName} (${l.customerId})` +
        `\n  type       : ${l.licenseType}${l.durationSpec ? ' ' + l.durationSpec : ''}` +
        `\n  issuedAt   : ${fmtIST(l.issuedAt)}` +
        `\n  expiresAt  : ${fmtIST(l.expiresAt)}` +
        `\n  activations: ${l.activationCount}/${l.maxActivations}  binding=${l.bindingMode}  grace=${l.offlineGraceHours}h  key=${l.keyId}` +
        (l.revokedReason ? `\n  revoked    : ${l.revokedReason}` : '')
      );

      if (args.activations) {
        const acts = await db.LicenseActivation.find({ licenseId: l.licenseId }).sort({ lastValidatedAt: -1 }).lean();
        if (!acts.length) console.log('    (no activations)');
        for (const a of acts) {
          console.log(
            `    - ${a.deviceHash.slice(0, 12)}…  [${a.status}]  ${a.deviceLabel || ''}` +
            `  activated ${fmtIST(a.activatedAt)}  seen ${fmtIST(a.lastValidatedAt)}`
          );
        }
      }
    }
    console.log('');
  } catch (e) {
    console.error('list:', e.message);
    process.exit(1);
  } finally {
    await db.disconnect();
  }
})();
