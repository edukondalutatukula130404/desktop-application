#!/usr/bin/env node
/**
 * state-test.js — Phase 3 offline state-machine checks for licenseState.js.
 *
 * Uses in-memory vault adapters and a mocked trusted-time source (Atlas
 * unreachable) so the whole offline decision path runs with no DB / network.
 * Online + Atlas paths are covered by Phase 7 integration tests.
 *
 *   npm run license:statetest
 */

'use strict';

const crypto = require('crypto');
const { loadPrivateKey } = require('./lib/keys');
const { signLicense } = require('./lib/sign');
const { PRODUCT_ID, LICENSE_TYPE, BINDING_MODE } = require('../../backend/src/licensing/licenseFormat');

// ---- mock trusted time BEFORE licenseState is required ----------------------
const trustedTime = require('../../backend/src/licensing/trustedTime');
let MOCK_NOW = Date.now();
let MOCK_TRUSTED = false;
trustedTime.getTrustedTime = async () => ({ time: new Date(MOCK_NOW), trusted: MOCK_TRUSTED, source: 'mock' });

const licenseState = require('../../backend/src/licensing/licenseState');

const KEY_ID = process.env.LICENSE_KEY_ID || 'nxs-dev-2026';
let vault = null;
licenseState.init({
  readVault: () => vault,
  writeVault: (o) => { vault = o; },
  getMachineFingerprint: () => ({ hash: 'devicehash-AAA', signals: { mac: 'm', cpu: 'c' } })
});

let fails = 0;
function ok(name, cond) {
  console.log((cond ? '  ok   ' : '  FAIL ') + name);
  if (!cond) { fails++; process.exitCode = 1; }
}

function makeLicense(overrides = {}) {
  const priv = loadPrivateKey({ keyId: KEY_ID });
  const now = new Date(MOCK_NOW);
  const fields = {
    keyId: KEY_ID,
    licenseId: 'lic_' + crypto.randomBytes(6).toString('hex'),
    customerId: 'cus_test',
    customerName: 'State Test',
    productId: PRODUCT_ID,
    edition: 'standard',
    features: ['invoicing'],
    licenseType: LICENSE_TYPE.DURATION,
    issuedAt: now.toISOString(),
    notBefore: now.toISOString(),
    expiresAt: new Date(MOCK_NOW + 3600e3).toISOString(),
    maxActivations: 2,
    bindingMode: BINDING_MODE.NONE,
    offlineGraceHours: 72,
    ...overrides
  };
  return signLicense(fields, priv).licenseFile;
}

(async () => {
  console.log('\nPhase 3 licenseState offline state-machine test\n');

  // 1. fresh install -> NOT_ACTIVATED
  vault = null;
  licenseState.init({ readVault: () => vault, writeVault: (o) => { vault = o; }, getMachineFingerprint: () => ({ hash: 'devicehash-AAA', signals: {} }) });
  let st = await licenseState.evaluate();
  ok('fresh install -> NOT_ACTIVATED / not ok', st.status === 'NOT_ACTIVATED' && st.ok === false);

  // 2. activate offline -> ACTIVE
  const lic = makeLicense();
  st = await licenseState.activate({ licString: lic });
  ok('activate offline -> ACTIVE / ok', st.status === 'ACTIVE' && st.ok === true);
  ok('vault persisted licString + deviceHash', !!(vault && vault.licString && vault.deviceHash));

  // 3. restart (reload from vault) -> still ACTIVE
  licenseState.init({ readVault: () => vault, writeVault: (o) => { vault = o; }, getMachineFingerprint: () => ({ hash: 'devicehash-AAA', signals: {} }) });
  st = await licenseState.evaluate();
  ok('after restart -> still ACTIVE', st.status === 'ACTIVE' && st.ok === true);

  // 4. time jumps past expiry -> EXPIRED, ok=false
  MOCK_NOW += 3600e3 + 5000;
  st = await licenseState.evaluate();
  ok('past expiresAt -> EXPIRED / not ok', st.status === 'EXPIRED' && st.ok === false);
  ok('expired code is LICENSE_EXPIRED', st.code === 'LICENSE_EXPIRED');

  // 5. clock rolled BACK below maxSeenAnyTime -> still EXPIRED (rollback cannot un-expire)
  MOCK_NOW -= 2 * 3600e3;
  st = await licenseState.evaluate();
  ok('clock rollback does NOT restore access', st.ok === false);

  // 6. offline grace exceeded
  MOCK_NOW = Date.now();
  vault = null;
  licenseState.init({ readVault: () => vault, writeVault: (o) => { vault = o; }, getMachineFingerprint: () => ({ hash: 'devicehash-AAA', signals: {} }) });
  const licShortGrace = makeLicense({ offlineGraceHours: 1, expiresAt: new Date(MOCK_NOW + 30 * 24 * 3600e3).toISOString() });
  await licenseState.activate({ licString: licShortGrace });
  MOCK_NOW += 2 * 3600e3; // 2h offline, grace was 1h
  st = await licenseState.evaluate();
  ok('offline beyond grace -> GRACE / not ok', st.status === 'GRACE' && st.ok === false);
  ok('grace code is OFFLINE_GRACE_EXCEEDED', st.code === 'OFFLINE_GRACE_EXCEEDED');

  // 7. tampered vault licString -> TAMPERED
  MOCK_NOW = Date.now();
  vault = null;
  licenseState.init({ readVault: () => vault, writeVault: (o) => { vault = o; }, getMachineFingerprint: () => ({ hash: 'devicehash-AAA', signals: {} }) });
  await licenseState.activate({ licString: makeLicense() });
  vault.licString = vault.licString.slice(0, -6) + 'AAAAAA'; // corrupt the signature tail
  licenseState.init({ readVault: () => vault, writeVault: (o) => { vault = o; }, getMachineFingerprint: () => ({ hash: 'devicehash-AAA', signals: {} }) });
  st = await licenseState.evaluate();
  ok('tampered license string -> not ok / TAMPERED-ish', st.ok === false && ['TAMPERED', 'INVALID'].includes(st.status));

  // 8. last-known revocation honoured offline
  MOCK_NOW = Date.now();
  vault = null;
  licenseState.init({ readVault: () => vault, writeVault: (o) => { vault = o; }, getMachineFingerprint: () => ({ hash: 'devicehash-AAA', signals: {} }) });
  await licenseState.activate({ licString: makeLicense({ expiresAt: new Date(MOCK_NOW + 30 * 24 * 3600e3).toISOString() }) });
  vault.atlasStatus = 'REVOKED';
  st = await licenseState.evaluate();
  ok('offline honours last-known REVOKED', st.status === 'REVOKED' && st.ok === false);

  console.log(fails ? `\n${fails} CHECK(S) FAILED\n` : '\nAll Phase 3 offline state checks passed.\n');
})();
