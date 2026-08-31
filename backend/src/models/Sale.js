const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  companyId: { type: String, required: true, index: true, default: 'shop_default' },
  invoiceId: { type: String, required: true },
  clientName: { type: String, default: 'Walk-in Customer' },
  amount: { type: Number, required: true },
  paymentMode: { type: String, default: 'Cash' },
  itemCount: { type: Number, default: 1 },
  saleDate: { type: String, required: true }
}, {
  timestamps: true
});

saleSchema.index({ companyId: 1, saleDate: -1 });
saleSchema.index({ companyId: 1, invoiceId: 1 });

module.exports = mongoose.model('Sale', saleSchema);
