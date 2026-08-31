const { v4: uuidv4 } = require('uuid');
const { dbRun, dbGet, dbAll, dbExec, getDeviceId } = require('./sqliteDB');

const sqliteStore = {
  // Sync Queue Helper
  async enqueueSync(entityType, entityId, operation, payload) {
    const queueId = `SYNC-${uuidv4()}`;
    const now = new Date().toISOString();
    const deviceId = getDeviceId();
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);

    await dbRun(
      `INSERT INTO sync_queue (id, entity_type, entity_id, operation, payload, created_at, updated_at, sync_status, retry_count, device_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', 0, ?)`,
      [queueId, entityType, entityId, operation, payloadStr, now, now, deviceId]
    );
    return queueId;
  },

  // INVOICES
  async getInvoices() {
    const invoices = await dbAll(`SELECT * FROM invoices ORDER BY updated_at DESC`);
    for (const inv of invoices) {
      const items = await dbAll(`SELECT * FROM invoice_items WHERE invoiceId = ?`, [inv.id]);
      inv.items = items || [];
    }
    return invoices;
  },

  async getInvoiceById(id) {
    if (!id) return null;
    const inv = await dbGet(`SELECT * FROM invoices WHERE LOWER(id) = LOWER(?)`, [id.toString().trim()]);
    if (!inv) return null;
    inv.items = await dbAll(`SELECT * FROM invoice_items WHERE invoiceId = ?`, [inv.id]);
    return inv;
  },

  async createInvoice(invoiceData, options = {}) {
    const deviceId = getDeviceId();
    const now = new Date().toISOString();
    const dateMerged = (invoiceData.issueDate || now.split('T')[0]).replace(/-/g, '');
    const skipSyncQueue = !!options.skipSyncQueue;
    const initialSyncStatus = skipSyncQueue ? 'SYNCED' : 'PENDING';
    
    // Generate UUID if not custom
    const id = invoiceData.id || `INV-${dateMerged}-${uuidv4().substring(0, 4).toUpperCase()}`;
    const clientId = invoiceData.clientId || `CUST-${dateMerged}-${uuidv4().substring(0, 4).toUpperCase()}`;
    const clientName = (invoiceData.clientName || 'Walk-in Retail Customer').trim();
    const amount = parseFloat(invoiceData.amount) || 0;
    const subtotal = parseFloat(invoiceData.subtotal) || amount;
    const tax = parseFloat(invoiceData.tax) || 0;
    const discount = parseFloat(invoiceData.discount) || 0;
    const status = invoiceData.status || 'Paid';
    const category = invoiceData.category || 'Retail Sale';
    const paymentMode = invoiceData.paymentMode || 'Cash';
    const notes = invoiceData.notes || '';
    const issueDate = invoiceData.issueDate || now.split('T')[0];
    const dueDate = invoiceData.dueDate || issueDate;
    const clientEmail = invoiceData.clientEmail || '';

    // Check if invoice already exists locally
    const existing = await dbGet(`SELECT id FROM invoices WHERE id = ?`, [id]);
    if (existing) {
      await dbRun(
        `UPDATE invoices SET clientName=?, clientEmail=?, issueDate=?, dueDate=?, amount=?, subtotal=?, tax=?, discount=?, status=?, category=?, paymentMode=?, notes=?, updated_at=?, sync_status=?
         WHERE id=?`,
        [clientName, clientEmail, issueDate, dueDate, amount, subtotal, tax, discount, status, category, paymentMode, notes, now, initialSyncStatus, id]
      );
    } else {
      await dbRun(
        `INSERT INTO invoices (id, clientId, clientName, clientEmail, issueDate, dueDate, amount, subtotal, tax, discount, status, category, paymentMode, notes, updated_at, device_id, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, clientId, clientName, clientEmail, issueDate, dueDate, amount, subtotal, tax, discount, status, category, paymentMode, notes, now, deviceId, initialSyncStatus]
      );
    }

    // Insert Invoice Items atomically
    if (Array.isArray(invoiceData.items)) {
      await dbRun(`DELETE FROM invoice_items WHERE invoiceId = ?`, [id]);
      for (const item of invoiceData.items) {
        const itemId = `ITEM-${uuidv4()}`;
        const itemQty = parseFloat(item.qty) || 1;
        const itemPrice = parseFloat(item.price) || 0;
        const itemSubtotal = parseFloat(item.subtotal) || (itemQty * itemPrice);

        await dbRun(
          `INSERT INTO invoice_items (id, invoiceId, productName, category, subCategory, color, size, qty, price, subtotal)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [itemId, id, item.name || item.productName || 'Product Item', item.category || "Men's Apparel", item.subCategory || 'Shirts', item.color || 'Black', item.size || 'M', itemQty, itemPrice, itemSubtotal]
        );

        // Deduct Product Stock Level in SQLite if not pulling
        if (item.name && !skipSyncQueue) {
          const prdName = item.name.trim();
          const prd = await dbGet(`SELECT * FROM products WHERE LOWER(name) = LOWER(?)`, [prdName]);
          if (prd) {
            const newCount = Math.max(0, (prd.count || 0) - itemQty);
            const newStock = newCount > 10 ? 'In Stock' : (newCount > 0 ? 'Low Stock' : 'Out of Stock');
            await dbRun(
              `UPDATE products SET count = ?, stock = ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`,
              [newCount, newStock, now, prd.id]
            );
            await sqliteStore.enqueueSync('PRODUCT', prd.id, 'UPDATE', { id: prd.id, count: newCount, stock: newStock });
          }
        }
      }
    }

    // Ensure Customer Record always exists locally (even when pulling remote invoices)
    let customer = null;
    if (clientId) {
      customer = await dbGet(`SELECT * FROM customers WHERE id = ?`, [clientId]);
    }
    if (!customer && clientName) {
      customer = await dbGet(`SELECT * FROM customers WHERE LOWER(name) = LOWER(?)`, [clientName.toLowerCase()]);
    }

    if (!customer) {
      // Customer doesn't exist locally — create from invoice data
      const targetCustId = clientId || `CUST-${dateMerged}-${uuidv4().substring(0, 4).toUpperCase()}`;
      await dbRun(
        `INSERT INTO customers (id, name, email, phone, contact, status, totalBilled, updated_at, device_id, sync_status)
         VALUES (?, ?, ?, ?, ?, 'Active', ?, ?, ?, ?)`,
        [targetCustId, clientName, clientEmail, '+91 98765 43210', clientEmail || 'orders@client.com', amount, now, deviceId, initialSyncStatus]
      );
      if (!skipSyncQueue) {
        await sqliteStore.enqueueSync('CUSTOMER', targetCustId, 'CREATE', { id: targetCustId, name: clientName, email: clientEmail, totalBilled: amount });
      }
    } else if (!skipSyncQueue) {
      // Only update stored totalBilled counter when not pulling (local write) — getClients() computes live total from JOIN
      const newTotalBilled = (customer.totalBilled || 0) + amount;
      await dbRun(
        `UPDATE customers SET totalBilled = ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`,
        [newTotalBilled, now, customer.id]
      );
      await sqliteStore.enqueueSync('CUSTOMER', customer.id, 'UPDATE', { id: customer.id, name: customer.name, totalBilled: newTotalBilled });
    }

    const fullInvoice = await sqliteStore.getInvoiceById(id);
    if (!skipSyncQueue) {
      await sqliteStore.enqueueSync('INVOICE', id, 'CREATE', fullInvoice);
    }

    return fullInvoice;
  },

  async updateInvoiceStatus(id, status) {
    const now = new Date().toISOString();
    await dbRun(`UPDATE invoices SET status = ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`, [status, now, id]);
    const inv = await sqliteStore.getInvoiceById(id);
    if (inv) {
      await sqliteStore.enqueueSync('INVOICE', id, 'UPDATE', { id, status });
    }
    return inv;
  },

  // PRODUCTS
  async getProducts() {
    return await dbAll(`SELECT * FROM products ORDER BY name ASC`);
  },

  async createProduct(productData, options = {}) {
    const deviceId = getDeviceId();
    const now = new Date().toISOString();
    const skipSyncQueue = !!options.skipSyncQueue;
    const initialSyncStatus = skipSyncQueue ? 'SYNCED' : 'PENDING';
    const name = (productData.name || 'New Product').trim();
    let existing = null;
    if (productData.id) {
      existing = await dbGet(`SELECT * FROM products WHERE id = ?`, [productData.id]);
    }
    if (!existing && name) {
      existing = await dbGet(`SELECT * FROM products WHERE LOWER(name) = LOWER(?)`, [name.toLowerCase()]);
    }
    const id = existing ? existing.id : (productData.id || `SKU-PRD-${uuidv4().substring(0, 6).toUpperCase()}`);

    const category = productData.category || "Men's Apparel";
    const subCategory = productData.subCategory || 'Shirts';
    const color = productData.color || 'Black';
    const size = productData.size || 'M';
    const price = parseFloat(productData.price) || 0;
    const count = parseInt(productData.count || 0, 10);
    const stock = productData.stock || (count > 10 ? 'In Stock' : (count > 0 ? 'Low Stock' : 'Out of Stock'));

    if (existing) {
      await dbRun(
        `UPDATE products SET name=?, category=?, subCategory=?, color=?, size=?, price=?, stock=?, count=?, updated_at=?, sync_status=?
         WHERE id=?`,
        [name, category, subCategory, color, size, price, stock, count, now, initialSyncStatus, id]
      );
    } else {
      await dbRun(
        `INSERT INTO products (id, name, category, subCategory, color, size, price, stock, count, updated_at, device_id, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, name, category, subCategory, color, size, price, stock, count, now, deviceId, initialSyncStatus]
      );
    }

    const prd = await dbGet(`SELECT * FROM products WHERE id = ?`, [id]);
    if (!skipSyncQueue) {
      await sqliteStore.enqueueSync('PRODUCT', id, existing ? 'UPDATE' : 'CREATE', prd);
    }
    return prd;
  },

  async updateProduct(id, productData) {
    const now = new Date().toISOString();
    const prd = await dbGet(`SELECT * FROM products WHERE id = ?`, [id]);
    if (!prd) return null;

    const name = productData.name !== undefined ? productData.name.trim() : prd.name;
    const category = productData.category !== undefined ? productData.category : prd.category;
    const subCategory = productData.subCategory !== undefined ? productData.subCategory : prd.subCategory;
    const color = productData.color !== undefined ? productData.color : prd.color;
    const size = productData.size !== undefined ? productData.size : prd.size;
    const price = productData.price !== undefined ? parseFloat(productData.price) : prd.price;
    const count = productData.count !== undefined ? parseInt(productData.count, 10) : prd.count;
    const stock = productData.stock !== undefined ? productData.stock : (count > 10 ? 'In Stock' : (count > 0 ? 'Low Stock' : 'Out of Stock'));

    await dbRun(
      `UPDATE products SET name=?, category=?, subCategory=?, color=?, size=?, price=?, stock=?, count=?, updated_at=?, sync_status='PENDING'
       WHERE id=?`,
      [name, category, subCategory, color, size, price, stock, count, now, id]
    );

    const updated = await dbGet(`SELECT * FROM products WHERE id = ?`, [id]);
    await sqliteStore.enqueueSync('PRODUCT', id, 'UPDATE', updated);
    return updated;
  },

  async updateProductStock(id, { count, stock }) {
    const now = new Date().toISOString();
    const prd = await dbGet(`SELECT * FROM products WHERE id = ?`, [id]);
    if (!prd) return null;

    const newCount = count !== undefined ? parseInt(count, 10) : prd.count;
    const newStock = stock || (newCount > 10 ? 'In Stock' : (newCount > 0 ? 'Low Stock' : 'Out of Stock'));

    await dbRun(`UPDATE products SET count = ?, stock = ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`, [newCount, newStock, now, id]);
    const updated = await dbGet(`SELECT * FROM products WHERE id = ?`, [id]);
    await sqliteStore.enqueueSync('PRODUCT', id, 'UPDATE', { id, count: newCount, stock: newStock });
    return updated;
  },

  async deleteProduct(id, name) {
    const now = new Date().toISOString();
    let prd = null;
    if (id) prd = await dbGet(`SELECT * FROM products WHERE id = ?`, [id]);
    if (!prd && name) prd = await dbGet(`SELECT * FROM products WHERE LOWER(name) = LOWER(?)`, [name.trim()]);
    
    if (prd) {
      await dbRun(`DELETE FROM products WHERE id = ?`, [prd.id]);
      await sqliteStore.enqueueSync('PRODUCT', prd.id, 'DELETE', { id: prd.id, name: prd.name });
      return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
  },

  // CUSTOMERS / CLIENTS
  async getClients() {
    // Always compute totalBilled from actual invoice records so all devices stay in sync
    const clients = await dbAll(`
      SELECT c.*,
             COALESCE(SUM(i.amount), 0) AS totalBilled
      FROM customers c
      LEFT JOIN invoices i ON LOWER(i.clientId) = LOWER(c.id)
                           OR LOWER(i.clientName) = LOWER(c.name)
      GROUP BY c.id
      ORDER BY c.id ASC
    `);
    return clients;
  },

  async createClient(clientData, options = {}) {
    const deviceId = getDeviceId();
    const now = new Date().toISOString();
    const skipSyncQueue = !!options.skipSyncQueue;
    const initialSyncStatus = skipSyncQueue ? 'SYNCED' : 'PENDING';
    const name = (clientData.name || 'New Customer').trim();
    let existing = null;
    if (clientData.id) {
      existing = await dbGet(`SELECT * FROM customers WHERE id = ?`, [clientData.id]);
    }
    if (!existing && name) {
      existing = await dbGet(`SELECT * FROM customers WHERE LOWER(name) = LOWER(?)`, [name.toLowerCase()]);
    }
    const id = existing ? existing.id : (clientData.id || `CUST-${now.split('T')[0].replace(/-/g, '')}-${uuidv4().substring(0, 4).toUpperCase()}`);

    const email = clientData.email || (existing ? existing.email : '');
    const phone = clientData.phone || (existing ? existing.phone : '+91 98765 43210');
    const contact = clientData.contact || email || 'orders@client.com';
    const status = clientData.status || 'Active';
    const totalBilled = clientData.totalBilled !== undefined ? parseFloat(clientData.totalBilled) : (existing ? existing.totalBilled : 0);

    if (existing) {
      await dbRun(
        `UPDATE customers SET name=?, email=?, phone=?, contact=?, status=?, totalBilled=?, updated_at=?, sync_status=?
         WHERE id=?`,
        [name, email, phone, contact, status, totalBilled, now, initialSyncStatus, id]
      );
    } else {
      await dbRun(
        `INSERT INTO customers (id, name, email, phone, contact, status, totalBilled, updated_at, device_id, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, name, email, phone, contact, status, totalBilled, now, deviceId, initialSyncStatus]
      );
    }

    const client = await dbGet(`SELECT * FROM customers WHERE id = ?`, [id]);
    if (!skipSyncQueue) {
      await sqliteStore.enqueueSync('CUSTOMER', id, existing ? 'UPDATE' : 'CREATE', client);
    }
    return client;
  },

  async toggleClientStatus(id) {
    const now = new Date().toISOString();
    const client = await dbGet(`SELECT * FROM customers WHERE id = ?`, [id]);
    if (!client) return null;

    const newStatus = client.status === 'Active' ? 'Notice' : 'Active';
    await dbRun(`UPDATE customers SET status = ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`, [newStatus, now, id]);
    const updated = await dbGet(`SELECT * FROM customers WHERE id = ?`, [id]);
    await sqliteStore.enqueueSync('CUSTOMER', id, 'UPDATE', { id, status: newStatus });
    return updated;
  },

  // CATEGORIES
  async getCategories() {
    return await dbAll(`SELECT * FROM categories ORDER BY name ASC`);
  },

  async createCategory(catData, options = {}) {
    const deviceId = getDeviceId();
    const now = new Date().toISOString();
    const skipSyncQueue = !!options.skipSyncQueue;
    const initialSyncStatus = skipSyncQueue ? 'SYNCED' : 'PENDING';
    const name = (catData.name || 'New Category').trim();
    let existing = null;
    if (catData.id) {
      existing = await dbGet(`SELECT * FROM categories WHERE id = ?`, [catData.id]);
    }
    if (!existing && name) {
      existing = await dbGet(`SELECT * FROM categories WHERE LOWER(name) = LOWER(?)`, [name.toLowerCase()]);
    }
    const id = existing ? existing.id : (catData.id || `CAT-${uuidv4().substring(0, 6).toUpperCase()}`);
    const subCategories = typeof catData.subCategories === 'string' ? catData.subCategories : JSON.stringify(catData.subCategories || []);
    const status = catData.status || 'Active';
    const productCount = catData.productCount || 0;

    if (existing) {
      await dbRun(
        `UPDATE categories SET name=?, subCategories=?, status=?, productCount=?, updated_at=?, sync_status=? WHERE id=?`,
        [name, subCategories, status, productCount, now, initialSyncStatus, id]
      );
    } else {
      await dbRun(
        `INSERT INTO categories (id, name, subCategories, status, productCount, updated_at, device_id, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, name, subCategories, status, productCount, now, deviceId, initialSyncStatus]
      );
    }

    const cat = await dbGet(`SELECT * FROM categories WHERE id = ?`, [id]);
    if (!skipSyncQueue) {
      await sqliteStore.enqueueSync('CATEGORY', id, existing ? 'UPDATE' : 'CREATE', cat);
    }
    return cat;
  },

  async updateCategory(id, catData) {
    const now = new Date().toISOString();
    const cat = await dbGet(`SELECT * FROM categories WHERE id = ?`, [id]);
    if (!cat) return null;

    const name = catData.name !== undefined ? catData.name.trim() : cat.name;
    const subCategories = catData.subCategories !== undefined ? (typeof catData.subCategories === 'string' ? catData.subCategories : JSON.stringify(catData.subCategories)) : cat.subCategories;
    const status = catData.status !== undefined ? catData.status : cat.status;
    const productCount = catData.productCount !== undefined ? catData.productCount : cat.productCount;

    await dbRun(
      `UPDATE categories SET name=?, subCategories=?, status=?, productCount=?, updated_at=?, sync_status='PENDING' WHERE id=?`,
      [name, subCategories, status, productCount, now, id]
    );

    const updated = await dbGet(`SELECT * FROM categories WHERE id = ?`, [id]);
    await sqliteStore.enqueueSync('CATEGORY', id, 'UPDATE', updated);
    return updated;
  },

  async deleteCategory(id, name) {
    let cat = null;
    if (id) cat = await dbGet(`SELECT * FROM categories WHERE id = ?`, [id]);
    if (!cat && name) cat = await dbGet(`SELECT * FROM categories WHERE LOWER(name) = LOWER(?)`, [name.trim()]);

    if (cat) {
      await dbRun(`DELETE FROM categories WHERE id = ?`, [cat.id]);
      await sqliteStore.enqueueSync('CATEGORY', cat.id, 'DELETE', { id: cat.id, name: cat.name });
      return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
  },

  async toggleCategoryStatus(id) {
    const now = new Date().toISOString();
    const cat = await dbGet(`SELECT * FROM categories WHERE id = ?`, [id]);
    if (!cat) return null;

    const newStatus = cat.status === 'Active' ? 'Disabled' : 'Active';
    await dbRun(`UPDATE categories SET status = ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`, [newStatus, now, id]);
    const updated = await dbGet(`SELECT * FROM categories WHERE id = ?`, [id]);
    await sqliteStore.enqueueSync('CATEGORY', id, 'UPDATE', { id, status: newStatus });
    return updated;
  },

  // BILLS
  async getBills() {
    return await dbAll(`SELECT * FROM bills ORDER BY dueDate ASC`);
  },

  async createBill(billData, options = {}) {
    const deviceId = getDeviceId();
    const now = new Date().toISOString();
    const skipSyncQueue = !!options.skipSyncQueue;
    const initialSyncStatus = skipSyncQueue ? 'SYNCED' : 'PENDING';
    const vendor = (billData.vendor || 'Vendor').trim();
    let existing = null;
    if (billData.id) {
      existing = await dbGet(`SELECT * FROM bills WHERE id = ?`, [billData.id]);
    }
    const id = existing ? existing.id : (billData.id || `BILL-${uuidv4().substring(0, 6).toUpperCase()}`);
    const category = billData.category || 'General Expense';
    const dueDate = billData.dueDate || now.split('T')[0];
    const amount = parseFloat(billData.amount) || 0;
    const status = billData.status || 'Unpaid';
    const autoPay = billData.autoPay ? 1 : 0;

    if (existing) {
      await dbRun(
        `UPDATE bills SET vendor=?, category=?, dueDate=?, amount=?, status=?, autoPay=?, updated_at=?, sync_status=? WHERE id=?`,
        [vendor, category, dueDate, amount, status, autoPay, now, initialSyncStatus, id]
      );
    } else {
      await dbRun(
        `INSERT INTO bills (id, vendor, category, dueDate, amount, status, autoPay, updated_at, device_id, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, vendor, category, dueDate, amount, status, autoPay, now, deviceId, initialSyncStatus]
      );
    }

    const bill = await dbGet(`SELECT * FROM bills WHERE id = ?`, [id]);
    if (!skipSyncQueue) {
      await sqliteStore.enqueueSync('BILL', id, 'CREATE', bill);
    }
    return bill;
  },

  async payBill(id) {
    const now = new Date().toISOString();
    await dbRun(`UPDATE bills SET status = 'Paid', updated_at = ?, sync_status = 'PENDING' WHERE id = ?`, [now, id]);
    const bill = await dbGet(`SELECT * FROM bills WHERE id = ?`, [id]);
    if (bill) {
      await sqliteStore.enqueueSync('BILL', id, 'UPDATE', { id, status: 'Paid' });
    }
    return bill;
  },

  async toggleBillStatus(id) {
    const now = new Date().toISOString();
    const bill = await dbGet(`SELECT * FROM bills WHERE id = ?`, [id]);
    if (!bill) return null;

    const newStatus = bill.status === 'Paid' ? 'Unpaid' : 'Paid';
    await dbRun(`UPDATE bills SET status = ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`, [newStatus, now, id]);
    const updated = await dbGet(`SELECT * FROM bills WHERE id = ?`, [id]);
    await sqliteStore.enqueueSync('BILL', id, 'UPDATE', { id, status: newStatus });
    return updated;
  },

  async toggleBillAutoPay(id) {
    const now = new Date().toISOString();
    const bill = await dbGet(`SELECT * FROM bills WHERE id = ?`, [id]);
    if (!bill) return null;

    const newAutoPay = bill.autoPay ? 0 : 1;
    await dbRun(`UPDATE bills SET autoPay = ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`, [newAutoPay, now, id]);
    const updated = await dbGet(`SELECT * FROM bills WHERE id = ?`, [id]);
    await sqliteStore.enqueueSync('BILL', id, 'UPDATE', { id, autoPay: newAutoPay });
    return updated;
  },

  // SYNC QUEUE MANAGEMENT
  async getPendingSyncItems() {
    return await dbAll(`SELECT * FROM sync_queue WHERE sync_status = 'PENDING' OR (sync_status = 'FAILED' AND retry_count < 5) ORDER BY created_at ASC`);
  },

  async markSyncItemSynced(queueId) {
    const now = new Date().toISOString();
    await dbRun(`UPDATE sync_queue SET sync_status = 'SYNCED', synced_at = ?, updated_at = ? WHERE id = ?`, [now, now, queueId]);
  },

  async markSyncItemFailed(queueId, errorMsg) {
    const now = new Date().toISOString();
    await dbRun(
      `UPDATE sync_queue SET sync_status = 'FAILED', retry_count = retry_count + 1, last_error = ?, updated_at = ? WHERE id = ?`,
      [errorMsg || 'Sync failed', now, queueId]
    );
  },

  async clearCompletedSyncQueue() {
    await dbRun(`DELETE FROM sync_queue WHERE sync_status = 'SYNCED' OR retry_count >= 5`);
  },

  async getSyncMetaData(key) {
    const row = await dbGet(`SELECT value FROM sync_metadata WHERE key = ?`, [key]);
    return row ? row.value : null;
  },

  async setSyncMetaData(key, value) {
    const now = new Date().toISOString();
    await dbRun(
      `INSERT INTO sync_metadata (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, value, now]
    );
  }
};

module.exports = sqliteStore;
