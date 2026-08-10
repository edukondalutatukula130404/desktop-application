const express = require('express');
const router = express.Router();
const businessController = require('../controllers/businessController');
const authMiddleware = require('../middleware/authMiddleware');

// Protect all business endpoints with JWT auth
router.use(authMiddleware);

// Invoice Routes
router.get('/invoices', businessController.getInvoices);
router.post('/invoices', businessController.createInvoice);
router.patch('/invoices/:id/status', businessController.updateInvoiceStatus);

// Bill Routes
router.get('/bills', businessController.getBills);
router.post('/bills/:id/pay', businessController.payBill);
router.patch('/bills/:id/status', businessController.toggleBillStatus);
router.patch('/bills/:id/autopay', businessController.toggleBillAutoPay);

// Client Routes
router.get('/clients', businessController.getClients);

// Product Routes
router.get('/products', businessController.getProducts);
router.post('/products', businessController.createProduct);

// Category Routes
router.get('/categories', businessController.getCategories);
router.post('/categories', businessController.createCategory);
router.patch('/categories/:id/status', businessController.toggleCategoryStatus);

module.exports = router;
