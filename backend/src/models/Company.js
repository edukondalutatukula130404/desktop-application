const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  ownerUserId: { type: String, required: true },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  address: { type: String, default: '' },
  currency: { type: String, default: 'INR' },
  taxNumber: { type: String, default: '' }
}, {
  timestamps: true
});

module.exports = mongoose.model('Company', companySchema);
