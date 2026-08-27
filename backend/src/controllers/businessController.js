const sqliteStore = require('../db/sqliteStore');
const dataStore = require('../db/dataStore');
const syncEngine = require('../services/syncEngine');

function triggerInstantSync() {
  syncEngine.runSyncCycle().catch(err => {
    console.warn('[Controller] Background instant sync warning:', err.message);
  });
}

const businessController = {
  getInvoices: async (req, res) => {
    try {
      const invoices = await sqliteStore.getInvoices();
      res.json({ success: true, invoices });
    } catch (error) {
      console.error('getInvoices error:', error);
      const invoices = await dataStore.getInvoices();
      res.json({ success: true, invoices });
    }
  },

  createInvoice: async (req, res) => {
    try {
      const { clientName, amount } = req.body;
      if (!clientName || amount === undefined || amount === null) {
        return res.status(400).json({ success: false, message: 'Client name and amount are required' });
      }

      const invoice = await sqliteStore.createInvoice(req.body);
      triggerInstantSync();
      res.status(201).json({ success: true, invoice, message: 'Invoice created & synced directly to MongoDB successfully' });
    } catch (error) {
      console.error('createInvoice error:', error);
      res.status(500).json({ success: false, message: 'Failed to create invoice' });
    }
  },

  updateInvoiceStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const updated = await sqliteStore.updateInvoiceStatus(id, status);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Invoice not found' });
      }
      triggerInstantSync();
      res.json({ success: true, invoice: updated, message: `Invoice marked as ${status}` });
    } catch (error) {
      console.error('updateInvoiceStatus error:', error);
      res.status(500).json({ success: false, message: 'Failed to update invoice status' });
    }
  },

  getBills: async (req, res) => {
    try {
      const bills = await sqliteStore.getBills();
      res.json({ success: true, bills });
    } catch (error) {
      console.error('getBills error:', error);
      const bills = await dataStore.getBills();
      res.json({ success: true, bills });
    }
  },

  createBill: async (req, res) => {
    try {
      const { vendor, amount } = req.body;
      if (!vendor || amount === undefined || amount === null) {
        return res.status(400).json({ success: false, message: 'Vendor name and amount are required' });
      }

      const bill = await sqliteStore.createBill(req.body);
      triggerInstantSync();
      res.status(201).json({ success: true, bill, message: 'Vendor bill added & synced successfully' });
    } catch (error) {
      console.error('createBill error:', error);
      res.status(500).json({ success: false, message: 'Failed to create bill' });
    }
  },

  payBill: async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await sqliteStore.payBill(id);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Bill not found' });
      }
      triggerInstantSync();
      res.json({ success: true, bill: updated, message: 'Bill paid successfully' });
    } catch (error) {
      console.error('payBill error:', error);
      res.status(500).json({ success: false, message: 'Failed to process bill payment' });
    }
  },

  toggleBillStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await sqliteStore.toggleBillStatus(id);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Bill not found' });
      }
      triggerInstantSync();
      res.json({ success: true, bill: updated, message: `Bill ${id} marked as ${updated.status}` });
    } catch (error) {
      console.error('toggleBillStatus error:', error);
      res.status(500).json({ success: false, message: 'Failed to update bill status' });
    }
  },

  toggleBillAutoPay: async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await sqliteStore.toggleBillAutoPay(id);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Bill not found' });
      }
      triggerInstantSync();
      res.json({ success: true, bill: updated });
    } catch (error) {
      console.error('toggleBillAutoPay error:', error);
      res.status(500).json({ success: false, message: 'Failed to toggle auto-pay' });
    }
  },

  getClients: async (req, res) => {
    try {
      const clients = await sqliteStore.getClients();
      res.json({ success: true, clients });
    } catch (error) {
      console.error('getClients error:', error);
      const clients = await dataStore.getClients();
      res.json({ success: true, clients });
    }
  },

  createClient: async (req, res) => {
    try {
      const client = await sqliteStore.createClient(req.body);
      triggerInstantSync();
      res.status(201).json({ success: true, client, message: 'Customer created & synced successfully' });
    } catch (error) {
      console.error('createClient error:', error);
      res.status(500).json({ success: false, message: 'Failed to create customer' });
    }
  },

  toggleClientStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await sqliteStore.toggleClientStatus(id);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Customer not found' });
      }
      triggerInstantSync();
      res.json({ success: true, client: updated, message: `Customer ${id} status updated to ${updated.status}` });
    } catch (error) {
      console.error('toggleClientStatus error:', error);
      res.status(500).json({ success: false, message: 'Failed to update client status' });
    }
  },

  getProducts: async (req, res) => {
    try {
      const products = await sqliteStore.getProducts();
      res.json({ success: true, products });
    } catch (error) {
      console.error('getProducts error:', error);
      const products = await dataStore.getProducts();
      res.json({ success: true, products });
    }
  },

  createProduct: async (req, res) => {
    try {
      const { name, price } = req.body;
      if (!name || price === undefined || price === null) {
        return res.status(400).json({ success: false, message: 'Product name and price are required' });
      }
      const product = await sqliteStore.createProduct(req.body);
      triggerInstantSync();
      res.status(201).json({ success: true, product, message: 'Product created & synced successfully' });
    } catch (error) {
      console.error('createProduct error:', error);
      res.status(500).json({ success: false, message: 'Failed to create product' });
    }
  },

  deleteProduct: async (req, res) => {
    try {
      const { id } = req.params;
      const { name } = req.query;
      const result = await sqliteStore.deleteProduct(id, name);
      triggerInstantSync();
      res.json({ success: true, message: 'Product deleted & synced successfully', ...result });
    } catch (error) {
      console.error('deleteProduct error:', error);
      res.status(500).json({ success: false, message: 'Failed to delete product' });
    }
  },

  updateProduct: async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await sqliteStore.updateProduct(id, req.body);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }
      triggerInstantSync();
      res.json({ success: true, product: updated, message: 'Product updated & synced successfully' });
    } catch (error) {
      console.error('updateProduct error:', error);
      res.status(500).json({ success: false, message: 'Failed to update product' });
    }
  },

  updateProductStock: async (req, res) => {
    try {
      const { id } = req.params;
      const { count, stock } = req.body;
      const updated = await sqliteStore.updateProductStock(id, { count, stock });
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }
      triggerInstantSync();
      res.json({ success: true, product: updated, message: 'Product stock updated & synced successfully' });
    } catch (error) {
      console.error('updateProductStock error:', error);
      res.status(500).json({ success: false, message: 'Failed to update product stock' });
    }
  },

  getCategories: async (req, res) => {
    try {
      const categories = await sqliteStore.getCategories();
      res.json({ success: true, categories });
    } catch (error) {
      console.error('getCategories error:', error);
      const categories = await dataStore.getCategories();
      res.json({ success: true, categories });
    }
  },

  createCategory: async (req, res) => {
    try {
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ success: false, message: 'Category name is required' });
      }
      const category = await sqliteStore.createCategory(req.body);
      triggerInstantSync();
      res.status(201).json({ success: true, category, message: 'Category created & synced successfully' });
    } catch (error) {
      console.error('createCategory error:', error);
      res.status(500).json({ success: false, message: 'Failed to create category' });
    }
  },

  updateCategory: async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await sqliteStore.updateCategory(id, req.body);
      triggerInstantSync();
      res.json({ success: true, category: updated, message: 'Category updated & synced successfully' });
    } catch (error) {
      console.error('updateCategory error:', error);
      res.status(500).json({ success: false, message: 'Failed to update category' });
    }
  },

  deleteCategory: async (req, res) => {
    try {
      const { id } = req.params;
      const { name } = req.query;
      const result = await sqliteStore.deleteCategory(id, name);
      triggerInstantSync();
      res.json({ success: true, message: 'Category deleted & synced successfully', ...result });
    } catch (error) {
      console.error('deleteCategory error:', error);
      res.status(500).json({ success: false, message: 'Failed to delete category' });
    }
  },

  toggleCategoryStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await sqliteStore.toggleCategoryStatus(id);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Category not found' });
      }
      triggerInstantSync();
      res.json({ success: true, category: updated, message: `Category ${id} status updated to ${updated.status}` });
    } catch (error) {
      console.error('toggleCategoryStatus error:', error);
      res.status(500).json({ success: false, message: 'Failed to update category status' });
    }
  },

  getClientRelated: async (req, res) => {
    try {
      const { id } = req.params;
      const data = await dataStore.getClientRelatedData(id);
      res.json({ success: true, ...data });
    } catch (error) {
      console.error('getClientRelated error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch client related data' });
    }
  },

  getCategoryRelated: async (req, res) => {
    try {
      const { id } = req.params;
      const data = await dataStore.getCategoryRelatedData(id);
      res.json({ success: true, ...data });
    } catch (error) {
      console.error('getCategoryRelated error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch category related data' });
    }
  },

  getRelationalSummary: async (req, res) => {
    try {
      const summary = await dataStore.getRelationalSummary();
      res.json({ success: true, summary });
    } catch (error) {
      console.error('getRelationalSummary error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch relational summary' });
    }
  },

  backupAllData: async (req, res) => {
    try {
      const { invoices, products, categories, clients, bills } = req.body || {};
      const result = await dataStore.backupAllData({ invoices, products, categories, clients, bills });
      res.json({
        success: true,
        message: 'All business data successfully backed up to cloud database!',
        result
      });
    } catch (error) {
      console.error('backupAllData error:', error);
      res.status(500).json({ success: false, message: 'Failed to backup business data to database' });
    }
  }
};

module.exports = businessController;
