const mongoose = require('mongoose');

const billSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: false, index: true, default: null },
  vendor: { type: String, required: true },
  category: { type: String, default: 'General Expenses' },
  dueDate: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['Paid', 'Unpaid', 'Overdue'], default: 'Unpaid' },
  autoPay: { type: Boolean, default: false }
}, {
  timestamps: true
});

module.exports = mongoose.model('Bill', billSchema);
