const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: false, index: true, default: null },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  subCategories: { type: [String], default: [] },
  genderType: { type: String, default: 'Unisex' },
  seasonTag: { type: String, default: 'All Season' },
  itemCounts: { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' }
}, {
  timestamps: true
});

module.exports = mongoose.model('Category', categorySchema);
