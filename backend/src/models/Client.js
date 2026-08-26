const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: false, index: true, default: null },
  name: { type: String, required: true },
  contact: { type: String, default: '' },
  status: { type: String, enum: ['Active', 'Notice', 'Inactive'], default: 'Active' },
  totalBilled: { type: Number, default: 0 }
}, {
  timestamps: true
});

module.exports = mongoose.model('Client', clientSchema);
