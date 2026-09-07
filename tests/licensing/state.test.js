'use strict';
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const path = require('node:path');

// ── test signing key ──────────────────────────────────────────────────────────
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const KEY_ID = 'state-test-key';
const publicKeys = require('../../backend/src/licensing/publicKeys');
publicKeys.PUBLIC_KEYS[KEY_ID] = publicKey.export({ type: 'spki', format: 'pem' });

const { signLicense } = require('../../tools/license-cli/lib/sign');
const { PRODUCT_ID, LICENSE_TYPE, BINDING_MODE } = require('../../backend/src/licensing/licenseFormat');

// ── mock trusted time BEFORE requiring licenseState ───────────────────────────
const trustedTime = require('../../backend/src/licensing/trustedTime');
let MOCK_NOW = Date.now();
let MOCK_TRUSTED = false;
trustedTime.getTrustedTime = async () => ({ time: new Date(MOCK_NOW), trusted: MOCK_TRUSTED, source: 'mock' });

// ── mock the Atlas models (lazy-required inside licenseState) ─────────────────
const licenseDocs = new Map();       // licenseId -> doc
const activationDocs = [];           // {licenseId, deviceHash, status, fingerprintSignals, save()}
function resetAtlas() { licenseDocs.clear(); activationDocs.length = 0; }

const FakeLicense = {
  findOne: (q) => {
    const d = licenseDocs.get(q.licenseId) || null;
    return { lean: async () => d, then: undefined };
  },
  updateOne: async () => ({}),
  countDocuments: async (q) =>
    activationDocs.filter((a) => a.licenseId === q.licenseId && a.status === 'ACTIVE').length
};
// support both `await findOne()` and `findOne().lean()`
FakeLicense.findOne = (q) => {
  const d = licenseDocs.get(q.licenseId) || null;
  const p = Promise.resolve(d && { ...d, save: async () => {} });
  p.lean = async () => d;
  return p;
};
const FakeActivation = {
  findOne: (q) => Promise.resolve(
    activationDocs.find((a) => a.licenseId === q.licenseId && a.deviceHash === q.deviceHash) || null
  ),
  find: async (q) => activationDocs.filter((a) => a.licenseId === q.licenseId && (!q.status || a.status === q.status)),
  create: async (doc) => { const d = { ...doc, save: async () => {} }; activationDocs.push(d); return d; },
  countDocuments: async (q) =>
    activationDocs.filter((a) => a.licenseId === q.licenseId && a.status === 'ACTIVE').length
};

require.cache[require.resolve('../../backend/src/models/License')] = { id: 'L', filename: 'L', loaded: true, exports: FakeLicense };
require.cache[require.resolve('../../backend/src/models/LicenseActivation')] = { id: 'A', filename: 'A', loaded: true, exports: FakeActivation };
require.cache[require.resolve('../../backend/src/licensing/auditClient')] = { id: 'au', filename: 'au', loaded: true, exports: { audit: async () => {} } };

const licenseState = require('../../backend/src/licensing/licenseState');

// ── helpers ──────────────────────────────────────────────────────────────────
let vault = null;
function wire(fpHash = 'dev-AAA', signals = { mac: 'm', cpu: 'c' }) {
  vault = null;
  licenseState.init({
    readVault: () => vault,
    writeVault: (o) => { vault = o; },
    getMachineFingerprint: () => ({ hash: fpHash, signals })
  });
}
function makeLic(over = {}) {
  const now = new Date(MOCK_NOW);
  return signLicense({
    keyId: KEY_ID, licenseId: 'lic_' + crypto.randomBytes(4).toString('hex'),
    customerId: 'cus_t', customerName: 'T', productId: PRODUCT_ID, edition: 'standard',
    features: ['invoicing'], licenseType: LICENSE_TYPE.DURATION,
    issuedAt: now.toISOString(), notBefore: now.toISOString(),
    expiresAt: new Date(MOCK_NOW + 3600e3).toISOString(),
    maxActivations: 2, bindingMode: BINDING_MODE.NONE, offlineGraceHours: 72, ...over
  }, privateKey).licenseFile;
}

test.beforeEach(() => { MOCK_NOW = Date.now(); MOCK_TRUSTED = false; resetAtlas(); wire(); });

// ── OFFLINE ──────────────────────────────────────────────────────────────────
test('fresh install → NOT_ACTIVATED', async () => {
  const st = await licenseState.evaluate();
  assert.strictEqual(st.status, 'NOT_ACTIVATED');
  assert.strictEqual(st.ok, false);
});

test('offline activate → ACTIVE and persists vault', async () => {
  const st = await licenseState.activate({ licString: makeLic() });
  assert.strictEqual(st.ok, true);
  assert.ok(['ACTIVE', 'EXPIRING_SOON'].includes(st.status));
  assert.ok(vault && vault.licString && vault.deviceHash);
});

test('restart (reload from vault) → still ACTIVE', async () => {
  await licenseState.activate({ licString: makeLic() });
  licenseState.init({ readVault: () => vault, writeVault: (o) => { vault = o; }, getMachineFingerprint: () => ({ hash: 'dev-AAA', signals: {} }) });
  const st = await licenseState.evaluate();
  assert.strictEqual(st.ok, true);
});

test('time past expiresAt → EXPIRED, and clock rollback cannot restore it', async () => {
  await licenseState.activate({ licString: makeLic() });
  MOCK_NOW += 3600e3 + 5000;
  let st = await licenseState.evaluate();
  assert.strictEqual(st.status, 'EXPIRED');
  assert.strictEqual(st.code, 'LICENSE_EXPIRED');
  MOCK_NOW -= 3 * 3600e3; // roll back well before expiry
  st = await licenseState.evaluate();
  assert.strictEqual(st.ok, false);
});

test('offline beyond grace → GRACE', async () => {
  await licenseState.activate({ licString: makeLic({ offlineGraceHours: 1, expiresAt: new Date(MOCK_NOW + 30 * 24 * 3600e3).toISOString() }) });
  MOCK_NOW += 2 * 3600e3;
  const st = await licenseState.evaluate();
  assert.strictEqual(st.status, 'GRACE');
  assert.strictEqual(st.code, 'OFFLINE_GRACE_EXCEEDED');
});

test('tampered vault licString → not ok (TAMPERED/INVALID)', async () => {
  await licenseState.activate({ licString: makeLic() });
  vault.licString = vault.licString.slice(0, -6) + 'AAAAAA';
  licenseState.init({ readVault: () => vault, writeVault: (o) => { vault = o; }, getMachineFingerprint: () => ({ hash: 'dev-AAA', signals: {} }) });
  const st = await licenseState.evaluate();
  assert.strictEqual(st.ok, false);
  assert.ok(['TAMPERED', 'INVALID'].includes(st.status));
});

test('offline honours last-known REVOKED', async () => {
  await licenseState.activate({ licString: makeLic({ expiresAt: new Date(MOCK_NOW + 30 * 24 * 3600e3).toISOString() }) });
  vault.atlasStatus = 'REVOKED';
  const st = await licenseState.evaluate();
  assert.strictEqual(st.status, 'REVOKED');
});

// ── ONLINE (mocked Atlas) ────────────────────────────────────────────────────
test('online activate registers an activation and enforces maxActivations', async () => {
  MOCK_TRUSTED = true;
  const lic = makeLic({ licenseId: 'lic_online1', maxActivations: 1, expiresAt: new Date(MOCK_NOW + 30 * 24 * 3600e3).toISOString() });
  licenseDocs.set('lic_online1', { licenseId: 'lic_online1', status: 'ACTIVE', expiresAt: new Date(MOCK_NOW + 30 * 24 * 3600e3), maxActivations: 1 });

  const st = await licenseState.activate({ licString: lic });
  assert.strictEqual(st.ok, true);
  assert.strictEqual(activationDocs.length, 1);

  // second device → limit reached
  wire('dev-BBB', { mac: 'm2', cpu: 'c2' });
  await assert.rejects(
    licenseState.activate({ licString: lic }),
    (e) => e.code === 'ACTIVATION_LIMIT_REACHED'
  );
});

test('online evaluate honours Atlas REVOKED even if the signed dates are fine', async () => {
  MOCK_TRUSTED = true;
  const lic = makeLic({ licenseId: 'lic_rev', expiresAt: new Date(MOCK_NOW + 30 * 24 * 3600e3).toISOString() });
  licenseDocs.set('lic_rev', { licenseId: 'lic_rev', status: 'ACTIVE', expiresAt: new Date(MOCK_NOW + 30 * 24 * 3600e3), maxActivations: 5 });
  await licenseState.activate({ licString: lic });
  licenseDocs.get('lic_rev').status = 'REVOKED';
  const st = await licenseState.evaluate();
  assert.strictEqual(st.status, 'REVOKED');
  assert.strictEqual(st.ok, false);
});

test('online extension: Atlas expiresAt later than signed is honoured', async () => {
  MOCK_TRUSTED = true;
  const signedExp = new Date(MOCK_NOW + 60e3).toISOString();          // signed: 1 min
  const atlasExp = new Date(MOCK_NOW + 30 * 24 * 3600e3);            // atlas: 30 days
  const lic = makeLic({ licenseId: 'lic_ext', expiresAt: signedExp, bindingMode: BINDING_MODE.NONE });
  licenseDocs.set('lic_ext', { licenseId: 'lic_ext', status: 'ACTIVE', expiresAt: atlasExp, maxActivations: 5 });
  await licenseState.activate({ licString: lic });
  MOCK_NOW += 5 * 60e3; // 5 min later — past the signed 1-min expiry
  const st = await licenseState.evaluate();
  assert.strictEqual(st.ok, true, 'Atlas extension should keep it active');
});
