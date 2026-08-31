const dataStore = require('../db/dataStore');
const { emitToCompany } = require('../services/socketService');

function getCompanyId(req) {
  return (req.user && req.user.companyId) || (req.user && req.user.id ? `shop_${req.user.id}` : 'shop_default');
}

function getUserId(req) {
  return (req.user && req.user.id) || null;
}

const businessController = {
  // --- INVOICES ---
  getInvoices: async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const userId = getUserId(req);
      const invoices = await dataStore.getInvoices(userId, companyId);
      res.json({ success: true, invoices });
    } catch (error) {
      console.error('getInvoices error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch invoices' });
    }
  },

  createInvoice: async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const userId = getUserId(req);
      const { clientName, amount, items } = req.body;

      if (!clientName || amount === undefined || amount === null) {
        return res.status(400).json({ success: false, message: 'Client name and amount are required' });
      }

      // 1. Save Invoice to MongoDB Atlas
      const invoice = await dataStore.createInvoice({ ...req.body, companyId }, userId);

      // 1b. Automatically create/update Customer record in MongoDB Atlas
      if (clientName) {
        try {
          const clientObj = await dataStore.createClient({
            id: req.body.clientId || undefined,
            name: clientName,
            contact: req.body.clientEmail || req.body.clientContact || 'orders@client.com',
            totalBilled: parseFloat(amount) || 0,
            companyId
          }, userId);
          if (clientObj) {
            emitToCompany(companyId, 'customer:created', { client: clientObj });
          }
        } catch (cErr) {
          console.warn('[Invoice Workflow] Auto-create customer notice:', cErr.message);
        }
      }

      // 2. Reduce Stock in MongoDB Atlas for each invoice item & log inventory movement

      const updatedProducts = [];
      if (Array.isArray(items) && items.length > 0) {
        for (const item of items) {
          const prdId = item.id || item.productId;
          const qty = parseInt(item.quantity || item.qty || 1, 10);
          if (prdId) {
            try {
              const product = await dataStore.getProductById(prdId);
              if (product) {
                const currentCount = parseInt(product.count || 0, 10);
                const newCount = Math.max(0, currentCount - qty);
                const stockStatus = newCount > 10 ? 'In Stock' : (newCount > 0 ? 'Low Stock' : 'Out of Stock');
                const updatedPrd = await dataStore.updateProductStock(prdId, { count: newCount, stock: stockStatus }, userId);

                await dataStore.logInventoryMovement({
                  productId: prdId,
                  productName: product.name,
                  type: 'INVOICE_SALE',
                  quantityChanged: -qty,
                  newStockCount: newCount,
                  reason: `Sold in Invoice #${invoice.id}`,
                  referenceId: invoice.id
                }, companyId);

                if (updatedPrd) updatedProducts.push(updatedPrd);
              }
            } catch (pErr) {
              console.warn(`[Invoice Workflow] Product stock update notice for ${prdId}:`, pErr.message);
            }
          }
        }
      }

      // 3. Record Sales Entry in MongoDB Atlas
      try {
        await dataStore.recordSale({
          invoiceId: invoice.id,
          clientName: clientName,
          amount: parseFloat(amount) || 0,
          paymentMode: req.body.paymentMode || 'Cash',
          itemCount: Array.isArray(items) ? items.length : 1,
          saleDate: invoice.issueDate || new Date().toISOString().split('T')[0]
        }, companyId);
      } catch (sErr) {
        console.warn('[Invoice Workflow] Record sale notice:', sErr.message);
      }

      // 4. Emit Real-Time Socket.IO events to all connected devices in the company room
      emitToCompany(companyId, 'invoiceCreated', { invoice });
      emitToCompany(companyId, 'invoice:created', { invoice });
      if (updatedProducts.length > 0) {
        emitToCompany(companyId, 'inventoryUpdated', { products: updatedProducts });
        emitToCompany(companyId, 'stock:updated', { products: updatedProducts });
      }
      emitToCompany(companyId, 'dashboard:updated', { trigger: 'invoice_created', invoiceId: invoice.id });

      res.status(201).json({
        success: true,
        invoice,
        message: 'Invoice created & synced in real-time across all connected devices!'
      });
    } catch (error) {
      console.error('createInvoice error:', error);
      res.status(500).json({ success: false, message: 'Failed to create invoice' });
    }
  },

  updateInvoiceStatus: async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const { id } = req.params;
      const { status } = req.body;
      const updated = await dataStore.updateInvoiceStatus(id, status);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Invoice not found' });
      }

      emitToCompany(companyId, 'invoiceUpdated', { invoice: updated });
      emitToCompany(companyId, 'invoice:updated', { invoice: updated });
      emitToCompany(companyId, 'dashboard:updated', { trigger: 'invoice_status' });

      res.json({ success: true, invoice: updated, message: `Invoice marked as ${status}` });
    } catch (error) {
      console.error('updateInvoiceStatus error:', error);
      res.status(500).json({ success: false, message: 'Failed to update invoice status' });
    }
  },

  // --- PRODUCTS ---
  getProducts: async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const userId = getUserId(req);
      const products = await dataStore.getProducts(userId, companyId);
      res.json({ success: true, products });
    } catch (error) {
      console.error('getProducts error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch products' });
    }
  },

  createProduct: async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const userId = getUserId(req);
      const { name, price } = req.body;
      if (!name || price === undefined || price === null) {
        return res.status(400).json({ success: false, message: 'Product name and price are required' });
      }

      const product = await dataStore.createProduct({ ...req.body, companyId }, userId);
      emitToCompany(companyId, 'productCreated', { product });
      emitToCompany(companyId, 'product:created', { product });
      emitToCompany(companyId, 'dashboard:updated', { trigger: 'product_created' });

      res.status(201).json({ success: true, product, message: 'Product added & synchronized in real-time!' });
    } catch (error) {
      console.error('createProduct error:', error);
      res.status(500).json({ success: false, message: 'Failed to create product' });
    }
  },

  updateProduct: async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const userId = getUserId(req);
      const { id } = req.params;

      const updated = await dataStore.updateProduct(id, { ...req.body, companyId }, userId);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }

      emitToCompany(companyId, 'productUpdated', { product: updated });
      emitToCompany(companyId, 'product:updated', { product: updated });
      emitToCompany(companyId, 'dashboard:updated', { trigger: 'product_updated' });

      res.json({ success: true, product: updated, message: 'Product updated & synchronized in real-time!' });
    } catch (error) {
      console.error('updateProduct error:', error);
      res.status(500).json({ success: false, message: 'Failed to update product' });
    }
  },

  updateProductStock: async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const userId = getUserId(req);
      const { id } = req.params;
      const { count, stock } = req.body;

      const updated = await dataStore.updateProductStock(id, { count, stock }, userId);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }

      emitToCompany(companyId, 'inventoryUpdated', { product: updated });
      emitToCompany(companyId, 'stock:updated', { product: updated });
      emitToCompany(companyId, 'dashboard:updated', { trigger: 'stock_updated' });

      res.json({ success: true, product: updated, message: 'Stock updated & synchronized in real-time!' });
    } catch (error) {
      console.error('updateProductStock error:', error);
      res.status(500).json({ success: false, message: 'Failed to update product stock' });
    }
  },

  deleteProduct: async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const userId = getUserId(req);
      const { id } = req.params;
      const { name } = req.query;

      const result = await dataStore.deleteProduct(id, name, userId);
      emitToCompany(companyId, 'productDeleted', { id, name });
      emitToCompany(companyId, 'product:deleted', { id, name });
      emitToCompany(companyId, 'dashboard:updated', { trigger: 'product_deleted' });

      res.json({ success: true, message: 'Product deleted & synchronized in real-time!', ...result });
    } catch (error) {
      console.error('deleteProduct error:', error);
      res.status(500).json({ success: false, message: 'Failed to delete product' });
    }
  },

  // --- CATEGORIES ---
  getCategories: async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const userId = getUserId(req);
      const categories = await dataStore.getCategories(userId, companyId);
      res.json({ success: true, categories });
    } catch (error) {
      console.error('getCategories error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch categories' });
    }
  },

  createCategory: async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const userId = getUserId(req);
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ success: false, message: 'Category name is required' });
      }

      const category = await dataStore.createCategory({ ...req.body, companyId }, userId);
      emitToCompany(companyId, 'category:created', { category });

      res.status(201).json({ success: true, category, message: 'Category created & synchronized in real-time!' });
    } catch (error) {
      console.error('createCategory error:', error);
      res.status(500).json({ success: false, message: 'Failed to create category' });
    }
  },

  updateCategory: async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const userId = getUserId(req);
      const { id } = req.params;

      const updated = await dataStore.updateCategory(id, { ...req.body, companyId }, userId);
      emitToCompany(companyId, 'category:updated', { category: updated });

      res.json({ success: true, category: updated, message: 'Category updated & synchronized in real-time!' });
    } catch (error) {
      console.error('updateCategory error:', error);
      res.status(500).json({ success: false, message: 'Failed to update category' });
    }
  },

  deleteCategory: async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const userId = getUserId(req);
      const { id } = req.params;
      const { name } = req.query;

      const result = await dataStore.deleteCategory(id, name, userId);
      emitToCompany(companyId, 'category:deleted', { id, name });

      res.json({ success: true, message: 'Category deleted & synchronized in real-time!', ...result });
    } catch (error) {
      console.error('deleteCategory error:', error);
      res.status(500).json({ success: false, message: 'Failed to delete category' });
    }
  },

  toggleCategoryStatus: async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const { id } = req.params;
      const updated = await dataStore.toggleCategoryStatus(id);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Category not found' });
      }

      emitToCompany(companyId, 'category:updated', { category: updated });
      res.json({ success: true, category: updated, message: `Category ${id} status updated to ${updated.status}` });
    } catch (error) {
      console.error('toggleCategoryStatus error:', error);
      res.status(500).json({ success: false, message: 'Failed to update category status' });
    }
  },

  // --- CUSTOMERS / CLIENTS ---
  getClients: async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const clients = await dataStore.getClients(companyId);
      res.json({ success: true, clients });

    } catch (error) {
      console.error('getClients error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch customers' });
    }
  },

  createClient: async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const userId = getUserId(req);

      const client = await dataStore.createClient({ ...req.body, companyId }, userId);
      emitToCompany(companyId, 'customerCreated', { client });
      emitToCompany(companyId, 'customer:created', { client });
      emitToCompany(companyId, 'dashboard:updated', { trigger: 'customer_created' });

      res.status(201).json({ success: true, client, message: 'Customer added & synchronized in real-time!' });
    } catch (error) {
      console.error('createClient error:', error);
      res.status(500).json({ success: false, message: 'Failed to create customer' });
    }
  },

  toggleClientStatus: async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const { id } = req.params;
      const updated = await dataStore.toggleClientStatus(id);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Customer not found' });
      }

      emitToCompany(companyId, 'customerUpdated', { client: updated });
      emitToCompany(companyId, 'customer:updated', { client: updated });
      res.json({ success: true, client: updated, message: `Customer ${id} status updated to ${updated.status}` });
    } catch (error) {
      console.error('toggleClientStatus error:', error);
      res.status(500).json({ success: false, message: 'Failed to update client status' });
    }
  },

  // --- PURCHASES & EXPENSES (BILLS) ---
  getBills: async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const userId = getUserId(req);
      const bills = await dataStore.getBills(userId, companyId);
      res.json({ success: true, bills });
    } catch (error) {
      console.error('getBills error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch bills' });
    }
  },

  createBill: async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const userId = getUserId(req);
      const { vendor, amount } = req.body;

      if (!vendor || amount === undefined || amount === null) {
        return res.status(400).json({ success: false, message: 'Vendor name and amount are required' });
      }

      const bill = await dataStore.createBill({ ...req.body, companyId }, userId);
      emitToCompany(companyId, 'bill:created', { bill });

      res.status(201).json({ success: true, bill, message: 'Bill recorded & synchronized in real-time!' });
    } catch (error) {
      console.error('createBill error:', error);
      res.status(500).json({ success: false, message: 'Failed to create bill' });
    }
  },

  payBill: async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const { id } = req.params;

      const updated = await dataStore.payBill(id);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Bill not found' });
      }

      emitToCompany(companyId, 'bill:updated', { bill: updated });
      res.json({ success: true, bill: updated, message: 'Bill paid & synchronized in real-time!' });
    } catch (error) {
      console.error('payBill error:', error);
      res.status(500).json({ success: false, message: 'Failed to process bill payment' });
    }
  },

  toggleBillStatus: async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const { id } = req.params;

      const updated = await dataStore.toggleBillStatus(id);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Bill not found' });
      }

      emitToCompany(companyId, 'bill:updated', { bill: updated });
      res.json({ success: true, bill: updated, message: `Bill ${id} marked as ${updated.status}` });
    } catch (error) {
      console.error('toggleBillStatus error:', error);
      res.status(500).json({ success: false, message: 'Failed to update bill status' });
    }
  },

  toggleBillAutoPay: async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const { id } = req.params;

      const updated = await dataStore.toggleBillAutoPay(id);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Bill not found' });
      }

      emitToCompany(companyId, 'bill:updated', { bill: updated });
      res.json({ success: true, bill: updated });
    } catch (error) {
      console.error('toggleBillAutoPay error:', error);
      res.status(500).json({ success: false, message: 'Failed to toggle auto-pay' });
    }
  },

  // --- BRANDS ---
  getBrands: async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const brands = await dataStore.getBrands(companyId);
      res.json({ success: true, brands });
    } catch (error) {
      console.error('getBrands error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch brands' });
    }
  },

  createBrand: async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const { name } = req.body;
      if (!name) return res.status(400).json({ success: false, message: 'Brand name required' });

      const brand = await dataStore.createBrand({ ...req.body, companyId }, companyId);
      emitToCompany(companyId, 'brand:created', { brand });

      res.status(201).json({ success: true, brand, message: 'Brand created & synced in real-time!' });
    } catch (error) {
      console.error('createBrand error:', error);
      res.status(500).json({ success: false, message: 'Failed to create brand' });
    }
  },

  updateBrand: async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const { id } = req.params;

      const brand = await dataStore.updateBrand(id, req.body, companyId);
      emitToCompany(companyId, 'brand:updated', { brand });

      res.json({ success: true, brand });
    } catch (error) {
      console.error('updateBrand error:', error);
      res.status(500).json({ success: false, message: 'Failed to update brand' });
    }
  },

  deleteBrand: async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const { id } = req.params;

      await dataStore.deleteBrand(id, companyId);
      emitToCompany(companyId, 'brand:deleted', { id });

      res.json({ success: true, message: 'Brand deleted' });
    } catch (error) {
      console.error('deleteBrand error:', error);
      res.status(500).json({ success: false, message: 'Failed to delete brand' });
    }
  },

  // --- SUPPLIERS ---
  getSuppliers: async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const suppliers = await dataStore.getSuppliers(companyId);
      res.json({ success: true, suppliers });
    } catch (error) {
      console.error('getSuppliers error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch suppliers' });
    }
  },

  createSupplier: async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const { name } = req.body;
      if (!name) return res.status(400).json({ success: false, message: 'Supplier name required' });

      const supplier = await dataStore.createSupplier({ ...req.body, companyId }, companyId);
      emitToCompany(companyId, 'supplier:created', { supplier });

      res.status(201).json({ success: true, supplier, message: 'Supplier created & synced in real-time!' });
    } catch (error) {
      console.error('createSupplier error:', error);
      res.status(500).json({ success: false, message: 'Failed to create supplier' });
    }
  },

  updateSupplier: async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const { id } = req.params;

      const supplier = await dataStore.updateSupplier(id, req.body, companyId);
      emitToCompany(companyId, 'supplier:updated', { supplier });

      res.json({ success: true, supplier });
    } catch (error) {
      console.error('updateSupplier error:', error);
      res.status(500).json({ success: false, message: 'Failed to update supplier' });
    }
  },

  deleteSupplier: async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const { id } = req.params;

      await dataStore.deleteSupplier(id, companyId);
      emitToCompany(companyId, 'supplier:deleted', { id });

      res.json({ success: true, message: 'Supplier deleted' });
    } catch (error) {
      console.error('deleteSupplier error:', error);
      res.status(500).json({ success: false, message: 'Failed to delete supplier' });
    }
  },

  // --- INVENTORY ADJUSTMENT ---
  adjustStock: async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const userId = getUserId(req);
      const { productId, delta, type, reason } = req.body;

      if (!productId || delta === undefined) {
        return res.status(400).json({ success: false, message: 'productId and delta count required' });
      }

      const product = await dataStore.getProductById(productId);
      if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }

      const currentCount = parseInt(product.count || 0, 10);
      const changeNum = parseInt(delta, 10) || 0;
      const newCount = Math.max(0, currentCount + changeNum);
      const stockStatus = newCount > 10 ? 'In Stock' : (newCount > 0 ? 'Low Stock' : 'Out of Stock');

      const updated = await dataStore.updateProductStock(productId, { count: newCount, stock: stockStatus }, userId);

      await dataStore.logInventoryMovement({
        productId,
        productName: product.name,
        type: type || (changeNum >= 0 ? 'STOCK_IN' : 'STOCK_OUT'),
        quantityChanged: changeNum,
        newStockCount: newCount,
        reason: reason || 'Manual Stock Adjustment'
      }, companyId);

      emitToCompany(companyId, 'stock:updated', { product: updated });
      emitToCompany(companyId, 'inventory:adjusted', { productId, newCount, delta: changeNum });
      emitToCompany(companyId, 'dashboard:updated', { trigger: 'stock_adjusted' });

      res.json({
        success: true,
        product: updated,
        message: `Stock adjusted by ${changeNum > 0 ? '+' : ''}${changeNum}. New count: ${newCount}`
      });
    } catch (error) {
      console.error('adjustStock error:', error);
      res.status(500).json({ success: false, message: 'Failed to adjust inventory stock' });
    }
  },

  // --- RELATIONAL & UTILITY ---
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
        message: 'All business data successfully backed up to MongoDB Atlas!',
        result
      });
    } catch (error) {
      console.error('backupAllData error:', error);
      res.status(500).json({ success: false, message: 'Failed to backup business data' });
    }
  }
};

module.exports = businessController;
