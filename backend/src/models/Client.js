const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  id: { type: String, required: true, index: true },
  companyId: { type: String, required: true, index: true, default: 'shop_default' },

  userId: { type: String, required: false, index: true, default: null },
  name: { type: String, required: true },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  contact: { type: String, default: '' },
  address: { type: String, default: '' },
  status: { type: String, enum: ['Active', 'Notice', 'Inactive'], default: 'Active' },
  totalBilled: { type: Number, default: 0 },
  version: { type: Number, default: 1 },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null }
}, {
  timestamps: true
});

clientSchema.index({ companyId: 1, name: 1 });
clientSchema.index({ companyId: 1, id: 1 });

module.exports = mongoose.model('Client', clientSchema);

