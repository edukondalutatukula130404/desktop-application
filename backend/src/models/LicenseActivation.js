const mongoose = require('mongoose');

/**
 * LicenseActivation — one row per (license, device) pair.
 *
 * Created/updated by the desktop app's embedded backend when the customer
 * activates or re-validates online. Enforces maxActivations and supports
 * weighted re-binding after hardware changes (bindingMode: 'soft').
 *
 * `deviceHash` is a SHA-256 of stable machine signals computed in the Electron
 * main process — raw hardware identifiers never reach the database.
 */
const licenseActivationSchema = new mongoose.Schema(
  {
    licenseId: { type: String, required: true, index: true },
    deviceHash: { type: String, required: true, index: true },

    deviceLabel: { type: String, default: '' }, // e.g. "Windows Desktop (A1B2C)"
    appVersion: { type: String, default: '' },

    // Hashed individual fingerprint signals — used to decide whether a changed
    // machine is "the same device" (soft binding). No plaintext hardware data.
    fingerprintSignals: { type: mongoose.Schema.Types.Mixed, default: {} },

    activatedAt: { type: Date, default: Date.now },
    lastValidatedAt: { type: Date, default: Date.now, index: true },
    lastSeenIp: { type: String, default: '' },

    status: {
      type: String,
      enum: ['ACTIVE', 'DEACTIVATED'],
      default: 'ACTIVE',
      index: true
    },
    deactivatedAt: { type: Date, default: null },
    deactivatedReason: { type: String, default: '' }
  },
  { timestamps: true }
);

// One activation row per license+device.
licenseActivationSchema.index({ licenseId: 1, deviceHash: 1 }, { unique: true });

module.exports =
  mongoose.models.LicenseActivation ||
  mongoose.model('LicenseActivation', licenseActivationSchema);
