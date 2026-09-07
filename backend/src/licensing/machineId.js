/**
 * machineId.js — default machine fingerprint (Phase 3).
 *
 * Electron main replaces this in Phase 4 with a stronger implementation
 * (Windows MachineGuid + MAC + CPU + install date). Everything downstream only
 * ever sees the SHA-256 hash and per-signal hashes — never raw hardware data.
 */

'use strict';

const os = require('os');
const crypto = require('crypto');

function sha256(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
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

/**
 * @returns {{ hash: string, signals: Record<string,string> }}
 */
function getMachineFingerprint() {
  const cpus = os.cpus();
  const signals = {
    platform: sha256(os.platform() + os.arch()),
    hostname: sha256(os.hostname()),
    cpu: sha256((cpus[0] && cpus[0].model) || 'cpu') ,
    cpuCount: sha256(String(cpus.length)),
    memBucket: sha256(String(Math.round(os.totalmem() / (1024 * 1024 * 1024)))), // GB, rounded
    mac: sha256(primaryMac()),
    user: sha256(os.userInfo().username || 'user')
  };
  const hash = sha256(Object.values(signals).join('|'));
  return { hash, signals };
}

/**
 * Weighted comparison for soft binding. Returns a match ratio 0..1.
 * Handles both the portable signal set (platform/hostname/cpu/…) and the
 * Electron Windows set (machineGuid/installDate/…) — iterates the union of keys.
 */
const FP_WEIGHTS = {
  machineGuid: 4,
  mac: 3,
  cpu: 2,
  installDate: 1,
  hostname: 1,
  cpuCount: 1,
  memBucket: 1,
  user: 1,
  platform: 1
};

function fingerprintMatchRatio(signalsA, signalsB) {
  if (!signalsA || !signalsB) return 0;
  const keys = new Set([...Object.keys(signalsA), ...Object.keys(signalsB)]);
  let total = 0, matched = 0;
  for (const k of keys) {
    const w = FP_WEIGHTS[k] || 1;
    total += w;
    if (signalsA[k] && signalsA[k] === signalsB[k]) matched += w;
  }
  return total ? matched / total : 0;
}

module.exports = { getMachineFingerprint, fingerprintMatchRatio, sha256 };
