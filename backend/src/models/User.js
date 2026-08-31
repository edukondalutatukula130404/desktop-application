const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  companyId: { type: String, default: 'shop_default', index: true },
  shopName: { type: String, default: 'My Clothing Shop' },
  role: { type: String, default: 'user' },
  createdAt: { type: String, default: () => new Date().toISOString() }
}, {
  timestamps: true
});

userSchema.index({ companyId: 1, email: 1 });

module.exports = mongoose.model('User', userSchema);

