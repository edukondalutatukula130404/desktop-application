const mongoose = require('mongoose');

/**
 * LicenseAuditLog — append-only trail of license lifecycle events.
 *
 * Written by both the offline CLI (issue / revoke / suspend / extend) and the
 * desktop embedded backend (activate / validate / validation-failed /
 * device-changed / clock-change-detected). NEVER stores secrets, private keys,
 * JWTs, or raw hardware identifiers.
 */
const LICENSE_AUDIT_EVENTS = [
  'LICENSE_CREATED',
  'LICENSE_ACTIVATED',
  'LICENSE_VALIDATED',
  'LICENSE_VALIDATION_FAILED',
  'LICENSE_EXPIRED',
  'LICENSE_REVOKED',
  'LICENSE_SUSPENDED',
  'LICENSE_EXTENDED',
  'LICENSE_DEACTIVATED',
  'ACTIVATION_LIMIT_REACHED',
  'DEVICE_CHANGED',
  'INVALID_SIGNATURE',
  'CLOCK_CHANGE_DETECTED',
  'OFFLINE_GRACE_EXCEEDED'
];

const licenseAuditLogSchema = new mongoose.Schema(
  {
    event: { type: String, required: true, enum: LICENSE_AUDIT_EVENTS, index: true },
    licenseId: { type: String, default: '', index: true },
    customerId: { type: String, default: '' },
    deviceHash: { type: String, default: '' },
    appVersion: { type: String, default: '' },
    ip: { type: String, default: '' },
    serverTime: { type: Date, default: Date.now, index: true },
    source: { type: String, enum: ['cli', 'desktop', 'system'], default: 'system' },
    // Small structured context. Reviewed to contain no sensitive values.
    detail: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.LicenseAuditLog ||
  mongoose.model('LicenseAuditLog', licenseAuditLogSchema);

module.exports.LICENSE_AUDIT_EVENTS = LICENSE_AUDIT_EVENTS;
