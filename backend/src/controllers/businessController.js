const dataStore = require('../db/dataStore');

const businessController = {
  getInvoices: (req, res) => {
    try {
      const invoices = dataStore.getInvoices();
      res.json({ success: true, invoices });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch invoices' });
    }
  },

  createInvoice: (req, res) => {
    try {
      const { clientName, clientEmail, amount, dueDate, category } = req.body;
      if (!clientName || !amount) {
        return res.status(400).json({ success: false, message: 'Client name and amount are required' });
      }

      const invoice = dataStore.createInvoice({ clientName, clientEmail, amount, dueDate, category });
      res.status(201).json({ success: true, invoice, message: 'Invoice created successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to create invoice' });
    }
  },

  updateInvoiceStatus: (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const updated = dataStore.updateInvoiceStatus(id, status);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Invoice not found' });
      }
      res.json({ success: true, invoice: updated, message: `Invoice marked as ${status}` });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to update invoice status' });
    }
  },

  getBills: (req, res) => {
    try {
      const bills = dataStore.getBills();
      res.json({ success: true, bills });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch bills' });
    }
  },

  payBill: (req, res) => {
    try {
      const { id } = req.params;
      const updated = dataStore.payBill(id);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Bill not found' });
      }
      res.json({ success: true, bill: updated, message: 'Bill paid successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to process bill payment' });
    }
  },

  toggleBillStatus: (req, res) => {
    try {
      const { id } = req.params;
      const updated = dataStore.toggleBillStatus(id);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Bill not found' });
      }
      res.json({ success: true, bill: updated, message: `Bill ${id} marked as ${updated.status}` });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to update bill status' });
    }
  },

  toggleBillAutoPay: (req, res) => {
    try {
      const { id } = req.params;
      const updated = dataStore.toggleBillAutoPay(id);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Bill not found' });
      }
      res.json({ success: true, bill: updated });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to toggle auto-pay' });
    }
  },

  getClients: (req, res) => {
    try {
      const clients = dataStore.getClients();
      res.json({ success: true, clients });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch clients' });
    }
  },

  toggleClientStatus: (req, res) => {
    try {
      const { id } = req.params;
      const updated = dataStore.toggleClientStatus(id);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Customer not found' });
      }
      res.json({ success: true, client: updated, message: `Customer ${id} status updated to ${updated.status}` });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to update client status' });
    }
  },

  getProducts: (req, res) => {
    try {
      const products = dataStore.getProducts();
      res.json({ success: true, products });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch products' });
    }
  },

  createProduct: (req, res) => {
    try {
      const { name, category, price, count } = req.body;
      if (!name || !price) {
        return res.status(400).json({ success: false, message: 'Product name and price are required' });
      }
      const product = dataStore.createProduct({ name, category, price, count });
      res.status(201).json({ success: true, product, message: 'Product created successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to create product' });
    }
  },

  getCategories: (req, res) => {
    try {
      const categories = dataStore.getCategories();
      res.json({ success: true, categories });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch categories' });
    }
  },

  createCategory: (req, res) => {
    try {
      const { name, itemCounts, status } = req.body;
      if (!name) {
        return res.status(400).json({ success: false, message: 'Category name is required' });
      }
      const category = dataStore.createCategory({ name, itemCounts, status });
      res.status(201).json({ success: true, category, message: 'Category created successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to create category' });
    }
  },

  toggleCategoryStatus: (req, res) => {
    try {
      const { id } = req.params;
      const updated = dataStore.toggleCategoryStatus(id);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Category not found' });
      }
      res.json({ success: true, category: updated, message: `Category ${id} status updated to ${updated.status}` });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to update category status' });
    }
  }
};

module.exports = businessController;
