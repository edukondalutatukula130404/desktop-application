'use strict';
const test = require('node:test');
const assert = require('node:assert');

// enforce for this test process
process.env.LICENSE_ENFORCE = '1';

const licenseState = require('../../backend/src/licensing/licenseState');
const licenseMiddleware = require('../../backend/src/middleware/licenseMiddleware');

function run(mw) {
  let statusCode = null, body = null, nexted = false;
  const res = {
    status(c) { statusCode = c; return this; },
    json(b) { body = b; return this; }
  };
  mw({ headers: {} }, res, () => { nexted = true; });
  return { statusCode, body, nexted };
}

test('blocks with 402 when no license is activated', () => {
  // default state = NOT_ACTIVATED
  const r = run(licenseMiddleware);
  assert.strictEqual(r.nexted, false);
  assert.strictEqual(r.statusCode, 402);
  assert.strictEqual(r.body.licenseBlocked, true);
  assert.strictEqual(r.body.code, 'LICENSE_NOT_ACTIVATED');
});

test('blocks with 403 when license is expired', () => {
  // force an EXPIRED snapshot via the private setter path: evaluate with a broken vault
  licenseState.init({
    readVault: () => ({ licString: 'x', licenseId: 'l', atlasStatus: 'ACTIVE' }),
    writeVault: () => {},
    getMachineFingerprint: () => ({ hash: 'h', signals: {} })
  });
  return licenseState.evaluate().then(() => {
    const r = run(licenseMiddleware);
    assert.strictEqual(r.nexted, false);
    assert.strictEqual(r.statusCode, 403);
    assert.strictEqual(r.body.licenseBlocked, true);
  });
});

test('passes through when enforcement is OFF', () => {
  // simulate a fresh module load with enforcement disabled
  delete require.cache[require.resolve('../../backend/src/licensing/enforcement')];
  delete require.cache[require.resolve('../../backend/src/middleware/licenseMiddleware')];
  delete process.env.LICENSE_ENFORCE;
  const mwOff = require('../../backend/src/middleware/licenseMiddleware');
  const r = run(mwOff);
  assert.strictEqual(r.nexted, true);
  assert.strictEqual(r.statusCode, null);
});
