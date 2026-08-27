const mongoose = require('mongoose');

const syncChangeSchema = new mongoose.Schema({
  changeId: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  deviceId: { type: String, required: true, index: true },
  entityType: { type: String, required: true }, // 'PRODUCT', 'CATEGORY', 'INVOICE', 'CLIENT', 'BILL'
  action: { type: String, required: true },     // 'CREATE', 'UPDATE', 'DELETE'
  entityId: { type: String, required: true },
  payload: { type: mongoose.Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now, index: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('SyncChange', syncChangeSchema);
