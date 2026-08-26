const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: false, index: true, default: null },
  name: { type: String, required: true },
  category: { type: String, default: 'General' },
  subCategory: { type: String, default: '' },
  color: { type: String, default: '' },
  size: { type: String, default: '' },
  price: { type: Number, required: true },
  stock: { type: String, default: 'In Stock' },
  count: { type: Number, default: 0 },
  version: { type: Number, default: 1 }
}, {
  timestamps: true
});

productSchema.index({ userId: 1, name: 1 });
productSchema.index({ userId: 1, id: 1 });

module.exports = mongoose.model('Product', productSchema);

