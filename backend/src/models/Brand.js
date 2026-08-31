const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  companyId: { type: String, required: true, index: true, default: 'shop_default' },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  logo: { type: String, default: '' },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' }
}, {
  timestamps: true
});

brandSchema.index({ companyId: 1, name: 1 });
brandSchema.index({ companyId: 1, id: 1 });

module.exports = mongoose.model('Brand', brandSchema);
