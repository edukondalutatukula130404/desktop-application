const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  id: { type: String, required: true, index: true },
  companyId: { type: String, required: true, index: true, default: 'shop_default' },

  userId: { type: String, required: false, index: true, default: null },
  clientId: { type: String, default: '' },
  clientName: { type: String, required: true },
  clientEmail: { type: String, default: '' },
  issueDate: { type: String, required: true },
  dueDate: { type: String, required: true },
  amount: { type: Number, required: true },
  subtotal: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  status: { type: String, default: 'Pending' },
  category: { type: String, default: 'General' },
  paymentMode: { type: String, default: 'Cash' },
  items: { type: [mongoose.Schema.Types.Mixed], default: [] },
  notes: { type: String, default: '' },
  version: { type: Number, default: 1 },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null }
}, {
  timestamps: true,
  strict: false
});

invoiceSchema.index({ companyId: 1, issueDate: -1 });
invoiceSchema.index({ companyId: 1, id: 1 });

module.exports = mongoose.model('Invoice', invoiceSchema);

