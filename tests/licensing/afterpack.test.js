'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { default: afterPack } = require('../../scripts/afterPack.cjs');

function tmpTree(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ap-test-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return dir;
}

test('passes a clean tree', async () => {
  const dir = tmpTree({
    'app/main.js': 'const x = process.env.LICENSE_ENFORCE === "1"; // reference only\n',
    'app/config.json': '{"port":5050}'
  });
  await assert.doesNotReject(afterPack({ appOutDir: dir }));
});

test('fails on a private key block', async () => {
  const dir = tmpTree({
    'app/keys/leak.pem': '-----BEGIN PRIVATE KEY-----\nMC4CAQ\n-----END PRIVATE KEY-----\n'
  });
  await assert.rejects(afterPack({ appOutDir: dir }), /secret scan failed/);
});

test('fails on operator env / dev toggle env lines', async () => {
  const dir1 = tmpTree({ 'r/app.env': 'LICENSE_ADMIN_MONGO_URI=mongodb://a:b@h/db\n' });
  await assert.rejects(afterPack({ appOutDir: dir1 }));

  const dir2 = tmpTree({ 'r/app.env': 'PORT=5050\nLICENSE_ENFORCE=1\n' });
  await assert.rejects(afterPack({ appOutDir: dir2 }));
});

test('does NOT fail on source code that merely references the toggle', async () => {
  const dir = tmpTree({
    'app/enforcement.js': "const DEV_ENFORCE = process.env.LICENSE_ENFORCE === '1';\nmodule.exports = { DEV_ENFORCE };\n"
  });
  await assert.doesNotReject(afterPack({ appOutDir: dir }));
});

test('warns (does not fail) on embedded mongo credentials', async () => {
  const dir = tmpTree({
    'app/connect.js': "const URI = 'mongodb://user:pass@cluster.example/test';\n"
  });
  await assert.doesNotReject(afterPack({ appOutDir: dir }));
});
