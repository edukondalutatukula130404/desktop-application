const dataStore = require('../db/dataStore');

const businessController = {
  getInvoices: async (req, res) => {
    try {
      const invoices = await dataStore.getInvoices();
      res.json({ success: true, invoices });
    } catch (error) {
      console.error('getInvoices error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch invoices' });
    }
  },

  createInvoice: async (req, res) => {
    try {
      const { clientName, clientEmail, amount, dueDate, category, paymentMode } = req.body;
      if (!clientName || !amount) {
        return res.status(400).json({ success: false, message: 'Client name and amount are required' });
      }

      const invoice = await dataStore.createInvoice({ clientName, clientEmail, amount, dueDate, category, paymentMode });
      res.status(201).json({ success: true, invoice, message: 'Invoice created successfully' });
    } catch (error) {
      console.error('createInvoice error:', error);
      res.status(500).json({ success: false, message: 'Failed to create invoice' });
    }
  },

  updateInvoiceStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const updated = await dataStore.updateInvoiceStatus(id, status);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Invoice not found' });
      }
      res.json({ success: true, invoice: updated, message: `Invoice marked as ${status}` });
    } catch (error) {
      console.error('updateInvoiceStatus error:', error);
      res.status(500).json({ success: false, message: 'Failed to update invoice status' });
    }
  },

  getBills: async (req, res) => {
    try {
      const bills = await dataStore.getBills();
      res.json({ success: true, bills });
    } catch (error) {
      console.error('getBills error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch bills' });
    }
  },

  createBill: async (req, res) => {
    try {
      const { vendor, category, amount, dueDate, autoPay } = req.body;
      if (!vendor || !amount) {
        return res.status(400).json({ success: false, message: 'Vendor name and amount are required' });
      }

      const bill = await dataStore.createBill({ vendor, category, amount, dueDate, autoPay });
      res.status(201).json({ success: true, bill, message: 'Vendor bill added successfully' });
    } catch (error) {
      console.error('createBill error:', error);
      res.status(500).json({ success: false, message: 'Failed to create bill' });
    }
  },


  payBill: async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await dataStore.payBill(id);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Bill not found' });
      }
      res.json({ success: true, bill: updated, message: 'Bill paid successfully' });
    } catch (error) {
      console.error('payBill error:', error);
      res.status(500).json({ success: false, message: 'Failed to process bill payment' });
    }
  },

  toggleBillStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await dataStore.toggleBillStatus(id);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Bill not found' });
      }
      res.json({ success: true, bill: updated, message: `Bill ${id} marked as ${updated.status}` });
    } catch (error) {
      console.error('toggleBillStatus error:', error);
      res.status(500).json({ success: false, message: 'Failed to update bill status' });
    }
  },

  toggleBillAutoPay: async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await dataStore.toggleBillAutoPay(id);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Bill not found' });
      }
      res.json({ success: true, bill: updated });
    } catch (error) {
      console.error('toggleBillAutoPay error:', error);
      res.status(500).json({ success: false, message: 'Failed to toggle auto-pay' });
    }
  },

  getClients: async (req, res) => {
    try {
      const clients = await dataStore.getClients();
      res.json({ success: true, clients });
    } catch (error) {
      console.error('getClients error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch clients' });
    }
  },

  createClient: async (req, res) => {
    try {
      const client = await dataStore.createClient(req.body);
      res.status(201).json({ success: true, client, message: 'Customer created successfully' });
    } catch (error) {
      console.error('createClient error:', error);
      const status = error.statusCode || 500;
      res.status(status).json({ success: false, message: error.message || 'Failed to create customer' });
    }
  },

  toggleClientStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await dataStore.toggleClientStatus(id);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Customer not found' });
      }
      res.json({ success: true, client: updated, message: `Customer ${id} status updated to ${updated.status}` });
    } catch (error) {
      console.error('toggleClientStatus error:', error);
      res.status(500).json({ success: false, message: 'Failed to update client status' });
    }
  },

  getProducts: async (req, res) => {
    try {
      const products = await dataStore.getProducts();
      res.json({ success: true, products });
    } catch (error) {
      console.error('getProducts error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch products' });
    }
  },

  createProduct: async (req, res) => {
    try {
      const { name, category, price, count } = req.body;
      if (!name || !price) {
        return res.status(400).json({ success: false, message: 'Product name and price are required' });
      }
      const product = await dataStore.createProduct({ name, category, price, count });
      res.status(201).json({ success: true, product, message: 'Product created successfully' });
    } catch (error) {
      console.error('createProduct error:', error);
      res.status(500).json({ success: false, message: 'Failed to create product' });
    }
  },

  deleteProduct: async (req, res) => {
    try {
      const { id } = req.params;
      const result = await dataStore.deleteProduct(id);
      res.json({ success: true, message: 'Product deleted successfully', ...result });
    } catch (error) {
      console.error('deleteProduct error:', error);
      res.status(500).json({ success: false, message: 'Failed to delete product' });
    }
  },

  updateProduct: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, category, price, count, stock } = req.body;
      const updated = await dataStore.updateProduct(id, { name, category, price, count, stock });
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }
      res.json({ success: true, product: updated, message: 'Product updated successfully' });
    } catch (error) {
      console.error('updateProduct error:', error);
      res.status(500).json({ success: false, message: 'Failed to update product' });
    }
  },

  updateProductStock: async (req, res) => {
    try {
      const { id } = req.params;
      const { count, stock } = req.body;
      const updated = await dataStore.updateProductStock(id, { count, stock });
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }
      res.json({ success: true, product: updated, message: 'Product stock updated successfully' });
    } catch (error) {
      console.error('updateProductStock error:', error);
      res.status(500).json({ success: false, message: 'Failed to update product stock' });
    }
  },

  getCategories: async (req, res) => {
    try {
      const categories = await dataStore.getCategories();
      res.json({ success: true, categories });
    } catch (error) {
      console.error('getCategories error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch categories' });
    }
  },

  createCategory: async (req, res) => {
    try {
      const { name, subCategories, genderType, seasonTag, itemCounts, status } = req.body;
      if (!name) {
        return res.status(400).json({ success: false, message: 'Category name is required' });
      }
      const category = await dataStore.createCategory({ name, subCategories, genderType, seasonTag, itemCounts, status });
      res.status(201).json({ success: true, category, message: 'Category created successfully' });
    } catch (error) {
      console.error('createCategory error:', error);
      res.status(500).json({ success: false, message: 'Failed to create category' });
    }
  },

  updateCategory: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, subCategories, genderType, seasonTag, status } = req.body;
      const updated = await dataStore.updateCategory(id, { name, subCategories, genderType, seasonTag, status });
      res.json({ success: true, category: updated, message: 'Category updated successfully' });
    } catch (error) {
      console.error('updateCategory error:', error);
      res.status(500).json({ success: false, message: 'Failed to update category' });
    }
  },

  deleteCategory: async (req, res) => {
    try {
      const { id } = req.params;
      const result = await dataStore.deleteCategory(id);
      res.json({ success: true, message: 'Category deleted successfully', ...result });
    } catch (error) {
      console.error('deleteCategory error:', error);
      res.status(500).json({ success: false, message: 'Failed to delete category' });
    }
  },

  toggleCategoryStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await dataStore.toggleCategoryStatus(id);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Category not found' });
      }
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
      if (!data) {
        return res.status(404).json({ success: false, message: 'Client not found' });
      }
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
      if (!data) {
        return res.status(404).json({ success: false, message: 'Category not found' });
      }
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
  }
};

module.exports = businessController;
