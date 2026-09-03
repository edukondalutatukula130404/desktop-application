const mongoose = require('mongoose');

const billSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  companyId: { type: String, required: true, index: true, default: 'shop_default' },
  userId: { type: String, required: false, index: true, default: null },
  vendor: { type: String, required: true },
  category: { type: String, default: 'General Expenses' },
  dueDate: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['Paid', 'Unpaid', 'Overdue'], default: 'Unpaid' },
  autoPay: { type: Boolean, default: false },
  version: { type: Number, default: 1 },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null }
}, {
  timestamps: true
});

billSchema.index({ companyId: 1, dueDate: -1 });
billSchema.index({ companyId: 1, id: 1 });

module.exports = mongoose.model('Bill', billSchema);

