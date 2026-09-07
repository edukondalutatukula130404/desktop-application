/**
 * machineFingerprint.js (Electron main) — stronger Windows device identity.
 *
 * Combines Windows MachineGuid + install date + primary MAC + CPU + memory
 * bucket + username. Only SHA-256 hashes are ever returned or transmitted —
 * raw hardware identifiers never leave this function.
 *
 * On non-Windows / failure it falls back to the backend's portable fingerprint.
 */

'use strict';

const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

function sha256(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

function winRegQuery(keyPath, valueName) {
  try {
    const out = execFileSync('reg', ['query', keyPath, '/v', valueName], {
      windowsHide: true,
      timeout: 4000
    }).toString();
    const m = out.match(new RegExp(valueName + '\\s+REG_[A-Z_]+\\s+(.+)'));
    return m ? m[1].trim() : '';
  } catch (e) {
    return '';
  }
}

function primaryMac() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const ni of ifaces[name] || []) {
      if (!ni.internal && ni.mac && ni.mac !== '00:00:00:00:00:00') return ni.mac;
    }
  }
  return 'no-mac';
}

function getMachineFingerprint() {
  if (process.platform === 'win32') {
    const machineGuid = winRegQuery('HKLM\\SOFTWARE\\Microsoft\\Cryptography', 'MachineGuid');
    const installDate = winRegQuery('HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion', 'InstallDate');
    const cpus = os.cpus();
    const signals = {
      machineGuid: sha256(machineGuid || 'no-guid'),
      installDate: sha256(installDate || 'no-date'),
      hostname: sha256(os.hostname()),
      cpu: sha256((cpus[0] && cpus[0].model) || 'cpu'),
      cpuCount: sha256(String(cpus.length)),
      memBucket: sha256(String(Math.round(os.totalmem() / 1073741824))),
      mac: sha256(primaryMac()),
      user: sha256(os.userInfo().username || 'user')
    };
    return { hash: sha256(Object.values(signals).join('|')), signals };
  }
  return require('../../backend/src/licensing/machineId').getMachineFingerprint();
}

module.exports = { getMachineFingerprint };
