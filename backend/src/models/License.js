const mongoose = require('mongoose');

/**
 * License — authoritative record for one issued license.
 *
 * Written by the offline CLI (tools/license-cli/issue.js) at issue time and by
 * the CLI again on revoke / suspend / extend. Read by the desktop app's embedded
 * backend during ONLINE validation. The signed .lic file the customer holds
 * mirrors the immutable fields here; `status` + `expiresAt` here are the
 * server-authoritative source for revocation / early termination.
 */
const licenseSchema = new mongoose.Schema(
  {
    licenseId: { type: String, required: true, unique: true, index: true },

    customerId: { type: String, required: true, index: true },
    customerName: { type: String, default: '' },

    productId: { type: String, required: true, default: 'nexussuite-desktop' },
    edition: { type: String, default: 'standard' },
    features: { type: [String], default: [] },

    licenseType: { type: String, enum: ['duration', 'fixed'], required: true },
    // For duration licenses we keep the human-readable spec purely for audit ("30d", "1y").
    durationSpec: { type: String, default: '' },

    // The full Ed25519-signed .lic string. Lets a running client adopt the
    // current license for its customer (after a rebuild) without reinstalling.
    signedLicense: { type: String, default: '' },

    issuedAt: { type: Date, required: true },
    notBefore: { type: Date, required: true },
    expiresAt: { type: Date, required: true, index: true },

    maxActivations: { type: Number, default: 2, min: 1 },
    bindingMode: { type: String, enum: ['soft', 'strict', 'none'], default: 'soft' },
    offlineGraceHours: { type: Number, default: 72, min: 0 },

    keyId: { type: String, required: true },

    status: {
      type: String,
      enum: ['ACTIVE', 'EXPIRED', 'REVOKED', 'SUSPENDED'],
      default: 'ACTIVE',
      index: true
    },

    // Running count kept in sync with LicenseActivation docs for fast checks.
    activationCount: { type: Number, default: 0 },

    createdBy: { type: String, default: 'license-cli' },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, default: '' },
    suspendedAt: { type: Date, default: null },
    notes: { type: String, default: '' }
  },
  { timestamps: true }
);

licenseSchema.index({ customerId: 1, status: 1 });

module.exports = mongoose.models.License || mongoose.model('License', licenseSchema);
