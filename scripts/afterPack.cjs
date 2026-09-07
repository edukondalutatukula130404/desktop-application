/**
 * afterPack.cjs — electron-builder hook. Fails the build if the packaged app
 * contains signing private keys, the license operator env, or dev/test license
 * toggles. Warns (does not fail) on embedded Atlas credentials — that is a
 * pre-existing, accepted trade-off for the single-tenant deployment and is
 * tracked separately in docs/LICENSING.md.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Anchored to env-file line syntax (KEY=value at start of line) so ordinary
// source code that merely *references* these vars does not trip the scan.
const HARD_FAIL = [
  { name: 'private key block', re: /-----BEGIN (?:PRIVATE|EC PRIVATE|OPENSSH PRIVATE|RSA PRIVATE) KEY-----/ },
  { name: 'license operator Mongo URI', re: /^[ \t]*LICENSE_ADMIN_MONGO_URI[ \t]*=[ \t]*\S/m },
  { name: 'license private key in env', re: /^[ \t]*LICENSE_PRIVATE_KEY(?:_PATH)?[ \t]*=[ \t]*\S/m },
  { name: 'dev license enforce toggle', re: /^[ \t]*LICENSE_ENFORCE[ \t]*=[ \t]*1[ \t]*$/m },
  { name: 'dev license force-offline toggle', re: /^[ \t]*LICENSE_FORCE_OFFLINE[ \t]*=[ \t]*1[ \t]*$/m }
];

const WARN = [
  { name: 'embedded MongoDB credentials', re: /mongodb(?:\+srv)?:\/\/[^\s"']*:[^\s"'@]*@/ }
];

const SCAN_EXT = new Set([
  '.js', '.cjs', '.mjs', '.json', '.env', '.txt', '.pem', '.lic', '.map', '.html'
]);
const SKIP_DIR = new Set(['node_modules']); // third-party test fixtures create noise

function walk(dir, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (!SKIP_DIR.has(ent.name)) walk(full, out);
    } else if (SCAN_EXT.has(path.extname(ent.name).toLowerCase()) || ent.name.includes('.env')) {
      out.push(full);
    }
  }
}

exports.default = async function afterPack(context) {
  const appDir = context.appOutDir;
  console.log(`[afterPack] scanning packaged app: ${appDir}`);

  const files = [];
  walk(appDir, files);

  const failures = [];
  const warnings = [];

  for (const f of files) {
    let text;
    try { text = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
    for (const rule of HARD_FAIL) {
      if (rule.re.test(text)) failures.push(`${rule.name}  ->  ${path.relative(appDir, f)}`);
    }
    for (const rule of WARN) {
      if (rule.re.test(text)) warnings.push(`${rule.name}  ->  ${path.relative(appDir, f)}`);
    }
  }

  for (const w of [...new Set(warnings)]) console.warn(`[afterPack] WARNING: ${w}`);

  if (failures.length) {
    console.error('\n[afterPack] BUILD BLOCKED — secret material found in the packaged app:\n');
    for (const x of [...new Set(failures)]) console.error('  - ' + x);
    console.error('\nRemove these before shipping. See docs/LICENSING.md.\n');
    throw new Error('afterPack secret scan failed');
  }

  console.log('[afterPack] secret scan passed (no private keys / operator env / dev toggles).');
};
