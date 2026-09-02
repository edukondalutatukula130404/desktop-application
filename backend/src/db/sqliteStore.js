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

const DEFAULT_SEED_CATEGORIES = [
  { id: 'CAT-01', name: "Men's Apparel", subCategories: ['Shirts', 'T-Shirts', 'Jeans & Trousers', 'Suits & Blazers', 'Ethnic Wear'] },
  { id: 'CAT-02', name: "Women's Fashion", subCategories: ['Dresses & Maxis', 'Sarees & Kurtis', 'Tops & Tees', 'Ethnic Wear', 'Skirts & Shorts'] },
  { id: 'CAT-03', name: "Kidswear & Toddlers", subCategories: ['T-Shirts & Tops', 'Shorts & Skirts', 'Frocks & Dresses', 'Nightwear & Onesies', 'Ethnic Wear'] },
  { id: 'CAT-04', name: "Footwear & Shoes", subCategories: ['Sneakers', 'Formal Shoes', 'Sandals & Floaters', 'Boots', 'Heels & Flats'] },
  { id: 'CAT-05', name: "Fashion Accessories", subCategories: ['Belts & Wallets', 'Caps & Hats', 'Bags & Backpacks', 'Sunglasses', 'Socks & Gloves'] },
  { id: 'CAT-06', name: "Winterwear & Outerwear", subCategories: ['Jackets & Coats', 'Sweaters & Cardigans', 'Hoodies & Sweatshirts', 'Thermal Wear', 'Mufflers & Scarves'] }
];

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

  // Purge legacy demo seed data from disk
  if (Array.isArray(loaded.products)) {
    loaded.products = loaded.products.filter(p => p && p.id && !EXACT_DEMO_SEED_IDS.has(String(p.id).toUpperCase().trim()));
  } else {
    loaded.products = [];
  }

  if (Array.isArray(loaded.categories) && loaded.categories.length > 0) {
    DEFAULT_SEED_CATEGORIES.forEach(sc => {
      if (!loaded.categories.some(c => c.id === sc.id || (c.name && c.name.toLowerCase() === sc.name.toLowerCase()))) {
        loaded.categories.push(sc);
      }
    });
  } else {
    loaded.categories = [...DEFAULT_SEED_CATEGORIES];
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

  if (!Array.isArray(loaded.sync_queue)) loaded.sync_queue = [];
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

  async getProducts() {
    return (store.products || []).filter(p => !p.is_deleted);
  },

  async createProduct(prd) {
    const existingIdx = (store.products || []).findIndex(p => p.id === prd.id || (p.name && p.name.toLowerCase() === (prd.name || '').toLowerCase()));
    const record = {
      id: prd.id || `PRD-${Date.now()}`,
      name: prd.name,
      category: prd.category || "Men's Apparel",
      subCategory: prd.subCategory || '',
      color: prd.color || 'Black',
      size: prd.size || 'M',
      price: Number(prd.price) || 0,
      stock: prd.stock || 'In Stock',
      count: Number(prd.count) || 50,
      is_deleted: 0,
      updated_at: new Date().toISOString()
    };
    if (existingIdx >= 0) {
      store.products[existingIdx] = { ...store.products[existingIdx], ...record };
    } else {
      store.products.push(record);
    }
    saveStore();
    return record;
  },

  async updateProduct(id, updates) {
    const prd = (store.products || []).find(p => p.id === id);
    if (prd) {
      Object.assign(prd, updates, { updated_at: new Date().toISOString() });
      saveStore();
    }
    return prd;
  },

  async deleteProduct(id) {
    const prd = (store.products || []).find(p => p.id === id);
    if (prd) {
      prd.is_deleted = 1;
      prd.updated_at = new Date().toISOString();
      saveStore();
    }
  },

  async getCategories() {
    return (store.categories || []).filter(c => !c.is_deleted);
  },

  async createCategory(cat) {
    const existingIdx = (store.categories || []).findIndex(c => c.id === cat.id || (c.name && c.name.toLowerCase() === (cat.name || '').toLowerCase()));
    const record = {
      id: cat.id || `CAT-${Date.now()}`,
      name: cat.name,
      subCategories: Array.isArray(cat.subCategories) ? cat.subCategories : [],
      status: cat.status || 'Active',
      productCount: Number(cat.productCount) || 0,
      is_deleted: 0,
      updated_at: new Date().toISOString()
    };
    if (existingIdx >= 0) {
      store.categories[existingIdx] = { ...store.categories[existingIdx], ...record };
    } else {
      store.categories.push(record);
    }
    saveStore();
    return record;
  },

  async getInvoices() {
    return (store.invoices || []).filter(i => !i.is_deleted);
  },

  async getInvoiceById(id) {
    return (store.invoices || []).find(i => i.id === id && !i.is_deleted) || null;
  },

  async createInvoice(inv) {
    const existingIdx = (store.invoices || []).findIndex(i => i.id === inv.id);
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
      is_deleted: 0,
      updated_at: new Date().toISOString()
    };
    if (existingIdx >= 0) {
      store.invoices[existingIdx] = { ...store.invoices[existingIdx], ...record };
    } else {
      store.invoices.push(record);
    }
    saveStore();
    return record;
  },

  async getClients() {
    return (store.clients || []).filter(c => !c.is_deleted);
  },

  async createClient(client) {
    const existingIdx = (store.clients || []).findIndex(c => c.id === client.id || (c.name && c.name.toLowerCase() === (client.name || '').toLowerCase()));
    const record = {
      id: client.id || `CUST-${Date.now()}`,
      name: client.name,
      email: client.email || '',
      phone: client.phone || '',
      status: client.status || 'Active',
      is_deleted: 0,
      updated_at: new Date().toISOString()
    };
    if (existingIdx >= 0) {
      store.clients[existingIdx] = { ...store.clients[existingIdx], ...record };
    } else {
      store.clients.push(record);
    }
    saveStore();
    return record;
  },

  async getBills() {
    return (store.bills || []).filter(b => !b.is_deleted);
  },

  async createBill(bill) {
    const existingIdx = (store.bills || []).findIndex(b => b.id === bill.id);
    const record = {
      id: bill.id || `BILL-${Date.now()}`,
      vendor: bill.vendor,
      category: bill.category || 'Inventory Purchase',
      dueDate: bill.dueDate || new Date().toISOString().split('T')[0],
      amount: Number(bill.amount) || 0,
      status: bill.status || 'Unpaid',
      autoPay: bill.autoPay ? 1 : 0,
      is_deleted: 0,
      updated_at: new Date().toISOString()
    };
    if (existingIdx >= 0) {
      store.bills[existingIdx] = { ...store.bills[existingIdx], ...record };
    } else {
      store.bills.push(record);
    }
    saveStore();
    return record;
  },

  async getPendingSyncItems() {
    return (store.sync_queue || []).filter(q => q.status === 'PENDING');
  },

  async markSyncItemSynced(id) {
    const item = (store.sync_queue || []).find(q => q.id === id);
    if (item) item.status = 'SYNCED';
    saveStore();
  },

  async markSyncItemFailed(id, err) {
    const item = (store.sync_queue || []).find(q => q.id === id);
    if (item) {
      item.status = 'FAILED';
      item.error_message = err;
    }
    saveStore();
  },

  async clearCompletedSyncQueue() {
    store.sync_queue = (store.sync_queue || []).filter(q => q.status === 'PENDING');
    saveStore();
  }
};

module.exports = sqliteStore;
