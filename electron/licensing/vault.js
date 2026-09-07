/**
 * vault.js (Electron main) — encrypted, tamper-evident local license anchor.
 *
 *   %APPDATA%/<app>/license.vault   (userData — survives app reinstall)
 *
 * Preferred: Electron safeStorage (Windows DPAPI — bound to the OS user, so a
 * copied vault will not decrypt on another account/machine).
 * Fallback (safeStorage unavailable): AES-256-GCM with a key derived from the
 * machine fingerprint — still bound to the device, still tamper-evident.
 *
 * readVault() semantics:
 *   - file absent            -> null            (licenseState: NOT_ACTIVATED)
 *   - file present, bad      -> throws          (licenseState: LICENSE_TAMPERED)
 *   - file present, good     -> the object
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app, safeStorage } = require('electron');

const STATIC_SALT = 'nexussuite.license.vault.v1';

function vaultPath() {
  return path.join(app.getPath('userData'), 'license.vault');
}

function fallbackKey() {
  const { getMachineFingerprint } = require('./machineFingerprint');
  const fp = getMachineFingerprint();
  return crypto.createHash('sha256').update(fp.hash + '|' + STATIC_SALT).digest(); // 32 bytes
}

function readVault() {
  const p = vaultPath();
  if (!fs.existsSync(p)) return null;

  const rawText = fs.readFileSync(p, 'utf8');
  let box;
  try {
    box = JSON.parse(rawText);
  } catch (e) {
    throw new Error('license vault is corrupt');
  }

  if (box.enc === 'safeStorage') {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('license vault requires OS encryption which is unavailable');
    }
    const json = safeStorage.decryptString(Buffer.from(box.data, 'base64'));
    return JSON.parse(json);
  }

  if (box.enc === 'aes-256-gcm') {
    const key = fallbackKey();
    const iv = Buffer.from(box.iv, 'base64');
    const tag = Buffer.from(box.tag, 'base64');
    const dec = crypto.createDecipheriv('aes-256-gcm', key, iv);
    dec.setAuthTag(tag); // throws on tamper / wrong machine
    const out = Buffer.concat([dec.update(Buffer.from(box.data, 'base64')), dec.final()]);
    return JSON.parse(out.toString('utf8'));
  }

  throw new Error('license vault has an unknown format');
}

function writeVault(obj) {
  const p = vaultPath();

  if (obj == null) {
    try { fs.unlinkSync(p); } catch (e) {}
    return;
  }

  const json = JSON.stringify(obj);
  let box;

  if (safeStorage && typeof safeStorage.isEncryptionAvailable === 'function' && safeStorage.isEncryptionAvailable()) {
    box = { enc: 'safeStorage', v: 1, data: safeStorage.encryptString(json).toString('base64') };
  } else {
    const key = fallbackKey();
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', key, iv);
    const data = Buffer.concat([c.update(Buffer.from(json, 'utf8')), c.final()]);
    box = {
      enc: 'aes-256-gcm',
      v: 1,
      iv: iv.toString('base64'),
      tag: c.getAuthTag().toString('base64'),
      data: data.toString('base64')
    };
  }

  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(box), { mode: 0o600 });
  fs.renameSync(tmp, p);
}

module.exports = { readVault, writeVault, vaultPath };
