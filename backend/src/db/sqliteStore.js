const fs = require('fs');
const path = require('path');
const os = require('os');

function getStorageDir() {
  const appDataDir = process.env.APPDATA || (process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Preferences') : path.join(os.homedir(), '.config'));
  const dbDir = path.join(appDataDir, 'InvoiceProDesktop', 'local-data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  return dbDir;
}

const storagePath = path.join(getStorageDir(), 'store.json');

const DEFAULT_SEED_CATEGORIES = [];

const DEFAULT_SEED_PRODUCTS = [];
const DEFAULT_SEED_INVOICES = [];
const DEFAULT_SEED_CLIENTS = [];
const DEFAULT_SEED_BILLS = [];

function loadStore() {
  let loaded = null;
  try {
    if (fs.existsSync(storagePath)) {
      const data = fs.readFileSync(storagePath, 'utf8');
      loaded = JSON.parse(data);
    }
  } catch (e) {}

  if (!loaded) loaded = {};

  const EXACT_DEMO_SEED_IDS = new Set([
    'SKU-PRD-01', 'SKU-PRD-02', 'SKU-PRD-03', 'SKU-PRD-04', 'SKU-PRD-05', 'SKU-PRD-06',
    'SKU-PRD-07', 'SKU-PRD-08', 'SKU-PRD-09', 'SKU-PRD-10', 'SKU-PRD-11', 'SKU-PRD-12'
  ]);

  const SEED_CAT_NAMES = new Set([
    "men's apparel", "women's fashion", "kidswear & toddlers",
    "footwear & shoes", "fashion accessories", "winterwear & outerwear"
  ]);

  // Purge legacy demo seed data from disk
  if (Array.isArray(loaded.products)) {
    loaded.products = loaded.products.filter(p => p && p.id && !EXACT_DEMO_SEED_IDS.has(String(p.id).toUpperCase().trim()));
  } else {
    loaded.products = [];
  }

  if (Array.isArray(loaded.categories)) {
    loaded.categories = loaded.categories.filter(c => c && c.name);
  } else {
    loaded.categories = [];
  }

  if (Array.isArray(loaded.invoices)) {
    loaded.invoices = loaded.invoices.filter(i => i && i.id && !i.id.startsWith('INV-20260901-'));
  } else {
    loaded.invoices = [];
  }

  if (Array.isArray(loaded.clients)) {
    loaded.clients = loaded.clients.filter(c => c && c.id && !c.id.startsWith('CUST-00'));
  } else {
    loaded.clients = [];
  }

  if (Array.isArray(loaded.bills)) {
    loaded.bills = loaded.bills.filter(b => b && b.id && !b.id.startsWith('BILL-00'));
  } else {
    loaded.bills = [];
  }

  if (!Array.isArray(loaded.sales)) loaded.sales = [];
  if (!Array.isArray(loaded.inventory_logs)) loaded.inventory_logs = [];
  if (!Array.isArray(loaded.sync_queue)) loaded.sync_queue = [];
  if (!Array.isArray(loaded.processed_operation_ids)) loaded.processed_operation_ids = [];
  if (!loaded.meta) loaded.meta = { device_id: 'DEV-' + Date.now().toString().slice(-6) };

  return loaded;
}

let store = loadStore();

function saveStore() {
  try {
    fs.writeFileSync(storagePath, JSON.stringify(store, null, 2), 'utf8');
  } catch (e) {}
}

const sqliteStore = {
  getDeviceId() {
    return store.meta.device_id || 'DEV-LOCAL';
  },

  async getSyncMetaData(key) {
    return store.meta[key] || null;
  },

  async setSyncMetaData(key, value) {
    store.meta[key] = value;
    saveStore();
  },

  isOperationProcessed(operationId) {
    if (!operationId) return false;
    if (!store.processed_operation_ids) store.processed_operation_ids = [];
    return store.processed_operation_ids.includes(String(operationId));
  },

  recordProcessedOperation(operationId) {
    if (!operationId) return;
    if (!store.processed_operation_ids) store.processed_operation_ids = [];
    const idStr = String(operationId);
    if (!store.processed_operation_ids.includes(idStr)) {
      store.processed_operation_ids.push(idStr);
      if (store.processed_operation_ids.length > 5000) {
        store.processed_operation_ids.shift();
      }
      saveStore();
    }
  },

  async getProducts() {
    return (store.products || []).filter(p => !p.is_deleted);
  },

  async getProductById(id) {
    if (!id) return null;
    const idLower = String(id).toLowerCase().trim();
    return (store.products || []).find(p => !p.is_deleted && (String(p.id).toLowerCase().trim() === idLower || (p.name && String(p.name).toLowerCase().trim() === idLower))) || null;
  },

  async createProduct(prd, opts = {}) {
    const existingIdx = (store.products || []).findIndex(p => p.id === prd.id || (p.name && p.name.toLowerCase() === (prd.name || '').toLowerCase()));
    const existing = existingIdx >= 0 ? store.products[existingIdx] : null;
    const nextVersion = existing ? ((Number(existing.version) || 1) + 1) : (Number(prd.version) || 1);
    const countNum = prd.count !== undefined ? Number(prd.count) : 50;

    const record = {
      id: prd.id || `PRD-${Date.now()}`,
      name: prd.name,
      category: prd.category || "Men's Apparel",
      subCategory: prd.subCategory || '',
      color: prd.color || 'Black',
      size: prd.size || 'M',
      price: Number(prd.price) || 0,
      stock: prd.stock || (countNum > 10 ? 'In Stock' : (countNum > 0 ? 'Low Stock' : 'Out of Stock')),
      count: countNum,
      companyId: prd.companyId || 'shop_default',
      userId: prd.userId || 'user_local',
      version: nextVersion,
      is_deleted: 0,
      updated_at: new Date().toISOString()
    };
    if (existingIdx >= 0) {
      store.products[existingIdx] = { ...store.products[existingIdx], ...record };
    } else {
      store.products.push(record);
    }

    if (!opts.skipSyncQueue) {
      const opId = prd.operationId || `OP-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      sqliteStore.enqueueSyncItem({
        operationId: opId,
        deviceId: sqliteStore.getDeviceId(),
        userId: prd.userId || 'user_local',
        entity: 'PRODUCT',
        entityId: record.id,
        operation: existing ? 'UPDATE' : 'CREATE',
        payload: record,
        version: record.version,
        createdAt: record.updated_at
      });
    }

    saveStore();
    return record;
  },

  async updateProduct(id, updates) {
    const prd = (store.products || []).find(p => p.id === id);
    if (prd) {
      prd.version = (Number(prd.version) || 1) + 1;
      Object.assign(prd, updates, { updated_at: new Date().toISOString() });

      sqliteStore.enqueueSyncItem({
        operationId: updates.operationId || `OP-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        deviceId: sqliteStore.getDeviceId(),
        userId: updates.userId || 'user_local',
        entity: 'PRODUCT',
        entityId: id,
        operation: 'UPDATE',
        payload: prd,
        version: prd.version,
        createdAt: prd.updated_at
      });

      saveStore();
    }
    return prd;
  },

  async deleteProduct(id, name = '') {
    if (!store.products) store.products = [];
    if (!store.deleted_product_keys) store.deleted_product_keys = [];
    const idKey = id ? String(id).toLowerCase().trim() : '';
    const nameKey = name ? String(name).toLowerCase().trim() : '';

    if (idKey && !store.deleted_product_keys.includes(idKey)) store.deleted_product_keys.push(idKey);
    if (nameKey && !store.deleted_product_keys.includes(nameKey)) store.deleted_product_keys.push(nameKey);

    store.products = store.products.filter(p => {
      const pId = p.id ? String(p.id).toLowerCase().trim() : '';
      const pName = p.name ? String(p.name).toLowerCase().trim() : '';
      if (idKey && pId === idKey) return false;
      if (nameKey && pName === nameKey) return false;
      return true;
    });

    sqliteStore.enqueueSyncItem({
      operationId: `OP-DEL-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      deviceId: sqliteStore.getDeviceId(),
      userId: 'user_local',
      entity: 'PRODUCT',
      entityId: id || name,
      operation: 'DELETE',
      payload: { id, name },
      version: 1,
      createdAt: new Date().toISOString()
    });

    saveStore();
    return true;
  },

  getDeletedProductKeys() {
    return store.deleted_product_keys || [];
  },

  async getCategories() {
    return (store.categories || []).filter(c => !c.is_deleted);
  },

  async createCategory(cat, opts = {}) {
    const existingIdx = (store.categories || []).findIndex(c => c.id === cat.id || (c.name && c.name.toLowerCase() === (cat.name || '').toLowerCase()));
    const existing = existingIdx >= 0 ? store.categories[existingIdx] : null;
    const nextVersion = existing ? ((Number(existing.version) || 1) + 1) : (Number(cat.version) || 1);

    const record = {
      id: cat.id || `CAT-${Date.now()}`,
      name: cat.name,
      subCategories: Array.isArray(cat.subCategories) ? cat.subCategories : [],
      description: cat.description || '',
      genderType: cat.genderType || 'Unisex',
      seasonTag: cat.seasonTag || 'All Season',
      status: cat.status || 'Active',
      productCount: Number(cat.productCount || cat.itemCounts) || 0,
      companyId: cat.companyId || 'shop_default',
      userId: cat.userId || 'user_local',
      version: nextVersion,
      is_deleted: 0,
      updated_at: new Date().toISOString()
    };
    if (existingIdx >= 0) {
      store.categories[existingIdx] = { ...store.categories[existingIdx], ...record };
    } else {
      store.categories.push(record);
    }

    if (!opts.skipSyncQueue) {
      sqliteStore.enqueueSyncItem({
        operationId: cat.operationId || `OP-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        deviceId: sqliteStore.getDeviceId(),
        userId: cat.userId || 'user_local',
        entity: 'CATEGORY',
        entityId: record.id,
        operation: existing ? 'UPDATE' : 'CREATE',
        payload: record,
        version: record.version,
        createdAt: record.updated_at
      });
    }

    saveStore();
    return record;
  },

  async deleteCategory(id, name = '') {
    if (!store.categories) store.categories = [];
    const idKey = id ? String(id).toLowerCase().trim() : '';
    const nameKey = name ? String(name).toLowerCase().trim() : '';
    store.categories = store.categories.filter(c => {
      const cId = c.id ? String(c.id).toLowerCase().trim() : '';
      const cName = c.name ? String(c.name).toLowerCase().trim() : '';
      if (idKey && cId === idKey) return false;
      if (nameKey && cName === nameKey) return false;
      return true;
    });

    sqliteStore.enqueueSyncItem({
      operationId: `OP-DEL-CAT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      deviceId: sqliteStore.getDeviceId(),
      userId: 'user_local',
      entity: 'CATEGORY',
      entityId: id || name,
      operation: 'DELETE',
      payload: { id, name },
      version: 1,
      createdAt: new Date().toISOString()
    });

    saveStore();
    return true;
  },

  async getInvoices() {
    return (store.invoices || []).filter(i => !i.is_deleted);
  },

  async getInvoiceById(id) {
    return (store.invoices || []).find(i => i.id === id && !i.is_deleted) || null;
  },

  async createInvoice(inv, opts = {}) {
    const existingIdx = (store.invoices || []).findIndex(i => i.id === inv.id);
    const existing = existingIdx >= 0 ? store.invoices[existingIdx] : null;
    const nextVersion = existing ? ((Number(existing.version) || 1) + 1) : (Number(inv.version) || 1);

    const record = {
      id: inv.id || `INV-${Date.now()}`,
      clientId: inv.clientId || '',
      clientName: inv.clientName || 'Walk-in Retail Customer',
      clientEmail: inv.clientEmail || '',
      issueDate: inv.issueDate || new Date().toISOString().split('T')[0],
      dueDate: inv.dueDate || new Date().toISOString().split('T')[0],
      amount: Number(inv.amount) || 0,
      status: inv.status || 'Paid',
      category: inv.category || 'Retail Sale',
      paymentMode: inv.paymentMode || 'Cash',
      items: Array.isArray(inv.items) ? inv.items : [],
      version: nextVersion,
      is_deleted: 0,
      updated_at: new Date().toISOString()
    };
    if (existingIdx >= 0) {
      store.invoices[existingIdx] = { ...store.invoices[existingIdx], ...record };
    } else {
      store.invoices.push(record);
    }

    if (!opts.skipSyncQueue) {
      sqliteStore.enqueueSyncItem({
        operationId: inv.operationId || `OP-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        deviceId: sqliteStore.getDeviceId(),
        userId: inv.userId || 'user_local',
        entity: 'INVOICE',
        entityId: record.id,
        operation: existing ? 'UPDATE' : 'CREATE',
        payload: record,
        version: record.version,
        createdAt: record.updated_at
      });
    }

    saveStore();
    return record;
  },

  async getClients() {
    return (store.clients || []).filter(c => !c.is_deleted);
  },

  async createClient(client, opts = {}) {
    const existingIdx = (store.clients || []).findIndex(c => c.id === client.id || (c.name && c.name.toLowerCase() === (client.name || '').toLowerCase()));
    const existing = existingIdx >= 0 ? store.clients[existingIdx] : null;
    const nextVersion = existing ? ((Number(existing.version) || 1) + 1) : (Number(client.version) || 1);

    const record = {
      id: client.id || `CUST-${Date.now()}`,
      name: client.name,
      email: client.email || '',
      phone: client.phone || '',
      status: client.status || 'Active',
      version: nextVersion,
      is_deleted: 0,
      updated_at: new Date().toISOString()
    };
    if (existingIdx >= 0) {
      store.clients[existingIdx] = { ...store.clients[existingIdx], ...record };
    } else {
      store.clients.push(record);
    }

    if (!opts.skipSyncQueue) {
      sqliteStore.enqueueSyncItem({
        operationId: client.operationId || `OP-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        deviceId: sqliteStore.getDeviceId(),
        userId: client.userId || 'user_local',
        entity: 'CUSTOMER',
        entityId: record.id,
        operation: existing ? 'UPDATE' : 'CREATE',
        payload: record,
        version: record.version,
        createdAt: record.updated_at
      });
    }

    saveStore();
    return record;
  },

  async getBills() {
    return (store.bills || []).filter(b => !b.is_deleted);
  },

  async createBill(bill, opts = {}) {
    const existingIdx = (store.bills || []).findIndex(b => b.id === bill.id);
    const existing = existingIdx >= 0 ? store.bills[existingIdx] : null;
    const nextVersion = existing ? ((Number(existing.version) || 1) + 1) : (Number(bill.version) || 1);

    const record = {
      id: bill.id || `BILL-${Date.now()}`,
      vendor: bill.vendor,
      category: bill.category || 'Inventory Purchase',
      dueDate: bill.dueDate || new Date().toISOString().split('T')[0],
      amount: Number(bill.amount) || 0,
      status: bill.status || 'Unpaid',
      autoPay: bill.autoPay ? 1 : 0,
      version: nextVersion,
      is_deleted: 0,
      updated_at: new Date().toISOString()
    };
    if (existingIdx >= 0) {
      store.bills[existingIdx] = { ...store.bills[existingIdx], ...record };
    } else {
      store.bills.push(record);
    }

    if (!opts.skipSyncQueue) {
      sqliteStore.enqueueSyncItem({
        operationId: bill.operationId || `OP-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        deviceId: sqliteStore.getDeviceId(),
        userId: bill.userId || 'user_local',
        entity: 'BILL',
        entityId: record.id,
        operation: existing ? 'UPDATE' : 'CREATE',
        payload: record,
        version: record.version,
        createdAt: record.updated_at
      });
    }

    saveStore();
    return record;
  },

  enqueueSyncItem(itemData) {
    if (!store.sync_queue) store.sync_queue = [];
    const opId = itemData.operationId || `OP-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // Avoid duplicate queue entry for exact operationId
    const existingIdx = store.sync_queue.findIndex(q => q.operationId === opId || q.id === opId);
    const queueRecord = {
      id: opId,
      operationId: opId,
      deviceId: itemData.deviceId || sqliteStore.getDeviceId(),
      userId: itemData.userId || 'user_local',
      entity: itemData.entity || itemData.entity_type || 'UNKNOWN',
      entity_type: itemData.entity || itemData.entity_type || 'UNKNOWN',
      entityId: itemData.entityId || itemData.entity_id || '',
      entity_id: itemData.entityId || itemData.entity_id || '',
      operation: itemData.operation || 'CREATE',
      payload: itemData.payload,
      version: itemData.version || 1,
      createdAt: itemData.createdAt || new Date().toISOString(),
      status: itemData.status || 'PENDING',
      retryCount: itemData.retryCount || 0
    };

    if (existingIdx >= 0) {
      store.sync_queue[existingIdx] = queueRecord;
    } else {
      store.sync_queue.push(queueRecord);
    }

    saveStore();
    return queueRecord;
  },

  async getPendingSyncItems() {
    return (store.sync_queue || []).filter(q => q.status === 'PENDING');
  },

  async markSyncItemSynced(id) {
    const item = (store.sync_queue || []).find(q => q.id === id || q.operationId === id);
    if (item) item.status = 'SYNCED';
    saveStore();
  },

  async markSyncItemFailed(id, err) {
    const item = (store.sync_queue || []).find(q => q.id === id || q.operationId === id);
    if (item) {
      item.status = 'FAILED';
      item.retryCount = (item.retryCount || 0) + 1;
      item.error_message = err;
    }
    saveStore();
  },

  async clearCompletedSyncQueue() {
    store.sync_queue = (store.sync_queue || []).filter(q => q.status === 'PENDING');
    saveStore();
  },

  async recordSale(sale) {
    if (!store.sales) store.sales = [];
    const record = {
      id: sale.id || `SALE-${Date.now().toString().slice(-6)}`,
      companyId: sale.companyId || 'shop_default',
      invoiceId: sale.invoiceId,
      clientName: sale.clientName || 'Walk-in Customer',
      amount: parseFloat(sale.amount) || 0,
      paymentMode: sale.paymentMode || 'Cash',
      itemCount: parseInt(sale.itemCount, 10) || 1,
      saleDate: sale.saleDate || new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    };
    store.sales.unshift(record);
    saveStore();
    return record;
  },

  async getSales(companyId) {
    let list = store.sales || [];
    if (companyId) {
      list = list.filter(s => s.companyId === companyId || s.companyId === 'shop_default');
    }
    return list;
  },

  async logInventoryMovement(logData) {
    if (!store.inventory_logs) store.inventory_logs = [];
    const record = {
      id: logData.id || `LOG-${Date.now().toString().slice(-6)}`,
      companyId: logData.companyId || 'shop_default',
      productId: logData.productId,
      productName: logData.productName || 'Product',
      type: logData.type || 'ADJUSTMENT',
      quantityChanged: parseInt(logData.quantityChanged, 10) || 0,
      newStockCount: parseInt(logData.newStockCount, 10) || 0,
      reason: logData.reason || '',
      referenceId: logData.referenceId || '',
      createdAt: new Date().toISOString()
    };
    store.inventory_logs.unshift(record);
    if (store.inventory_logs.length > 200) store.inventory_logs = store.inventory_logs.slice(0, 200);
    saveStore();
    return record;
  },

  async getInventoryLogs(companyId) {
    let list = store.inventory_logs || [];
    if (companyId) {
      list = list.filter(l => l.companyId === companyId || l.companyId === 'shop_default');
    }
    return list;
  }
};

module.exports = sqliteStore;
