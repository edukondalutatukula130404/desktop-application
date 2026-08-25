const Invoice = require('../models/Invoice');
const Bill = require('../models/Bill');
const Client = require('../models/Client');
const Product = require('../models/Product');
const Category = require('../models/Category');

const initialData = {
  invoices: [
    {
      id: 'INV-20260801-001',
      clientName: 'Royal Heritage Boutique',
      clientEmail: 'orders@royalheritage.com',
      issueDate: '2026-08-01',
      dueDate: '2026-08-15',
      amount: 12490.00,
      status: 'Paid',
      category: 'Ethnic & Festive Wear',
      subCategory: 'Silk Sarees'
    },
    {
      id: 'INV-20260805-002',
      clientName: 'Starlight Apparel Store',
      clientEmail: 'accounts@starlightapparel.in',
      issueDate: '2026-08-05',
      dueDate: '2026-08-20',
      amount: 8950.00,
      status: 'Paid',
      category: "Men's Apparel",
      subCategory: 'Shirts & T-Shirts'
    },
    {
      id: 'INV-20260808-003',
      clientName: 'Velvet Trendz Fashion',
      clientEmail: 'finance@velvettrendz.com',
      issueDate: '2026-08-08',
      dueDate: '2026-08-22',
      amount: 15800.00,
      status: 'Pending',
      category: "Women's Fashion",
      subCategory: 'Chiffons & Dresses'
    },
    {
      id: 'INV-20260810-004',
      clientName: 'Urban Fit Clothing Hub',
      clientEmail: 'billing@urbanfit.co',
      issueDate: '2026-08-10',
      dueDate: '2026-08-24',
      amount: 6750.00,
      status: 'Pending',
      category: 'Casuals & Denim',
      subCategory: 'Chino Trousers'
    },
    {
      id: 'INV-20260725-005',
      clientName: 'Little Wonders Kidswear',
      clientEmail: 'contact@littlewonders.in',
      issueDate: '2026-07-25',
      dueDate: '2026-08-08',
      amount: 4200.00,
      status: 'Overdue',
      category: 'Kidswear & Toddlers',
      subCategory: 'Infant Onesies'
    },
    {
      id: 'INV-20260811-006',
      clientName: 'Metro Shoes & Accessories',
      clientEmail: 'accounts@metrofashion.in',
      issueDate: '2026-08-11',
      dueDate: '2026-08-25',
      amount: 11250.00,
      status: 'Pending',
      category: 'Footwear & Accessories',
      subCategory: 'Sneakers & Boots'
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
    { id: 'CUST-20260801001', name: 'Royal Heritage Boutique', contact: 'orders@royalheritage.com', status: 'Active', totalBilled: 12490.00 },
    { id: 'CUST-20260805002', name: 'Starlight Apparel Store', contact: 'accounts@starlightapparel.in', status: 'Active', totalBilled: 8950.00 },
    { id: 'CUST-20260808003', name: 'Velvet Trendz Fashion', contact: 'finance@velvettrendz.com', status: 'Active', totalBilled: 15800.00 },
    { id: 'CUST-20260810004', name: 'Urban Fit Clothing Hub', contact: 'billing@urbanfit.co', status: 'Active', totalBilled: 6750.00 },
    { id: 'CUST-20260725005', name: 'Little Wonders Kidswear', contact: 'contact@littlewonders.in', status: 'Notice', totalBilled: 4200.00 },
    { id: 'CUST-20260811006', name: 'Metro Shoes & Accessories', contact: 'accounts@metrofashion.in', status: 'Active', totalBilled: 11250.00 }
  ],
  products: [
    { id: 'SKU-PRD-01', name: 'Classic Cotton Slim-Fit Shirt', category: "Men's Apparel", subCategory: 'Shirts', color: 'Navy Blue', size: 'M', price: 1299.00, stock: 'In Stock', count: 85 },
    { id: 'SKU-PRD-02', name: 'Floral Print Summer Chiffon Dress', category: "Women's Fashion", subCategory: 'Dresses & Maxis', color: 'Pink', size: 'S', price: 2499.00, stock: 'In Stock', count: 42 },
    { id: 'SKU-PRD-03', name: 'Denim Jacket with Fleece Lining', category: 'Winterwear & Outerwear', subCategory: 'Jackets & Coats', color: 'Royal Blue', size: 'L', price: 2799.00, stock: 'Low Stock', count: 6 },
    { id: 'SKU-PRD-04', name: 'Casual Cotton Chino Trousers', category: "Men's Apparel", subCategory: 'Jeans & Trousers', color: 'Beige / Cream', size: 'XL', price: 1999.00, stock: 'In Stock', count: 30 },
    { id: 'SKU-PRD-05', name: 'Kids Organic Cotton T-Shirt Set', category: 'Kidswear & Toddlers', subCategory: 'Infant Onesies', color: 'White', size: 'S', price: 999.00, stock: 'In Stock', count: 65 },
    { id: 'SKU-PRD-06', name: 'Handwoven Banarasi Silk Saree', category: "Women's Fashion", subCategory: 'Sarees & Kurtis', color: 'Wine Maroon', size: 'Free Size', price: 6800.00, stock: 'In Stock', count: 12 },
    { id: 'SKU-PRD-07', name: 'Merino Wool Knitted Cardigan', category: 'Winterwear & Outerwear', subCategory: 'Sweaters & Cardigans', color: 'Grey / Charcoal', size: 'M', price: 2299.00, stock: 'Low Stock', count: 4 },
    { id: 'SKU-PRD-08', name: 'Pure Linen Button-Down Formal Shirt', category: "Men's Apparel", subCategory: 'Shirts', color: 'White', size: 'L', price: 1899.00, stock: 'In Stock', count: 50 },
    { id: 'SKU-PRD-09', name: 'Slim-Fit Stretch Denim Jeans', category: "Men's Apparel", subCategory: 'Jeans & Trousers', color: 'Black', size: 'XL', price: 2199.00, stock: 'In Stock', count: 28 },
    { id: 'SKU-PRD-10', name: 'Embroidered Anarkali Kurti Set', category: "Women's Fashion", subCategory: 'Sarees & Kurtis', color: 'Red', size: 'M', price: 3499.00, stock: 'In Stock', count: 18 },
    { id: 'SKU-PRD-11', name: 'Wool Blend Tailored Winter Coat', category: 'Winterwear & Outerwear', subCategory: 'Jackets & Coats', color: 'Black', size: 'XXL', price: 4999.00, stock: 'Low Stock', count: 8 },
    { id: 'SKU-PRD-12', name: 'Toddler Denim Overalls & Polo Combo', category: 'Kidswear & Toddlers', subCategory: 'Boys Casuals', color: 'Olive Green', size: 'S', price: 1499.00, stock: 'In Stock', count: 35 },
    { id: 'SKU-PRD-13', name: 'Shorts', category: "Men's Apparel", subCategory: 'Shorts', color: 'Sky Blue', size: 'XL', price: 599.00, stock: 'In Stock', count: 50 },
    { id: 'SKU-PRD-14', name: 'trouser', category: "Men's Apparel", subCategory: 'Jeans & Trousers', color: 'Yellow / Mustard', size: 'L', price: 2999.00, stock: 'In Stock', count: 50 },
    { id: 'SKU-PRD-15', name: 'Classic premium Lenin Black Shirt', category: "Men's Apparel", subCategory: 'Shirts', color: 'Multicolor', size: 'M', price: 2999.00, stock: 'In Stock', count: 50 }
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
async function removeDuplicateDatabaseDocuments() {
  try {
    // 1. Deduplicate Categories in MongoDB
    const allCats = await Category.find().exec();
    if (allCats.length > 0) {
      const catMap = new Map();
      const catIdsToDelete = [];

      for (const doc of allCats) {
        const key = (doc.name || '').trim().toLowerCase();
        if (!key) {
          catIdsToDelete.push(doc._id);
          continue;
        }
        if (!catMap.has(key)) {
          catMap.set(key, doc);
        } else {
          const keeper = catMap.get(key);
          const existingSubs = Array.isArray(keeper.subCategories) ? keeper.subCategories : [];
          const newSubs = Array.isArray(doc.subCategories) ? doc.subCategories : [];
          keeper.subCategories = Array.from(new Set([...existingSubs, ...newSubs]));
          await Category.updateOne({ _id: keeper._id }, { $set: { subCategories: keeper.subCategories } });
          catIdsToDelete.push(doc._id);
        }
      }

      if (catIdsToDelete.length > 0) {
        console.log(`[Database Cleanup] Removing ${catIdsToDelete.length} duplicate category documents from MongoDB...`);
        await Category.deleteMany({ _id: { $in: catIdsToDelete } });
      }

      // Ensure all remaining categories have 100% unique CAT-xx IDs
      const remainingCats = await Category.find().exec();
      const seenIds = new Set();
      let maxCatNum = 0;
      remainingCats.forEach(c => {
        const m = (c.id || '').match(/CAT-(\d+)/i);
        if (m) {
          const n = parseInt(m[1], 10);
          if (n > maxCatNum) maxCatNum = n;
        }
      });

      for (const catDoc of remainingCats) {
        if (!catDoc.id || seenIds.has(catDoc.id)) {
          maxCatNum++;
          catDoc.id = 'CAT-' + maxCatNum.toString().padStart(2, '0');
          await catDoc.save();
        } else {
          seenIds.add(catDoc.id);
        }
      }
    }

    // 2. Deduplicate Products in MongoDB
    const allPrds = await Product.find().exec();
    if (allPrds.length > 0) {
      const prdMap = new Map();
      const prdIdsToDelete = [];

      for (const doc of allPrds) {
        const key = (doc.name || '').trim().toLowerCase();
        if (!key) {
          prdIdsToDelete.push(doc._id);
          continue;
        }
        if (!prdMap.has(key)) {
          prdMap.set(key, doc);
        } else {
          prdIdsToDelete.push(doc._id);
        }
      }

      if (prdIdsToDelete.length > 0) {
        console.log(`[Database Cleanup] Removing ${prdIdsToDelete.length} duplicate product documents from MongoDB...`);
        await Product.deleteMany({ _id: { $in: prdIdsToDelete } });
      }
    }

    // 3. Deduplicate Clients in MongoDB
    const allClients = await Client.find().exec();
    if (allClients.length > 0) {
      const clientMap = new Map();
      const clientIdsToDelete = [];

      for (const doc of allClients) {
        const key = (doc.name || doc.id || '').trim().toLowerCase();
        if (!key) {
          clientIdsToDelete.push(doc._id);
          continue;
        }
        if (!clientMap.has(key)) {
          clientMap.set(key, doc);
        } else {
          clientIdsToDelete.push(doc._id);
        }
      }

      if (clientIdsToDelete.length > 0) {
        console.log(`[Database Cleanup] Removing ${clientIdsToDelete.length} duplicate client documents from MongoDB...`);
        await Client.deleteMany({ _id: { $in: clientIdsToDelete } });
      }
    }
  } catch (err) {
    console.warn('removeDuplicateDatabaseDocuments error:', err.message);
  }
}

async function seedInitialDataIfNeeded() {
  if (isSeedingPromise) return isSeedingPromise;

  isSeedingPromise = (async () => {
    try {
      // 1. Purge bloated category collection if duplicates exist (> 10 documents)
      const currentCatCount = await Category.countDocuments();
      if (currentCatCount > 10) {
        console.log(`[Database Purge] Wiping ${currentCatCount} duplicate categories from MongoDB...`);
        await Category.deleteMany({});
      }

      const invoiceCount = await Invoice.countDocuments();
      if (invoiceCount === 0) {
        await Invoice.insertMany(initialData.invoices);
      }

      const billCount = await Bill.countDocuments();
      if (billCount === 0) {
        await Bill.insertMany(initialData.bills);
      }

      for (const client of initialData.clients) {
        await Client.updateOne(
          { id: client.id },
          { $setOnInsert: client },
          { upsert: true }
        );
      }

      const categoryCount = await Category.countDocuments();
      if (categoryCount === 0) {
        await Category.insertMany(initialData.categories);
      }

      for (const prd of initialData.products) {
        await Product.updateOne(
          { id: prd.id },
          { $setOnInsert: prd },
          { upsert: true }
        );
      }

      await removeDuplicateDatabaseDocuments();
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
    const d = invoiceData.issueDate ? new Date(invoiceData.issueDate) : (invoiceData.dueDate ? new Date(invoiceData.dueDate) : new Date());
    const year = d.getFullYear();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const dateMerged = `${year}${month}${day}`;
    const seq = String(count + 1).padStart(3, '0');
    const customId = invoiceData.id || `INV-${dateMerged}-${seq}`;
    const clientName = (invoiceData.clientName || 'Walk-in Retail Customer').trim();
    const amount = parseFloat(invoiceData.amount) || 0;
    const dateStr = `${year}-${month}-${day}`;

    let existingInv = await Invoice.findOne({ id: { $regex: new RegExp(`^${customId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }).exec();
    if (existingInv) {
      existingInv.clientName = clientName;
      existingInv.amount = amount;
      if (invoiceData.category) existingInv.category = invoiceData.category;
      if (invoiceData.paymentMode) existingInv.paymentMode = invoiceData.paymentMode;
      if (invoiceData.status) existingInv.status = invoiceData.status;
      return await existingInv.save();
    }

    const newInvoice = new Invoice({
      id: customId,
      clientId: invoiceData.clientId || `CUST-${dateMerged}001`,
      clientName: clientName,
      clientEmail: invoiceData.clientEmail || 'billing@client.com',
      issueDate: dateStr,
      dueDate: invoiceData.dueDate || dateStr,
      amount: amount,
      status: invoiceData.status || 'Paid',
      category: invoiceData.category || 'General Service',
      paymentMode: invoiceData.paymentMode || 'Cash'
    });

    const savedInvoice = await newInvoice.save();

    // Auto-create or update Client record in MongoDB
    try {
      let client = await Client.findOne({ name: { $regex: new RegExp(`^${clientName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }).exec();
      if (!client) {
        const clientCount = await Client.countDocuments();
        const custSeq = String(clientCount + 1).padStart(2, '0');
        client = new Client({
          id: `CUST-${dateMerged}${String(custSeq).padStart(3, '0')}`,
          name: clientName,
          email: invoiceData.clientEmail || 'orders@client.com',
          phone: '+91 98765 43210',
          totalBilled: amount,
          status: 'Active'
        });
        await client.save();
      } else {
        client.totalBilled = (Number(client.totalBilled) || 0) + amount;
        await client.save();
      }
    } catch (err) {
      console.warn('Auto-client creation error:', err);
    }

    return savedInvoice;
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
    const customId = billData.id || ('BILL-' + (100 + count + 1));
    let existingBill = await Bill.findOne({ id: { $regex: new RegExp(`^${customId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }).exec();
    if (existingBill) {
      if (billData.vendor) existingBill.vendor = billData.vendor;
      if (billData.category) existingBill.category = billData.category;
      if (billData.dueDate) existingBill.dueDate = billData.dueDate;
      if (billData.amount !== undefined) existingBill.amount = parseFloat(billData.amount) || 0;
      if (billData.status) existingBill.status = billData.status;
      if (billData.autoPay !== undefined) existingBill.autoPay = !!billData.autoPay;
      return await existingBill.save();
    }

    const newBill = new Bill({
      id: customId,
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
    if (!clients.length) {
      try {
        await Client.insertMany(initialData.clients);
        clients = await Client.find().lean().exec();
      } catch (err) {
        clients = initialData.clients;
      }
    }
    return (clients || []).map((c, idx) => ({
      ...c,
      id: c.id ? c.id.replace(/^CLT-/i, 'CUST-') : `CUST-0${idx + 1}`
    }));
  },

  createClient: async (clientData) => {
    let customId = clientData.id ? clientData.id.trim() : '';
    const cleanName = (clientData.name || 'New Customer').trim();

    let existing = null;
    if (customId) {
      existing = await Client.findOne({ id: { $regex: new RegExp(`^${customId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }).exec();
    }
    if (!existing) {
      existing = await Client.findOne({ name: { $regex: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }).exec();
    }

    if (existing) {
      existing.name = cleanName;
      if (clientData.contact) existing.contact = clientData.contact;
      if (clientData.status) existing.status = clientData.status;
      if (clientData.totalBilled !== undefined) existing.totalBilled = parseFloat(clientData.totalBilled) || 0;
      return await existing.save();
    }

    if (!customId) {
      const todayStr = new Date().toISOString().split('T')[0];
      const allClients = await Client.find().lean().exec();
      let maxNum = 0;
      (allClients || []).forEach(c => {
        const match = c.id && c.id.match(/^CUST-.*-(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      });
      customId = `CUST-${todayStr.replace(/-/g, '')}${(maxNum + 1).toString().padStart(3, '0')}`;
    }

    const newClient = new Client({
      id: customId,
      name: cleanName,
      contact: clientData.contact || 'contact@client.com',
      status: clientData.status || 'Active',
      totalBilled: parseFloat(clientData.totalBilled) || 0
    });

    return await newClient.save();
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
    if (!products || !products.length) {
      try {
        await Product.insertMany(initialData.products);
        products = await Product.find().lean().exec();
      } catch (err) {
        products = initialData.products;
      }
    }
    const sorted = [...(products || [])].sort((a, b) => {
      const numA = parseInt((a.id || '').replace(/\D/g, ''), 10) || 99999;
      const numB = parseInt((b.id || '').replace(/\D/g, ''), 10) || 99999;
      return numA - numB;
    });

    return sorted.map((p, idx) => ({
      ...p,
      id: `SKU-PRD-${(idx + 1).toString().padStart(2, '0')}`
    }));
  },

  createProduct: async (productData) => {
    await seedInitialDataIfNeeded();
    const cleanName = (productData.name || '').trim();
    if (!cleanName) return null;

    const countNum = parseInt(productData.count, 10) || 50;
    const priceNum = parseFloat(productData.price) || 0;
    const stockStatus = productData.stock || (countNum > 10 ? 'In Stock' : (countNum > 0 ? 'Low Stock' : 'Out of Stock'));

    const safeRegex = new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    let existingPrd = await Product.findOne({ name: safeRegex }).exec();

    if (existingPrd) {
      existingPrd.name = cleanName;
      existingPrd.category = productData.category || existingPrd.category || "Men's Apparel";
      existingPrd.subCategory = productData.subCategory || existingPrd.subCategory || '';
      existingPrd.color = productData.color || existingPrd.color || '';
      existingPrd.size = productData.size || existingPrd.size || '';
      existingPrd.price = priceNum;
      existingPrd.count = countNum;
      existingPrd.stock = stockStatus;
      return await existingPrd.save();
    } else {
      const allProducts = await Product.find().lean().exec();
      let maxNum = 0;
      allProducts.forEach(p => {
        const match = (p.id || '').match(/SKU-PRD-(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      });
      const newSkuId = `SKU-PRD-${(maxNum + 1).toString().padStart(2, '0')}`;

      const newPrd = new Product({
        id: newSkuId,
        name: cleanName,
        category: productData.category || "Men's Apparel",
        subCategory: productData.subCategory || '',
        color: productData.color || '',
        size: productData.size || '',
        price: priceNum,
        count: countNum,
        stock: stockStatus
      });

      return await newPrd.save();
    }
  },

  deleteProduct: async (id, name = '') => {
    try {
      await seedInitialDataIfNeeded();
      const queries = [{ id: id }];
      if (name && name.trim()) {
        const safeRegex = new RegExp(`^${name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
        queries.push({ name: safeRegex });
      }
      await Product.deleteMany({ $or: queries }).exec();
      return { success: true };
    } catch (err) {
      console.error('deleteProduct error:', err.message);
      return { success: false, error: err.message };
    }
  },

  updateProduct: async (id, productData) => {
    const priceNum = parseFloat(productData.price) || 0;
    const countNum = parseInt(productData.count, 10) || 0;
    const stockStatus = productData.stock || (countNum > 10 ? 'In Stock' : (countNum > 0 ? 'Low Stock' : 'Out of Stock'));

    let product = await Product.findOneAndUpdate(
      { id: { $regex: new RegExp(`^${id}$`, 'i') } },
      {
        $set: {
          name: productData.name,
          category: productData.category,
          subCategory: productData.subCategory || '',
          color: productData.color || '',
          size: productData.size || '',
          price: priceNum,
          count: countNum,
          stock: stockStatus
        }
      },
      { new: true }
    ).lean().exec();

    if (!product) {
      product = await Product.findByIdAndUpdate(
        id,
        {
          $set: {
            name: productData.name,
            category: productData.category,
            subCategory: productData.subCategory || '',
            color: productData.color || '',
            size: productData.size || '',
            price: priceNum,
            count: countNum,
            stock: stockStatus
          }
        },
        { new: true }
      ).lean().exec();
    }
    return product;
  },

  updateProductStock: async (id, stockData) => {
    const countNum = Math.max(0, parseInt(stockData.count, 10) || 0);
    const stockStatus = stockData.stock || (countNum > 10 ? 'In Stock' : (countNum > 0 ? 'Low Stock' : 'Out of Stock'));
    
    let product = await Product.findOneAndUpdate(
      { id: { $regex: new RegExp(`^${id}$`, 'i') } },
      { $set: { count: countNum, stock: stockStatus } },
      { new: true }
    ).lean().exec();

    if (!product) {
      product = await Product.findByIdAndUpdate(
        id,
        { $set: { count: countNum, stock: stockStatus } },
        { new: true }
      ).lean().exec();
    }
    return product;
  },

  getCategories: async () => {
    await seedInitialDataIfNeeded();
    let categories = await Category.find().lean().exec();
    if (!categories || !categories.length) {
      try {
        await Category.insertMany(initialData.categories);
        categories = await Category.find().lean().exec();
      } catch (err) {
        categories = initialData.categories;
      }
    }

    // Auto-cleanup duplicates from MongoDB
    const uniqueMap = new Map();
    const duplicateIds = [];

    categories.forEach(c => {
      if (c && c.name) {
        const key = c.name.trim().toLowerCase();
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, c);
        } else {
          duplicateIds.push(c._id || c.id);
          const existing = uniqueMap.get(key);
          const existingSubs = Array.isArray(existing.subCategories) ? existing.subCategories : [];
          const newSubs = Array.isArray(c.subCategories) ? c.subCategories : [];
          existing.subCategories = Array.from(new Set([...existingSubs, ...newSubs]));
        }
      }
    });

    if (duplicateIds.length > 0) {
      try {
        await Category.deleteMany({ _id: { $in: duplicateIds } });
      } catch (e) {}
    }

    return Array.from(uniqueMap.values());
  },

  createCategory: async (catData) => {
    const nameClean = (catData.name || '').trim();
    if (!nameClean) return null;

    let subs = [];
    if (Array.isArray(catData.subCategories)) {
      subs = catData.subCategories;
    } else if (typeof catData.subCategories === 'string') {
      subs = catData.subCategories.split(',').map(s => s.trim()).filter(Boolean);
    }

    let existing = await Category.findOne({
      name: { $regex: new RegExp(`^${nameClean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    }).exec();

    if (existing) {
      const existingSubs = Array.isArray(existing.subCategories) ? existing.subCategories : [];
      existing.subCategories = Array.from(new Set([...existingSubs, ...subs]));
      if (catData.description) existing.description = catData.description;
      if (catData.genderType) existing.genderType = catData.genderType;
      if (catData.seasonTag) existing.seasonTag = catData.seasonTag;
      if (catData.status) existing.status = catData.status;
      return await existing.save();
    }

    const allCats = await Category.find().lean().exec();
    let maxNum = 0;
    allCats.forEach(c => {
      const match = (c.id || '').match(/CAT-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });

    const newId = 'CAT-' + (maxNum + 1).toString().padStart(2, '0');

    const newCat = new Category({
      id: newId,
      name: nameClean,
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

  updateCategory: async (id, catData) => {
    const subs = Array.isArray(catData.subCategories)
      ? catData.subCategories
      : (typeof catData.subCategories === 'string'
          ? catData.subCategories.split(',').map(s => s.trim()).filter(Boolean)
          : []);

    const updated = await Category.findOneAndUpdate(
      { id },
      {
        $set: {
          name: catData.name,
          subCategories: subs,
          genderType: catData.genderType || 'Unisex',
          seasonTag: catData.seasonTag || 'All Season',
          status: catData.status || 'Active'
        }
      },
      { new: true }
    ).exec();
    return updated;
  },

  deleteCategory: async (id, name = '') => {
    try {
      await seedInitialDataIfNeeded();
      const queries = [{ id: id }];
      if (name && name.trim()) {
        const safeRegex = new RegExp(`^${name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
        queries.push({ name: safeRegex });
      }
      await Category.deleteMany({ $or: queries }).exec();
      return { success: true };
    } catch (err) {
      console.error('deleteCategory error:', err.message);
      return { success: false, error: err.message };
    }
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
          id: matchInv.clientId || 'CUST-AUTO',
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
  },

  backupAllData: async ({ invoices = [], products = [], categories = [], clients = [], bills = [] }) => {
    let syncedInvoices = 0;
    let syncedProducts = 0;
    let syncedCategories = 0;
    let syncedClients = 0;
    let syncedBills = 0;

    // 1. Save Invoices to MongoDB
    if (Array.isArray(invoices)) {
      for (const inv of invoices) {
        try {
          if (inv && (inv.clientName || inv.amount)) {
            await dataStore.createInvoice(inv);
            syncedInvoices++;
          }
        } catch (e) {
          console.warn('Backup invoice sync warning:', e.message);
        }
      }
    }

    // 2. Save Products to MongoDB
    if (Array.isArray(products)) {
      for (const prd of products) {
        try {
          if (prd && prd.name) {
            await dataStore.createProduct(prd);
            syncedProducts++;
          }
        } catch (e) {
          console.warn('Backup product sync warning:', e.message);
        }
      }
    }

    // 3. Save Categories to MongoDB
    if (Array.isArray(categories)) {
      for (const cat of categories) {
        try {
          if (cat && cat.name) {
            await dataStore.createCategory(cat);
            syncedCategories++;
          }
        } catch (e) {
          console.warn('Backup category sync warning:', e.message);
        }
      }
    }

    // 4. Save Clients to MongoDB
    if (Array.isArray(clients)) {
      for (const cl of clients) {
        try {
          if (cl && cl.name) {
            await dataStore.createClient(cl);
            syncedClients++;
          }
        } catch (e) {
          console.warn('Backup client sync warning:', e.message);
        }
      }
    }

    // 5. Save Bills to MongoDB
    if (Array.isArray(bills)) {
      for (const b of bills) {
        try {
          if (b && (b.vendor || b.amount)) {
            await dataStore.createBill(b);
            syncedBills++;
          }
        } catch (e) {
          console.warn('Backup bill sync warning:', e.message);
        }
      }
    }

    return {
      syncedInvoices,
      syncedProducts,
      syncedCategories,
      syncedClients,
      syncedBills,
      totalCount: syncedInvoices + syncedProducts + syncedCategories + syncedClients + syncedBills
    };
  }
};

module.exports = dataStore;
