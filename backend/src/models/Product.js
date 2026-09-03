const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  id: { type: String, required: true, index: true },
  companyId: { type: String, required: true, index: true, default: 'shop_default' },
  userId: { type: String, required: false, index: true, default: null },
  sku: { type: String, default: '' },
  name: { type: String, required: true },
  brand: { type: String, default: '' },
  category: { type: String, default: 'General' },
  subCategory: { type: String, default: '' },
  color: { type: String, default: '' },
  size: { type: String, default: '' },
  price: { type: Number, required: true },
  costPrice: { type: Number, default: 0 },
  stock: { type: String, default: 'In Stock' },
  count: { type: Number, default: 0 },
  minStock: { type: Number, default: 5 },
  version: { type: Number, default: 1 },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null }
}, {
  timestamps: true
});

productSchema.index({ companyId: 1, name: 1 });
productSchema.index({ companyId: 1, id: 1 });
productSchema.index({ companyId: 1, category: 1 });

module.exports = mongoose.model('Product', productSchema);


