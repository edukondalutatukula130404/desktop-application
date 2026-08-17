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
router.post('/bills', businessController.createBill);
router.post('/bills/:id/pay', businessController.payBill);
router.patch('/bills/:id/status', businessController.toggleBillStatus);
router.patch('/bills/:id/autopay', businessController.toggleBillAutoPay);


// Client Routes
router.get('/clients', businessController.getClients);
router.post('/clients', businessController.createClient);
router.get('/clients/:id/related', businessController.getClientRelated);
router.patch('/clients/:id/status', businessController.toggleClientStatus);

// Product Routes
router.get('/products', businessController.getProducts);
router.post('/products', businessController.createProduct);
router.put('/products/:id', businessController.updateProduct);
router.patch('/products/:id/stock', businessController.updateProductStock);
router.delete('/products/:id', businessController.deleteProduct);

// Category Routes
router.get('/categories', businessController.getCategories);
router.get('/categories/:id/related', businessController.getCategoryRelated);
router.post('/categories', businessController.createCategory);
router.put('/categories/:id', businessController.updateCategory);
router.delete('/categories/:id', businessController.deleteCategory);
router.patch('/categories/:id/status', businessController.toggleCategoryStatus);

// Relational Summary Route
router.get('/summary/relational', businessController.getRelationalSummary);

module.exports = router;
