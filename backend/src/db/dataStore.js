const Invoice = require('../models/Invoice');
const Bill = require('../models/Bill');
const Client = require('../models/Client');
const Product = require('../models/Product');
const Category = require('../models/Category');

const initialData = {
  invoices: [
    {
      id: 'INV-2026-001',
      clientName: 'Royal Heritage Boutique',
      clientEmail: 'orders@royalheritage.com',
      issueDate: '2026-08-01',
      dueDate: '2026-08-15',
      amount: 12490.00,
      status: 'Paid',
      category: 'Ethnic & Festive Wear'
    },
    {
      id: 'INV-2026-002',
      clientName: 'Starlight Apparel Store',
      clientEmail: 'accounts@starlightapparel.in',
      issueDate: '2026-08-05',
      dueDate: '2026-08-20',
      amount: 8950.00,
      status: 'Paid',
      category: "Men's Apparel"
    },
    {
      id: 'INV-2026-003',
      clientName: 'Velvet Trendz Fashion',
      clientEmail: 'finance@velvettrendz.com',
      issueDate: '2026-08-08',
      dueDate: '2026-08-22',
      amount: 15800.00,
      status: 'Pending',
      category: "Women's Fashion"
    },
    {
      id: 'INV-2026-004',
      clientName: 'Urban Fit Clothing Hub',
      clientEmail: 'billing@urbanfit.co',
      issueDate: '2026-08-10',
      dueDate: '2026-08-24',
      amount: 6750.00,
      status: 'Pending',
      category: 'Casuals & Denim'
    },
    {
      id: 'INV-2026-005',
      clientName: 'Little Wonders Kidswear',
      clientEmail: 'contact@littlewonders.in',
      issueDate: '2026-07-25',
      dueDate: '2026-08-08',
      amount: 4200.00,
      status: 'Overdue',
      category: 'Kidswear & Toddlers'
    },
    {
      id: 'INV-2026-006',
      clientName: 'Metro Shoes & Accessories',
      clientEmail: 'accounts@metrofashion.in',
      issueDate: '2026-08-11',
      dueDate: '2026-08-25',
      amount: 11250.00,
      status: 'Pending',
      category: 'Footwear & Accessories'
    }
  ],
  bills: [
    {
      id: 'BILL-101',
      vendor: 'Surat Silk & Cotton Mills',
      category: 'Raw Fabrics & Textiles',
      dueDate: '2026-08-18',
      amount: 18500.00,
      status: 'Unpaid',
      autoPay: true
    },
    {
      id: 'BILL-102',
      vendor: 'Ludhiana Woolens & Knitwear Supplier',
      category: 'Winterwear & Outerwear Stock',
      dueDate: '2026-08-22',
      amount: 14200.00,
      status: 'Unpaid',
      autoPay: false
    },
    {
      id: 'BILL-103',
      vendor: 'Vardhman Textiles Ltd.',
      category: 'Denim & Casual Apparel',
      dueDate: '2026-08-15',
      amount: 22800.00,
      status: 'Paid',
      autoPay: true
    },
    {
      id: 'BILL-104',
      vendor: 'Blue Dart Retail Logistics',
      category: 'Freight & Shipping Delivery',
      dueDate: '2026-08-25',
      amount: 4350.00,
      status: 'Paid',
      autoPay: true
    },
    {
      id: 'BILL-105',
      vendor: 'Jaipur Print & Embroidery Crafts',
      category: 'Ethnic & Festive Wear Stock',
      dueDate: '2026-08-30',
      amount: 12600.00,
      status: 'Unpaid',
      autoPay: false
    },
    {
      id: 'BILL-106',
      vendor: 'Prime Retail Mall Lease & Energy',
      category: 'Store Rent & Utilities',
      dueDate: '2026-09-01',
      amount: 35000.00,
      status: 'Unpaid',
      autoPay: true
    }
  ],
  clients: [
    { id: 'CLT-01', name: 'Royal Heritage Boutique', contact: 'orders@royalheritage.com', status: 'Active', totalBilled: 12490.00 },
    { id: 'CLT-02', name: 'Starlight Apparel Store', contact: 'accounts@starlightapparel.in', status: 'Active', totalBilled: 8950.00 },
    { id: 'CLT-03', name: 'Velvet Trendz Fashion', contact: 'finance@velvettrendz.com', status: 'Active', totalBilled: 15800.00 },
    { id: 'CLT-04', name: 'Urban Fit Clothing Hub', contact: 'billing@urbanfit.co', status: 'Active', totalBilled: 6750.00 },
    { id: 'CLT-05', name: 'Little Wonders Kidswear', contact: 'contact@littlewonders.in', status: 'Notice', totalBilled: 4200.00 },
    { id: 'CLT-06', name: 'Metro Shoes & Accessories', contact: 'accounts@metrofashion.in', status: 'Active', totalBilled: 11250.00 }
  ],
  products: [
    { id: 'SKU-PRD-01', name: 'Classic Cotton Slim-Fit Shirt', category: "Men's Apparel", price: 1299.00, stock: 'In Stock', count: 85 },
    { id: 'SKU-PRD-02', name: 'Floral Print Summer Chiffon Dress', category: "Women's Fashion", price: 2499.00, stock: 'In Stock', count: 42 },
    { id: 'SKU-PRD-03', name: 'Denim Jacket with Fleece Lining', category: 'Winterwear & Outerwear', price: 2799.00, stock: 'Low Stock', count: 6 },
    { id: 'SKU-PRD-04', name: 'Leather Formal Oxford Shoes', category: 'Footwear & Shoes', price: 4250.00, stock: 'In Stock', count: 30 },
    { id: 'SKU-PRD-05', name: 'Kids Organic Cotton T-Shirt Set', category: 'Kidswear & Toddlers', price: 999.00, stock: 'In Stock', count: 65 },
    { id: 'SKU-PRD-06', name: 'Handwoven Banarasi Silk Saree', category: "Women's Fashion", price: 6800.00, stock: 'In Stock', count: 12 },
    { id: 'SKU-PRD-07', name: 'Designer Leather Belt & Wallet Set', category: 'Fashion Accessories', price: 1299.00, stock: 'Low Stock', count: 4 },
    { id: 'SKU-PRD-08', name: 'Pure Linen Button-Down Formal Shirt', category: "Men's Apparel", price: 1899.00, stock: 'In Stock', count: 50 },
    { id: 'SKU-PRD-09', name: 'Casual Canvas & Leather Sneakers', category: 'Footwear & Shoes', price: 2199.00, stock: 'In Stock', count: 28 },
    { id: 'SKU-PRD-10', name: 'Embroidered Anarkali Kurti Set', category: "Women's Fashion", price: 3499.00, stock: 'In Stock', count: 18 },
    { id: 'SKU-PRD-11', name: 'Wool Blend Tailored Winter Coat', category: 'Winterwear & Outerwear', price: 4999.00, stock: 'Low Stock', count: 8 },
    { id: 'SKU-PRD-12', name: 'Toddler Denim Overalls & Polo Combo', category: 'Kidswear & Toddlers', price: 1499.00, stock: 'In Stock', count: 35 }
  ],
  categories: [
    {
      id: 'CAT-01',
      name: "Men's Apparel",
      description: 'Shirts, T-shirts, Trousers, Suits, and Ethnic Wear.',
      subCategories: ['Shirts', 'T-Shirts', 'Jeans & Trousers', 'Suits & Blazers', 'Ethnic Wear'],
      genderType: 'Men',
      seasonTag: 'All Season',
      itemCounts: 14,
      totalRevenue: 28400.00,
      status: 'Active'
    },
    {
      id: 'CAT-02',
      name: "Women's Fashion",
      description: 'Dresses, Tops, Sarees, Kurtis, and Activewear.',
      subCategories: ['Dresses & Maxis', 'Tops & Tunics', 'Sarees & Kurtis', 'Activewear'],
      genderType: 'Women',
      seasonTag: 'Festive Special',
      itemCounts: 18,
      totalRevenue: 42100.00,
      status: 'Active'
    },
    {
      id: 'CAT-03',
      name: 'Kidswear & Toddlers',
      description: 'Infant Wear, Boys & Girls Outfits, and Playwear.',
      subCategories: ['Infant Onesies', 'Boys Casuals', 'Girls Partywear', 'Sleepwear'],
      genderType: 'Kids / Toddlers',
      seasonTag: 'All Season',
      itemCounts: 12,
      totalRevenue: 18900.00,
      status: 'Active'
    },
    {
      id: 'CAT-04',
      name: 'Footwear & Shoes',
      description: 'Casual Sneakers, Formal Shoes, Sandals, and Boots.',
      subCategories: ['Sneakers', 'Formal Shoes', 'Sandals & Slippers', 'Boots'],
      genderType: 'Unisex',
      seasonTag: 'All Season',
      itemCounts: 10,
      totalRevenue: 15500.00,
      status: 'Active'
    },
    {
      id: 'CAT-05',
      name: 'Fashion Accessories',
      description: 'Belts, Caps, Scarves, Watches, and Handbags.',
      subCategories: ['Leather Belts & Wallets', 'Caps & Hats', 'Watches', 'Handbags'],
      genderType: 'Unisex',
      seasonTag: 'All Season',
      itemCounts: 15,
      totalRevenue: 31200.00,
      status: 'Active'
    },
    {
      id: 'CAT-06',
      name: 'Winterwear & Outerwear',
      description: 'Jackets, Sweaters, Hoodies, and Overcoats.',
      subCategories: ['Jackets & Coats', 'Sweaters & Cardigans', 'Fleece Hoodies', 'Thermals'],
      genderType: 'Unisex',
      seasonTag: 'Winter Special',
      itemCounts: 8,
      totalRevenue: 22400.00,
      status: 'Active'
    }
  ]
};

let isSeedingPromise = null;

// Seed initial data if MongoDB collections are empty
async function seedInitialDataIfNeeded() {
  if (isSeedingPromise) return isSeedingPromise;

  isSeedingPromise = (async () => {
    try {
      const invoiceCount = await Invoice.countDocuments();
      if (invoiceCount === 0) {
        await Invoice.insertMany(initialData.invoices);
      }

      const billCount = await Bill.countDocuments();
      if (billCount === 0) {
        await Bill.insertMany(initialData.bills);
      }

      const clientCount = await Client.countDocuments();
      if (clientCount === 0) {
        await Client.insertMany(initialData.clients);
      }

      const categoryCount = await Category.countDocuments();
      if (categoryCount === 0) {
        await Category.insertMany(initialData.categories);
      }

      const productCount = await Product.countDocuments();
      if (productCount === 0) {
        await Product.insertMany(initialData.products);
      }
    } catch (error) {
      console.error('Error seeding initial MongoDB data:', error.message);
    } finally {
      isSeedingPromise = null;
    }
  })();

  return isSeedingPromise;
}

const dataStore = {
  seedInitialDataIfNeeded,

  getInvoices: async () => {
    await seedInitialDataIfNeeded();
    let invoices = await Invoice.find().sort({ createdAt: -1 }).lean().exec();
    if (!invoices.length) {
      try {
        await Invoice.insertMany(initialData.invoices);
        invoices = await Invoice.find().sort({ createdAt: -1 }).lean().exec();
      } catch (err) {
        invoices = initialData.invoices;
      }
    }
    return invoices;
  },

  createInvoice: async (invoiceData) => {
    const count = await Invoice.countDocuments();
    const newInvoice = new Invoice({
      id: 'INV-2026-00' + (count + 1),
      clientName: invoiceData.clientName,
      clientEmail: invoiceData.clientEmail || 'billing@client.com',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: invoiceData.dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      amount: parseFloat(invoiceData.amount) || 0,
      status: invoiceData.status || 'Pending',
      category: invoiceData.category || 'General Service'
    });
    return await newInvoice.save();
  },

  updateInvoiceStatus: async (id, status) => {
    let invoice = await Invoice.findOneAndUpdate(
      { id: { $regex: new RegExp(`^${id}$`, 'i') } },
      { $set: { status } },
      { new: true }
    ).lean().exec();

    if (!invoice) {
      const invFromSeed = initialData.invoices.find(i => i.id.toLowerCase() === id.toLowerCase());
      if (invFromSeed) {
        const newInv = new Invoice({ ...invFromSeed, status });
        invoice = await newInv.save();
      }
    }
    return invoice;
  },

  getBills: async () => {
    await seedInitialDataIfNeeded();
    let bills = await Bill.find().sort({ createdAt: -1 }).lean().exec();
    if (!bills.length) {
      try {
        await Bill.insertMany(initialData.bills);
        bills = await Bill.find().sort({ createdAt: -1 }).lean().exec();
      } catch (err) {
        bills = initialData.bills;
      }
    }
    return bills;
  },

  createBill: async (billData) => {
    const count = await Bill.countDocuments();
    const newBill = new Bill({
      id: 'BILL-' + (100 + count + 1),
      vendor: billData.vendor,
      category: billData.category || 'General Expenses',
      dueDate: billData.dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      amount: parseFloat(billData.amount) || 0,
      status: billData.status || 'Unpaid',
      autoPay: !!billData.autoPay
    });
    return await newBill.save();
  },


  payBill: async (id) => {
    return await Bill.findOneAndUpdate(
      { id },
      { $set: { status: 'Paid' } },
      { new: true }
    ).lean().exec();
  },

  toggleBillStatus: async (id) => {
    const bill = await Bill.findOne({ id }).exec();
    if (!bill) return null;
    bill.status = bill.status === 'Paid' ? 'Unpaid' : 'Paid';
    return await bill.save();
  },

  toggleBillAutoPay: async (id) => {
    const bill = await Bill.findOne({ id }).exec();
    if (!bill) return null;
    bill.autoPay = !bill.autoPay;
    return await bill.save();
  },

  getClients: async () => {
    await seedInitialDataIfNeeded();
    let clients = await Client.find().lean().exec();
    if (!clients.length || clients.some(c => c.name && (c.name.includes('Acme') || c.name.includes('Apex') || c.name.includes('Cyberdyne')))) {
      try {
        await Client.deleteMany({});
        await Client.insertMany(initialData.clients);
        clients = await Client.find().lean().exec();
      } catch (err) {
        clients = initialData.clients;
      }
    }
    return clients;
  },

  toggleClientStatus: async (id) => {
    const client = await Client.findOne({ id }).exec();
    if (!client) return null;
    if (client.status === 'Active') client.status = 'Notice';
    else if (client.status === 'Notice') client.status = 'Inactive';
    else client.status = 'Active';
    return await client.save();
  },

  getProducts: async () => {
    await seedInitialDataIfNeeded();
    let products = await Product.find().lean().exec();
    if (!products.length || products.length < 12) {
      try {
        await Product.deleteMany({});
        await Product.insertMany(initialData.products);
        products = await Product.find().lean().exec();
      } catch (err) {
        products = initialData.products;
      }
    }
    return products;
  },

  createProduct: async (productData) => {
    const count = await Product.countDocuments();
    const countNum = parseInt(productData.count, 10) || 50;
    const formattedId = `SKU-PRD-${(count + 1).toString().padStart(2, '0')}`;
    const newProduct = new Product({
      id: formattedId,
      name: productData.name,
      category: productData.category || "Men's Apparel",
      price: parseFloat(productData.price) || 0,
      stock: countNum > 10 ? 'In Stock' : (countNum > 0 ? 'Low Stock' : 'Out of Stock'),
      count: countNum
    });
    return await newProduct.save();
  },

  getCategories: async () => {
    await seedInitialDataIfNeeded();
    let categories = await Category.find().lean().exec();
    if (!categories.length) {
      try {
        await Category.insertMany(initialData.categories);
        categories = await Category.find().lean().exec();
      } catch (err) {
        categories = initialData.categories;
      }
    }
    return categories;
  },

  createCategory: async (catData) => {
    const count = await Category.countDocuments();
    let subs = [];
    if (Array.isArray(catData.subCategories)) {
      subs = catData.subCategories;
    } else if (typeof catData.subCategories === 'string') {
      subs = catData.subCategories.split(',').map(s => s.trim()).filter(Boolean);
    }

    const newCat = new Category({
      id: 'CAT-0' + (count + 1),
      name: catData.name,
      description: catData.description || '',
      subCategories: subs,
      genderType: catData.genderType || 'Unisex',
      seasonTag: catData.seasonTag || 'All Season',
      itemCounts: parseInt(catData.itemCounts, 10) || 0,
      totalRevenue: 0,
      status: catData.status || 'Active'
    });
    return await newCat.save();
  },

  toggleCategoryStatus: async (id) => {
    const cat = await Category.findOne({ id }).exec();
    if (!cat) return null;
    cat.status = cat.status === 'Active' ? 'Inactive' : 'Active';
    return await cat.save();
  },

  getClientRelatedData: async (clientId) => {
    let clients = await Client.find().lean().exec();
    const invoices = await Invoice.find().lean().exec();

    const searchKey = (clientId || '').toLowerCase().trim();

    let client = clients.find(c =>
      (c.id && c.id.toLowerCase() === searchKey) ||
      (c.name && c.name.toLowerCase() === searchKey) ||
      (c.contact && c.contact.toLowerCase() === searchKey) ||
      (c.name && c.name.toLowerCase().includes(searchKey))
    );

    if (!client) {
      const matchInv = invoices.find(inv =>
        (inv.clientName && inv.clientName.toLowerCase() === searchKey) ||
        (inv.clientName && inv.clientName.toLowerCase().includes(searchKey)) ||
        (inv.clientEmail && inv.clientEmail.toLowerCase() === searchKey) ||
        (inv.id && inv.id.toLowerCase() === searchKey)
      );
      if (matchInv) {
        client = {
          id: matchInv.clientId || 'CLT-AUTO',
          name: matchInv.clientName,
          contact: matchInv.clientEmail || 'billing@client.com',
          status: 'Active',
          totalBilled: matchInv.amount || 0
        };
      }
    }

    if (!client) return null;

    const relatedInvoices = invoices.filter(inv =>
      (inv.clientId && inv.clientId.toLowerCase() === client.id.toLowerCase()) ||
      (inv.clientName && inv.clientName.toLowerCase() === client.name.toLowerCase()) ||
      (inv.clientEmail && client.contact && inv.clientEmail.toLowerCase() === client.contact.toLowerCase())
    );

    const totalBilled = relatedInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const paidAmount = relatedInvoices.filter(i => i.status === 'Paid').reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const pendingAmount = relatedInvoices.filter(i => i.status === 'Pending').reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const overdueAmount = relatedInvoices.filter(i => i.status === 'Overdue').reduce((sum, inv) => sum + (inv.amount || 0), 0);

    return {
      client,
      invoices: relatedInvoices,
      metrics: {
        totalBilled,
        paidAmount,
        pendingAmount,
        overdueAmount,
        invoicesCount: relatedInvoices.length
      }
    };
  },

  getCategoryRelatedData: async (categoryIdOrName) => {
    const categories = await Category.find().lean().exec();
    const products = await Product.find().lean().exec();
    const invoices = await Invoice.find().lean().exec();

    const category = categories.find(c =>
      c.id.toLowerCase() === categoryIdOrName.toLowerCase() ||
      c.name.toLowerCase() === categoryIdOrName.toLowerCase()
    );

    if (!category) return null;

    const relatedProducts = products.filter(p =>
      p.category && p.category.toLowerCase() === category.name.toLowerCase()
    );

    const relatedInvoices = invoices.filter(inv =>
      inv.category && inv.category.toLowerCase() === category.name.toLowerCase()
    );

    const totalCategoryRevenue = relatedInvoices
      .filter(i => i.status === 'Paid')
      .reduce((sum, inv) => sum + (inv.amount || 0), 0);

    return {
      category,
      products: relatedProducts,
      invoices: relatedInvoices,
      metrics: {
        productCount: relatedProducts.length,
        invoiceCount: relatedInvoices.length,
        categoryRevenue: totalCategoryRevenue
      }
    };
  },

  getRelationalSummary: async () => {
    const clients = await Client.find().lean().exec();
    const invoices = await Invoice.find().lean().exec();
    const products = await Product.find().lean().exec();
    const categories = await Category.find().lean().exec();
    const bills = await Bill.find().lean().exec();

    const totalInvoicedAmount = invoices.reduce((sum, i) => sum + (i.amount || 0), 0);
    const totalPaidInvoices = invoices.filter(i => i.status === 'Paid').reduce((sum, i) => sum + (i.amount || 0), 0);
    const totalPendingInvoices = invoices.filter(i => i.status === 'Pending').reduce((sum, i) => sum + (i.amount || 0), 0);
    const totalOverdueInvoices = invoices.filter(i => i.status === 'Overdue').reduce((sum, i) => sum + (i.amount || 0), 0);

    const totalBillsAmount = bills.reduce((sum, b) => sum + (b.amount || 0), 0);
    const unpaidBillsAmount = bills.filter(b => b.status === 'Unpaid').reduce((sum, b) => sum + (b.amount || 0), 0);

    const clientBreakdown = clients.map(client => {
      const clientInvs = invoices.filter(inv =>
        (inv.clientId && inv.clientId.toLowerCase() === client.id.toLowerCase()) ||
        (inv.clientName && inv.clientName.toLowerCase() === client.name.toLowerCase())
      );
      return {
        id: client.id,
        name: client.name,
        contact: client.contact,
        status: client.status,
        invoiceCount: clientInvs.length,
        totalBilled: clientInvs.reduce((sum, i) => sum + (i.amount || 0), 0),
        pendingAmount: clientInvs.filter(i => i.status === 'Pending').reduce((sum, i) => sum + (i.amount || 0), 0)
      };
    });

    const categoryBreakdown = categories.map(cat => {
      const catProducts = products.filter(p => p.category && p.category.toLowerCase() === cat.name.toLowerCase());
      const catInvoices = invoices.filter(i => i.category && i.category.toLowerCase() === cat.name.toLowerCase());
      return {
        id: cat.id,
        name: cat.name,
        productCount: catProducts.length,
        invoiceCount: catInvoices.length,
        revenue: catInvoices.filter(i => i.status === 'Paid').reduce((sum, i) => sum + (i.amount || 0), 0)
      };
    });

    return {
      totals: {
        clientsCount: clients.length,
        invoicesCount: invoices.length,
        productsCount: products.length,
        categoriesCount: categories.length,
        billsCount: bills.length,
        totalInvoicedAmount,
        totalPaidInvoices,
        totalPendingInvoices,
        totalOverdueInvoices,
        totalBillsAmount,
        unpaidBillsAmount
      },
      clientBreakdown,
      categoryBreakdown
    };
  }
};

module.exports = dataStore;
