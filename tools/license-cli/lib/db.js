/**
 * db.js — operator-only Atlas connection for the license CLI.
 *
 * Uses LICENSE_ADMIN_MONGO_URI from tools/license-cli/.env.license (your full
 * credentials, read only on your machine). This is the SAME cluster the app
 * uses — the CLI just writes the `licenses` / `license_audit_logs` collections.
 */

'use strict';

const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.license') });

const License = require('../../../backend/src/models/License');
const LicenseActivation = require('../../../backend/src/models/LicenseActivation');
const LicenseAuditLog = require('../../../backend/src/models/LicenseAuditLog');

// IMPORTANT: use the SAME Mongoose instance the models are registered on
// (backend/ has its own node_modules/mongoose separate from the repo root).
// Connecting a different instance leaves model ops buffering forever.
const mongoose = License.base;

async function connect() {
  const uri = process.env.LICENSE_ADMIN_MONGO_URI;
  if (!uri) {
    throw new Error(
      'LICENSE_ADMIN_MONGO_URI is not set. Copy tools/license-cli/.env.license.example ' +
      'to tools/license-cli/.env.license and fill it in.'
    );
  }
  // Non-SRV replica-set URIs can take >10s for topology discovery on a cold
  // process — give it room and don't let a query buffer out before we're ready.
  mongoose.set('bufferTimeoutMS', 45000);
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 45000
  });
  if (mongoose.connection.readyState !== 1) {
    await new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error('Atlas connection did not become ready')), 30000);
      mongoose.connection.once('connected', () => { clearTimeout(to); resolve(); });
      mongoose.connection.once('error', (e) => { clearTimeout(to); reject(e); });
    });
  }
  return mongoose.connection;
}

async function disconnect() {
  try { await mongoose.disconnect(); } catch (e) {}
}

async function audit(event, fields = {}) {
  try {
    await LicenseAuditLog.create({ event, source: 'cli', serverTime: new Date(), ...fields });
  } catch (e) {
    console.warn('audit log write failed:', e.message);
  }
}

module.exports = { connect, disconnect, audit, License, LicenseActivation, LicenseAuditLog };
