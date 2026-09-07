#!/usr/bin/env node
/**
 * update.js — change a live license's policy fields in Atlas.
 *
 *   npm run license:update -- --license lic_xxx --max-activations 3
 *   npm run license:update -- --license lic_xxx --features invoicing,backup,multi-device
 *   npm run license:update -- --license lic_xxx --binding soft
 *   npm run license:update -- --license lic_xxx --offline-grace-hours 168
 *
 * --max-activations and --offline-grace-hours take effect at the client's next
 * ONLINE validation, no new .lic needed. --features / --binding also live in the
 * signed .lic, so for OFFLINE devices reissue with:
 *   npm run license:extend -- --license lic_xxx --by 0d --reissue   (or any --by)
 */

'use strict';

const { parseArgs } = require('./lib/args');
const { BINDING_MODE } = require('../../backend/src/licensing/licenseFormat');
const args = parseArgs(process.argv.slice(2), []);

function die(m) { console.error('update: ' + m); process.exit(1); }
const licenseId = args.license || args._[0];
if (!licenseId) die('--license <licenseId> is required');

const set = {};
if (args['max-activations'] !== undefined) {
  const n = parseInt(args['max-activations'], 10);
  if (!Number.isInteger(n) || n < 1) die('--max-activations must be an integer >= 1');
  set.maxActivations = n;
}
if (args['offline-grace-hours'] !== undefined) {
  const n = parseInt(args['offline-grace-hours'], 10);
  if (!Number.isInteger(n) || n < 0) die('--offline-grace-hours must be an integer >= 0');
  set.offlineGraceHours = n;
}
if (args.features !== undefined) {
  set.features = String(args.features).split(',').map((s) => s.trim()).filter(Boolean);
}
if (args.binding !== undefined) {
  if (![BINDING_MODE.SOFT, BINDING_MODE.STRICT, BINDING_MODE.NONE].includes(args.binding)) {
    die('--binding must be soft | strict | none');
  }
  set.bindingMode = args.binding;
}
if (args.notes !== undefined) set.notes = String(args.notes);

if (!Object.keys(set).length) die('nothing to update (pass --max-activations / --features / --binding / --offline-grace-hours)');

(async () => {
  const db = require('./lib/db');
  try {
    await db.connect();
    const lic = await db.License.findOne({ licenseId });
    if (!lic) die(`no license found with id ${licenseId}`);

    await db.License.updateOne({ licenseId }, { $set: set });
    await db.audit('LICENSE_EXTENDED', {
      licenseId, customerId: lic.customerId,
      detail: { update: set, before: {
        maxActivations: lic.maxActivations, features: lic.features,
        bindingMode: lic.bindingMode, offlineGraceHours: lic.offlineGraceHours
      } }
    });

    console.log(`\n${licenseId} updated:`);
    for (const [k, v] of Object.entries(set)) console.log(`  ${k}: ${JSON.stringify(v)}`);
    console.log('Applied at the client on its next online validation.\n');
  } catch (e) {
    die(e.message);
  } finally {
    await db.disconnect();
  }
})();
