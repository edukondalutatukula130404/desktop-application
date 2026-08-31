const mongoose = require('mongoose');

const inventoryLogSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  companyId: { type: String, required: true, index: true, default: 'shop_default' },
  productId: { type: String, required: true },
  productName: { type: String, required: true },
  type: { type: String, enum: ['STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT', 'INVOICE_SALE'], required: true },
  quantityChanged: { type: Number, required: true },
  newStockCount: { type: Number, required: true },
  reason: { type: String, default: '' },
  referenceId: { type: String, default: '' }
}, {
  timestamps: true
});

inventoryLogSchema.index({ companyId: 1, productId: 1 });
inventoryLogSchema.index({ companyId: 1, createdAt: -1 });

module.exports = mongoose.model('InventoryLog', inventoryLogSchema);
