const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  clientName: { type: String, required: true },
  clientEmail: { type: String, default: '' },
  issueDate: { type: String, required: true },
  dueDate: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['Paid', 'Pending', 'Overdue', 'Cancelled'], default: 'Pending' },
  category: { type: String, default: 'General' },
  paymentMode: { type: String, default: 'Cash' }
}, {
  timestamps: true
});

module.exports = mongoose.model('Invoice', invoiceSchema);
