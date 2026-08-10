const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'appData.json');

const initialData = {
  invoices: [
    {
      id: 'INV-2026-001',
      clientName: 'Acme Corporation',
      clientEmail: 'billing@acme.corp',
      issueDate: '2026-08-01',
      dueDate: '2026-08-15',
      amount: 1450.00,
      status: 'Paid',
      category: 'Software Consulting'
    },
    {
      id: 'INV-2026-002',
      clientName: 'Starlight Media',
      clientEmail: 'accounts@starlight.io',
      issueDate: '2026-08-05',
      dueDate: '2026-08-20',
      amount: 3200.00,
      status: 'Pending',
      category: 'UI/UX Redesign'
    },
    {
      id: 'INV-2026-003',
      clientName: 'Apex Logistics',
      clientEmail: 'finance@apexlogistics.com',
      issueDate: '2026-07-15',
      dueDate: '2026-07-30',
      amount: 890.00,
      status: 'Overdue',
      category: 'Cloud Infrastructure'
    },
    {
      id: 'INV-2026-004',
      clientName: 'Nexus Global',
      clientEmail: 'contact@nexusglobal.com',
      issueDate: '2026-08-08',
      dueDate: '2026-08-22',
      amount: 4750.00,
      status: 'Pending',
      category: 'Enterprise API Development'
    }
  ],
  bills: [
    {
      id: 'BILL-101',
      vendor: 'AWS Cloud Services',
      category: 'Hosting & Server Infrastructure',
      dueDate: '2026-08-18',
      amount: 420.50,
      status: 'Unpaid',
      autoPay: true
    },
    {
      id: 'BILL-102',
      vendor: 'Figma Enterprise',
      category: 'Design Tools Subscription',
      dueDate: '2026-08-25',
      amount: 180.00,
      status: 'Unpaid',
      autoPay: false
    },
    {
      id: 'BILL-103',
      vendor: 'GitHub Business',
      category: 'Version Control & Actions',
      dueDate: '2026-08-02',
      amount: 95.00,
      status: 'Paid',
      autoPay: true
    },
    {
      id: 'BILL-104',
      vendor: 'Twilio API Services',
      category: 'SMS & Telecom Gateway',
      dueDate: '2026-08-28',
      amount: 215.75,
      status: 'Unpaid',
      autoPay: false
    }
  ],
  clients: [
    { id: 'CLT-01', name: 'Acme Corporation', contact: 'billing@acme.corp', status: 'Active', totalBilled: 1450.00 },
    { id: 'CLT-02', name: 'Starlight Media', contact: 'accounts@starlight.io', status: 'Active', totalBilled: 3200.00 },
    { id: 'CLT-03', name: 'Apex Logistics', contact: 'finance@apexlogistics.com', status: 'Notice', totalBilled: 890.00 },
    { id: 'CLT-04', name: 'Nexus Global', contact: 'contact@nexusglobal.com', status: 'Active', totalBilled: 4750.00 }
  ],
  products: [
    { id: 'SKU-PRD-01', name: 'Enterprise API License', category: 'Software & Licensing', price: 1450.00, stock: 'In Stock', count: 95 },
    { id: 'SKU-PRD-02', name: 'UI/UX Design System Package', category: 'Professional Services', price: 2950.00, stock: 'In Stock', count: 40 },
    { id: 'SKU-PRD-03', name: 'Dedicated Cloud Node (Annual)', category: 'Cloud & Hosting', price: 890.00, stock: 'Low Stock', count: 4 },
    { id: 'SKU-PRD-04', name: 'Hardware Security Key (FIDO2)', category: 'Hardware', price: 120.00, stock: 'In Stock', count: 250 },
    { id: 'SKU-PRD-05', name: 'Cybersecurity Audit Service', category: 'Professional Services', price: 3400.00, stock: 'In Stock', count: 18 }
  ],
  categories: [
    { id: 'CAT-01', name: 'Software & Licensing', description: '', itemCounts: 14, totalRevenue: 28400.00, status: 'Active' },
    { id: 'CAT-02', name: 'Professional Services', description: '', itemCounts: 8, totalRevenue: 42100.00, status: 'Active' },
    { id: 'CAT-03', name: 'Cloud & Hosting', description: '', itemCounts: 12, totalRevenue: 18900.00, status: 'Active' },
    { id: 'CAT-04', name: 'Hardware', description: '', itemCounts: 6, totalRevenue: 8500.00, status: 'Active' },
    { id: 'CAT-05', name: 'Subscriptions', description: '', itemCounts: 19, totalRevenue: 31200.00, status: 'Active' }
  ]
};

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2), 'utf8');
  }
}

function readData() {
  ensureStorage();
  try {
    const content = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(content || '{}');
    let updated = false;
    if (!parsed.products || parsed.products.length === 0) {
      parsed.products = initialData.products;
      updated = true;
    }
    if (!parsed.categories || parsed.categories.length === 0) {
      parsed.categories = initialData.categories;
      updated = true;
    }
    if (updated) {
      writeData(parsed);
    }
    return parsed;
  } catch (error) {
    console.error('Error reading appData.json:', error);
    return initialData;
  }
}

function writeData(data) {
  ensureStorage();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

const dataStore = {
  getInvoices: () => readData().invoices,
  
  createInvoice: (invoiceData) => {
    const data = readData();
    const newInvoice = {
      id: 'INV-2026-00' + (data.invoices.length + 1),
      clientName: invoiceData.clientName,
      clientEmail: invoiceData.clientEmail || 'billing@client.com',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: invoiceData.dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      amount: parseFloat(invoiceData.amount) || 0,
      status: invoiceData.status || 'Pending',
      category: invoiceData.category || 'General Service'
    };
    data.invoices.unshift(newInvoice);
    writeData(data);
    return newInvoice;
  },

  updateInvoiceStatus: (id, status) => {
    const data = readData();
    const inv = data.invoices.find(i => i.id === id);
    if (inv) {
      inv.status = status;
      writeData(data);
    }
    return inv;
  },

  getBills: () => readData().bills,

  payBill: (id) => {
    const data = readData();
    const bill = data.bills.find(b => b.id === id);
    if (bill) {
      bill.status = 'Paid';
      writeData(data);
    }
    return bill;
  },

  toggleBillStatus: (id) => {
    const data = readData();
    const bill = data.bills.find(b => b.id === id);
    if (bill) {
      bill.status = bill.status === 'Paid' ? 'Unpaid' : 'Paid';
      writeData(data);
    }
    return bill;
  },

  toggleBillAutoPay: (id) => {
    const data = readData();
    const bill = data.bills.find(b => b.id === id);
    if (bill) {
      bill.autoPay = !bill.autoPay;
      writeData(data);
    }
    return bill;
  },

  getClients: () => readData().clients,

  getProducts: () => readData().products || [],

  createProduct: (productData) => {
    const data = readData();
    if (!data.products) data.products = [];
    const newProduct = {
      id: 'SKU-PRD-0' + (data.products.length + 1),
      name: productData.name,
      category: productData.category || 'General',
      price: parseFloat(productData.price) || 0,
      stock: productData.count > 0 ? 'In Stock' : 'Out of Stock',
      count: parseInt(productData.count, 10) || 0
    };
    data.products.unshift(newProduct);
    writeData(data);
    return newProduct;
  },

  getCategories: () => readData().categories || [],

  createCategory: (catData) => {
    const data = readData();
    if (!data.categories) data.categories = [];
    const newCat = {
      id: 'CAT-0' + (data.categories.length + 1),
      name: catData.name,
      description: '',
      itemCounts: parseInt(catData.itemCounts, 10) || 0,
      totalRevenue: 0,
      status: catData.status || 'Active'
    };
    data.categories.unshift(newCat);
    writeData(data);
    return newCat;
  },

  toggleCategoryStatus: (id) => {
    const data = readData();
    if (!data.categories) return null;
    const cat = data.categories.find(c => c.id === id);
    if (cat) {
      cat.status = cat.status === 'Active' ? 'Inactive' : 'Active';
      writeData(data);
      return cat;
    }
    return null;
  }
};

module.exports = dataStore;
