const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  category: { type: String, default: 'General' },
  price: { type: Number, required: true },
  stock: { type: String, default: 'In Stock' },
  count: { type: Number, default: 0 }
}, {
  timestamps: true
});

module.exports = mongoose.model('Product', productSchema);
