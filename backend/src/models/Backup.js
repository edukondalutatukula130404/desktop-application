const mongoose = require('mongoose');

const backupSchema = new mongoose.Schema({
  backupId: { type: String, required: true, unique: true },
  companyId: { type: String, default: 'shop_default', index: true },
  userId: { type: String, default: 'usr_offline', index: true },
  email: { type: String, default: 'owner@shop.com', index: true },
  deviceId: { type: String, default: 'DEV_DEFAULT', index: true },
  version: { type: Number, default: 1 },
  recordCounts: {
    products: { type: Number, default: 0 },
    categories: { type: Number, default: 0 },
    clients: { type: Number, default: 0 },
    invoices: { type: Number, default: 0 },
    bills: { type: Number, default: 0 }
  },
  snapshotData: {
    invoices: { type: [mongoose.Schema.Types.Mixed], default: [] },
    products: { type: [mongoose.Schema.Types.Mixed], default: [] },
    categories: { type: [mongoose.Schema.Types.Mixed], default: [] },
    clients: { type: [mongoose.Schema.Types.Mixed], default: [] },
    bills: { type: [mongoose.Schema.Types.Mixed], default: [] }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Backup', backupSchema);
