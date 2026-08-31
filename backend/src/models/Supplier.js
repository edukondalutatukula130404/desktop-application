const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  companyId: { type: String, required: true, index: true, default: 'shop_default' },
  name: { type: String, required: true },
  contactPerson: { type: String, default: '' },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  address: { type: String, default: '' },
  category: { type: String, default: 'Apparel' },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' }
}, {
  timestamps: true
});

supplierSchema.index({ companyId: 1, name: 1 });
supplierSchema.index({ companyId: 1, id: 1 });

module.exports = mongoose.model('Supplier', supplierSchema);
