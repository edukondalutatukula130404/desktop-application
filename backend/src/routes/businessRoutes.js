const express = require('express');
const router = express.Router();
const businessController = require('../controllers/businessController');
const backupController = require('../controllers/backupController');
const syncController = require('../controllers/syncController');
const authMiddleware = require('../middleware/authMiddleware');
const deviceMiddleware = require('../middleware/deviceMiddleware');

// Defensive route handler wrapper — guarantees Express never crashes if a controller function is undefined
function h(fn, name) {
  if (typeof fn === 'function') return fn;
  console.warn(`[Route Guard] Warning: Handler "${name}" is undefined. Returning 501 Fallback.`);
  return (req, res) => res.status(501).json({ success: false, message: `Handler ${name} is not implemented.` });
}

// Protect all business endpoints with JWT auth & Device identification
router.use(authMiddleware);
router.use(deviceMiddleware);

// Invoice Routes
router.get('/invoices', h(businessController.getInvoices, 'getInvoices'));
router.post('/invoices', h(businessController.createInvoice, 'createInvoice'));
router.patch('/invoices/:id/status', h(businessController.updateInvoiceStatus, 'updateInvoiceStatus'));

// Bill Routes
router.get('/bills', h(businessController.getBills, 'getBills'));
router.post('/bills', h(businessController.createBill, 'createBill'));
router.post('/bills/:id/pay', h(businessController.payBill, 'payBill'));
router.patch('/bills/:id/status', h(businessController.toggleBillStatus, 'toggleBillStatus'));
router.patch('/bills/:id/autopay', h(businessController.toggleBillAutoPay, 'toggleBillAutoPay'));

// Client Routes
router.get('/clients', h(businessController.getClients, 'getClients'));
router.post('/clients', h(businessController.createClient, 'createClient'));
router.get('/clients/:id/related', h(businessController.getClientRelated, 'getClientRelated'));
router.patch('/clients/:id/status', h(businessController.toggleClientStatus, 'toggleClientStatus'));

// Product Routes
router.get('/products', h(businessController.getProducts, 'getProducts'));
router.post('/products', h(businessController.createProduct, 'createProduct'));
router.put('/products/:id', h(businessController.updateProduct, 'updateProduct'));
router.patch('/products/:id/stock', h(businessController.updateProductStock, 'updateProductStock'));
router.delete('/products/:id', h(businessController.deleteProduct, 'deleteProduct'));

// Category Routes
router.get('/categories', h(businessController.getCategories, 'getCategories'));
router.get('/categories/:id/related', h(businessController.getCategoryRelated, 'getCategoryRelated'));
router.post('/categories', h(businessController.createCategory, 'createCategory'));
router.put('/categories/:id', h(businessController.updateCategory, 'updateCategory'));
router.delete('/categories/:id', h(businessController.deleteCategory, 'deleteCategory'));
router.patch('/categories/:id/status', h(businessController.toggleCategoryStatus, 'toggleCategoryStatus'));

// Brand Routes
router.get('/brands', h(businessController.getBrands, 'getBrands'));
router.post('/brands', h(businessController.createBrand, 'createBrand'));
router.put('/brands/:id', h(businessController.updateBrand, 'updateBrand'));
router.delete('/brands/:id', h(businessController.deleteBrand, 'deleteBrand'));

// Supplier Routes
router.get('/suppliers', h(businessController.getSuppliers, 'getSuppliers'));
router.post('/suppliers', h(businessController.createSupplier, 'createSupplier'));
router.put('/suppliers/:id', h(businessController.updateSupplier, 'updateSupplier'));
router.delete('/suppliers/:id', h(businessController.deleteSupplier, 'deleteSupplier'));

// Inventory Adjustment Route
router.post('/inventory/adjust', h(businessController.adjustStock, 'adjustStock'));

// Relational Summary Route
router.get('/summary/relational', h(businessController.getRelationalSummary, 'getRelationalSummary'));

// Full System Backup Routes
router.post('/backup', h(backupController.createBackup, 'createBackup'));
router.get('/backup/latest', h(backupController.getLatestBackup, 'getLatestBackup'));
router.get('/backup/list', h(backupController.getBackupList, 'getBackupList'));
router.post('/backup/restore', h(backupController.restoreBackup, 'restoreBackup'));

// Multi-Device Synchronization Routes
router.post('/sync/push', h(syncController.pushSyncChanges, 'pushSyncChanges'));
router.get('/sync/pull', h(syncController.pullSyncChanges, 'pullSyncChanges'));
router.get('/sync/incremental', h(syncController.getIncrementalSync, 'getIncrementalSync'));

// Device Management Routes
router.post('/devices/register', h(syncController.registerDevice, 'registerDevice'));
router.get('/devices', h(syncController.getDevices, 'getDevices'));
router.delete('/devices/:deviceId', h(syncController.revokeDevice, 'revokeDevice'));

module.exports = router;

