const mongoose = require('mongoose');
const dns = require('dns');
const Invoice = require('../models/Invoice');
const Bill = require('../models/Bill');
const Client = require('../models/Client');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Brand = require('../models/Brand');
const Supplier = require('../models/Supplier');
const Sale = require('../models/Sale');
const InventoryLog = require('../models/InventoryLog');
const sqliteStore = require('./sqliteStore');
const syncEngine = require('../services/syncEngine');

let lastOnlineCheckTime = 0;
let lastOnlineCheckStatus = false;

async function checkMongoOnlineFast() {
  const now = Date.now();
  if (now - lastOnlineCheckTime < 2500) {
    return lastOnlineCheckStatus;
  }
  lastOnlineCheckTime = now;

  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    lastOnlineCheckStatus = false;
    return false;
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      lastOnlineCheckStatus = false;
      resolve(false);
    }, 350);

    dns.lookup('ac-73qhkjq-shard-00-00.qdjwbzw.mongodb.net', (err) => {
      clearTimeout(timer);
      if (err) {
        lastOnlineCheckStatus = false;
        resolve(false);
      } else {
        lastOnlineCheckStatus = true;
        resolve(true);
      }
    });
  });
}


const initialData = {
  invoices: [],
  bills: [],
  clients: [],
  products: [],
  categories: []
};

let isSeedingPromise = null;

// Migrate unscoped documents (userId = null) to a specific user on first login
async function migrateUnscopedDataToUser(userId) {
  if (!userId || userId === 'usr_default') return;
  try {
    const filter = { $or: [{ userId: null }, { userId: { $exists: false } }] };
    await Promise.all([
      Product.updateMany(filter, { $set: { userId } }),
      Invoice.updateMany(filter, { $set: { userId } }),
      Bill.updateMany(filter, { $set: { userId } }),
      Category.updateMany(filter, { $set: { userId } }),
      Client.updateMany(filter, { $set: { userId } })
    ]);
  } catch (err) {
    console.warn('[Migration] migrateUnscopedDataToUser error:', err.message);
  }
}

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

let hasCompletedInitialSeed = false;
const migratedUsers = new Set();

async function seedInitialDataIfNeeded(userId = null) {
  return Promise.resolve();
}

const dataStore = {
  seedInitialDataIfNeeded,

  getInvoices: async (userId) => {
    let mongoList = [];
    const isOnline = await checkMongoOnlineFast();
    if (isOnline) {
      try {
        await seedInitialDataIfNeeded(userId);
        const filter = userId ? { userId } : {};
        let invoices = await Invoice.find(filter).sort({ createdAt: -1 }).lean().exec();

        const uniqueMap = new Map();
        const duplicateIds = [];

        (invoices || []).forEach(inv => {
          if (inv && inv.id) {
            const key = String(inv.id).replace(/-/g, '').toLowerCase().trim();
            if (!uniqueMap.has(key)) {
              uniqueMap.set(key, inv);
            } else {
              duplicateIds.push(inv._id);
            }
          }
        });

        if (duplicateIds.length > 0) {
          try {
            await Invoice.deleteMany({ _id: { $in: duplicateIds } });
          } catch (e) {}
        }
        mongoList = Array.from(uniqueMap.values());
      } catch (e) {
        console.warn('MongoDB getInvoices notice:', e.message);
      }
    }

    let localList = [];
    try { localList = await sqliteStore.getInvoices() || []; } catch (e) {}

    const invMap = new Map();
    (mongoList || []).forEach(inv => {
      if (inv && inv.id) {
        const key = String(inv.id).replace(/-/g, '').toLowerCase().trim();
        invMap.set(key, { ...inv });
        try { sqliteStore.createInvoice(inv); } catch (e) {}
      }
    });

    (localList || []).forEach(inv => {
      if (inv && inv.id) {
        const key = String(inv.id).replace(/-/g, '').toLowerCase().trim();
        if (!invMap.has(key)) {
          invMap.set(key, { ...inv });
        } else {
          invMap.set(key, { ...invMap.get(key), ...inv });
        }
      }
    });

    return Array.from(invMap.values());
  },

  createInvoice: async (invoiceData, userId = null) => {
    // 1. Save to local SQLite database & enqueue sync item
    let sqliteResult = null;
    try {
      sqliteResult = await sqliteStore.createInvoice(invoiceData);
    } catch (e) {
      console.warn('SQLite createInvoice warning:', e.message);
    }

    // 2. Save directly to MongoDB Atlas ONLY if connected
    let mongoResult = null;
    const isOnline = await checkMongoOnlineFast();
    if (isOnline) {
      try {
        const d = invoiceData.issueDate ? new Date(invoiceData.issueDate) : (invoiceData.dueDate ? new Date(invoiceData.dueDate) : new Date());
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateMerged = `${year}${month}${day}`;
        const customId = invoiceData.id || `INV-${dateMerged}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

        const clientName = (invoiceData.clientName || 'Walk-in Retail Customer').trim();
        const amount = parseFloat(invoiceData.amount) || 0;
        const dateStr = `${year}-${month}-${day}`;

        const invFields = {
          id: customId,
          userId: userId || null,
          clientId: invoiceData.clientId || `CUST-${dateMerged}001`,
          clientName: clientName,
          clientEmail: invoiceData.clientEmail || 'billing@client.com',
          issueDate: invoiceData.issueDate || dateStr,
          dueDate: invoiceData.dueDate || dateStr,
          amount: amount,
          subtotal: parseFloat(invoiceData.subtotal) || amount,
          tax: parseFloat(invoiceData.tax) || 0,
          discount: parseFloat(invoiceData.discount) || 0,
          status: invoiceData.status || 'Paid',
          category: invoiceData.category || 'General Service',
          paymentMode: invoiceData.paymentMode || 'Cash',
          items: Array.isArray(invoiceData.items) ? invoiceData.items : [],
          notes: invoiceData.notes || ''
        };

        mongoResult = await Invoice.findOneAndUpdate(
          { id: customId },
          { $set: invFields },
          { upsert: true, new: true, runValidators: false }
        ).exec();
      } catch (err) {
        console.warn('MongoDB invoice save notice:', err.message);
      }
    }

    if (isOnline) {
      try { syncEngine.runSyncCycle(); } catch (e) {}
    }

    const finalInv = mongoResult ? (mongoResult.toObject ? mongoResult.toObject() : mongoResult) : (sqliteResult || invoiceData);
    return finalInv;
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

  getBills: async (userId) => {
    let mongoList = [];
    const isOnline = await checkMongoOnlineFast();
    if (isOnline) {
      try {
        await seedInitialDataIfNeeded(userId);
        const filter = userId ? { userId } : {};
        let bills = await Bill.find(filter).sort({ createdAt: -1 }).lean().exec();
        mongoList = bills || [];
      } catch (e) {
        console.warn('MongoDB getBills notice:', e.message);
      }
    }
    try {
      const localBills = await sqliteStore.getBills();
      if (Array.isArray(localBills) && localBills.length > 0) {
        return localBills;
      }
    } catch (e) {}
    return [];
  },

  createBill: async (billData, userId = null) => {
    // 1. Save to local SQLite database first
    let sqliteResult = null;
    try {
      sqliteResult = await sqliteStore.createBill(billData);
    } catch (e) {
      console.warn('SQLite createBill warning:', e.message);
    }

    // 2. Save directly to MongoDB Atlas ONLY if connected
    let mongoResult = null;
    const isOnline = await checkMongoOnlineFast();
    if (isOnline) {
      try {
        const customId = billData.id || (sqliteResult ? sqliteResult.id : `BILL-${Date.now().toString().slice(-6)}`);
        const billFields = {
          id: customId,
          userId: userId || null,
          vendor: billData.vendor,
          category: billData.category || 'General Expenses',
          dueDate: billData.dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
          amount: parseFloat(billData.amount) || 0,
          status: billData.status || 'Unpaid',
          autoPay: !!billData.autoPay
        };

        let existingBill = await Bill.findOne({ id: customId }).exec();
        if (existingBill) {
          Object.assign(existingBill, billFields);
          mongoResult = await existingBill.save();
        } else {
          mongoResult = await Bill.findOneAndUpdate(
            { id: customId },
            { $set: billFields },
            { upsert: true, new: true, runValidators: false }
          ).exec();
        }
      } catch (err) {
        console.warn('MongoDB bill save notice:', err.message);
      }
    }

    if (isOnline) {
      try { syncEngine.runSyncCycle(); } catch (e) {}
    }

    const finalBill = mongoResult ? (mongoResult.toObject ? mongoResult.toObject() : mongoResult) : (sqliteResult || billData);
    return finalBill;
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

  getClients: async (companyId = null) => {
    let mongoList = [];
    const isOnline = await checkMongoOnlineFast();
    if (isOnline) {
      try {
        const filter = companyId ? { $or: [{ companyId }, { userId: companyId }] } : {};
        let clients = await Client.find(filter).sort({ createdAt: -1 }).lean().exec();
        mongoList = clients || [];
      } catch (e) {
        console.warn('MongoDB getClients notice:', e.message);
      }
    }
    try {
      const localClients = await sqliteStore.getClients();
      if (Array.isArray(localClients) && localClients.length > 0) {
        return localClients;
      }
    } catch (e) {}
    return [];
  },



  createClient: async (clientData, userId = null) => {
    // 1. Save to local SQLite database & enqueue sync item
    let sqliteResult = null;
    try {
      sqliteResult = await sqliteStore.createClient(clientData);
    } catch (e) {
      console.warn('SQLite createClient warning:', e.message);
    }

    // 2. Save directly to MongoDB Atlas ONLY if connected
    let mongoResult = null;
    const isOnline = await checkMongoOnlineFast();
    if (isOnline) {
      try {
        let customId = clientData.id ? clientData.id.trim() : (sqliteResult ? sqliteResult.id : `CUST-${Date.now().toString().slice(-6)}`);
        const cleanName = (clientData.name || 'New Customer').trim();
        const cid = clientData.companyId || (userId ? `shop_${userId}` : 'shop_default');

        const clientFields = {
          id: customId,
          companyId: cid,
          userId: userId || null,
          name: cleanName,
          contact: clientData.contact || 'contact@client.com',
          status: clientData.status || 'Active',
          totalBilled: parseFloat(clientData.totalBilled) || 0
        };

        let existing = await Client.findOne({
          $or: [
            { id: customId },
            { name: { $regex: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }
          ]
        }).exec();

        if (existing) {
          Object.assign(existing, clientFields);
          mongoResult = await existing.save();
        } else {
          mongoResult = await Client.findOneAndUpdate(
            { id: customId },
            { $set: clientFields },
            { upsert: true, new: true, runValidators: false }
          ).exec();
        }
      } catch (err) {
        console.warn('MongoDB client save notice:', err.message);
      }
    }

    if (isOnline) {
      try { syncEngine.runSyncCycle(); } catch (e) {}
    }

    const finalClient = mongoResult ? (mongoResult.toObject ? mongoResult.toObject() : mongoResult) : (sqliteResult || clientData);
    return finalClient;
  },


  toggleClientStatus: async (id) => {
    const client = await Client.findOne({ id }).exec();
    if (!client) return null;
    if (client.status === 'Active') client.status = 'Notice';
    else if (client.status === 'Notice') client.status = 'Inactive';
    else client.status = 'Active';
    return await client.save();
  },

  getProducts: async (userId = null, companyId = null) => {
    let mongoList = [];
    const isOnline = await checkMongoOnlineFast();
    if (isOnline) {
      try {
        mongoList = await Product.find({}).lean().exec() || [];
      } catch (e) {
        console.warn('MongoDB getProducts notice:', e.message);
      }
    }

    const prdMap = new Map();

    (mongoList || []).forEach(p => {
      if (p && (p.id || p.name)) {
        const idKey = String(p.id || p._id || '').trim().toLowerCase();
        if (idKey) prdMap.set(idKey, { ...p });
      }
    });

    return Array.from(prdMap.values());
  },

  createProduct: async (productData, userId = null) => {
    const companyId = productData.companyId || (userId ? `shop_${userId}` : 'shop_default');

    let mongoResult = null;
    const isOnline = await checkMongoOnlineFast();
    if (isOnline) {
      try {
        const cleanName = (productData.name || '').trim();
        if (cleanName) {
          const countNum = parseInt(productData.count, 10) || 50;
          const priceNum = parseFloat(productData.price) || 0;
          const stockStatus = productData.stock || (countNum > 10 ? 'In Stock' : (countNum > 0 ? 'Low Stock' : 'Out of Stock'));
          const safeRegexName = new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
          const customId = productData.id || `PRD-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

          const productFields = {
            id: customId,
            name: cleanName,
            category: productData.category || "Men's Apparel",
            subCategory: productData.subCategory || '',
            color: productData.color || '',
            size: productData.size || '',
            price: priceNum,
            count: countNum,
            stock: stockStatus,
            companyId,
            userId: userId || null
          };

          let existingPrd = await Product.findOne({
            $or: [
              { id: { $regex: new RegExp(`^${customId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
              { name: safeRegexName }
            ]
          }).exec();

          if (existingPrd) {
            Object.assign(existingPrd, productFields);
            mongoResult = await existingPrd.save();
          } else {
            mongoResult = await Product.findOneAndUpdate(
              { id: customId },
              { $set: productFields },
              { upsert: true, new: true, runValidators: false }
            ).exec();
          }
        }
      } catch (err) {
        console.warn('MongoDB product save notice:', err.message);
      }
    }

    const finalPrd = mongoResult ? (mongoResult.toObject ? mongoResult.toObject() : mongoResult) : { id: productData.id || `PRD-${Date.now()}`, ...productData };
    return finalPrd;
  },

  getProductById: async (id, companyId = null) => {
    if (!id) return null;
    const filter = companyId ? { id, companyId } : { id };
    return await Product.findOne(filter).exec();
  },


  deleteProduct: async (id, name = '', userId = null) => {
    try {
      await seedInitialDataIfNeeded(userId);
      const filter = userId ? { userId } : {};
      const queries = [];
      const idStr = id ? String(id).trim() : '';
      const nameStr = name ? String(name).trim() : '';

      if (idStr) {
        queries.push({ ...filter, id: { $regex: new RegExp(`^${idStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
        if (mongoose.Types.ObjectId.isValid(idStr)) {
          queries.push({ ...filter, _id: idStr });
        }
      }
      if (nameStr) {
        queries.push({ ...filter, name: { $regex: new RegExp(`^${nameStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
      }
      if (queries.length > 0) {
        await Product.deleteMany({ $or: queries }).exec();
      }
      return { success: true };
    } catch (err) {
      console.error('deleteProduct error:', err.message);
      return { success: false, error: err.message };
    }
  },

  updateProduct: async (id, productData, userId = null) => {
    await seedInitialDataIfNeeded(userId);
    const filter = userId ? { userId } : {};
    const priceNum = parseFloat(productData.price) || 0;
    const countNum = parseInt(productData.count, 10) || 0;
    const stockStatus = productData.stock || (countNum > 10 ? 'In Stock' : (countNum > 0 ? 'Low Stock' : 'Out of Stock'));
    const cleanName = (productData.name || '').trim();

    const safeRegexName = cleanName ? new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') : null;
    const safeRegexId = id ? new RegExp(`^${String(id).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') : null;

    let existingPrd = null;
    if (safeRegexId) {
      existingPrd = await Product.findOne({ ...filter, id: safeRegexId }).exec();
    }
    if (!existingPrd && safeRegexName) {
      existingPrd = await Product.findOne({ ...filter, name: safeRegexName }).exec();
    }

    if (existingPrd) {
      if (cleanName) existingPrd.name = cleanName;
      if (productData.category) existingPrd.category = productData.category;
      if (productData.subCategory !== undefined) existingPrd.subCategory = productData.subCategory;
      if (productData.color !== undefined) existingPrd.color = productData.color;
      if (productData.size !== undefined) existingPrd.size = productData.size;
      existingPrd.price = priceNum;
      existingPrd.count = countNum;
      existingPrd.stock = stockStatus;
      return await existingPrd.save();
    } else {
      return await dataStore.createProduct({ id, ...productData }, userId);
    }
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

  cleanupDuplicateCategories: async (userId = null) => {
    try {
      const SEED_CAT_NAMES = [
        "men's apparel", "women's fashion", "kidswear & toddlers",
        "footwear & shoes", "fashion accessories", "winterwear & outerwear"
      ];
      // Delete legacy seed category documents
      await Category.deleteMany({
        $or: [
          { name: { $in: SEED_CAT_NAMES.map(n => new RegExp(`^${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')) } },
          { id: { $in: ['CAT-01', 'CAT-02', 'CAT-03', 'CAT-04', 'CAT-05', 'CAT-06', 'CAT-07', 'CAT-08'] } }
        ]
      });

      const filter = userId ? { userId } : {};
      const allCategories = await Category.find(filter).exec();
      const seenNames = new Map();
      const idsToDelete = [];

      for (const cat of allCategories) {
        if (!cat.name) continue;
        const key = cat.name.trim().toLowerCase();
        if (seenNames.has(key)) {
          const master = seenNames.get(key);
          const masterSubs = Array.isArray(master.subCategories) ? master.subCategories : [];
          const catSubs = Array.isArray(cat.subCategories) ? cat.subCategories : [];
          master.subCategories = Array.from(new Set([...masterSubs, ...catSubs]));
          await master.save();
          idsToDelete.push(cat._id);
        } else {
          seenNames.set(key, cat);
        }
      }

      if (idsToDelete.length > 0) {
        await Category.deleteMany({ _id: { $in: idsToDelete } });
      }
    } catch (err) {
      console.warn('Error purging duplicate categories:', err.message);
    }
  },

  getCategories: async (userId = null) => {
    let mongoList = [];
    const isOnline = await checkMongoOnlineFast();
    if (isOnline) {
      try {
        await dataStore.cleanupDuplicateCategories(userId);
        const filter = userId ? { userId } : {};
        mongoList = await Category.find(filter).lean().exec() || [];
      } catch (e) {
        console.warn('MongoDB getCategories notice:', e.message);
      }
    }

    const catMap = new Map();
    (mongoList || []).forEach(c => {
      if (c && c.name) {
        const key = c.name.trim().toLowerCase();
        if (catMap.has(key)) {
          const existing = catMap.get(key);
          const existingSubs = Array.isArray(existing.subCategories) ? existing.subCategories : [];
          const newSubs = Array.isArray(c.subCategories) ? c.subCategories : [];
          catMap.set(key, { ...existing, ...c, subCategories: Array.from(new Set([...existingSubs, ...newSubs])) });
        } else {
          catMap.set(key, { ...c });
        }
      }
    });

    return Array.from(catMap.values());
  },

  createCategory: async (catData, userId = null) => {
    const nameClean = (catData.name || '').trim();
    if (!nameClean) return null;

    let subs = [];
    if (Array.isArray(catData.subCategories)) {
      subs = catData.subCategories;
    } else if (typeof catData.subCategories === 'string') {
      subs = catData.subCategories.split(',').map(s => s.trim()).filter(Boolean);
    }

    let mongoResult = null;
    const isOnline = await checkMongoOnlineFast();
    if (isOnline) {
      try {
        const targetId = catData.id || `CAT-${Date.now().toString().slice(-6)}`;
        const catFields = {
          id: targetId,
          companyId: catData.companyId || 'shop_default',
          userId: userId || null,
          name: nameClean,
          description: catData.description || '',
          subCategories: subs,
          genderType: catData.genderType || 'Unisex',
          seasonTag: catData.seasonTag || 'All Season',
          itemCounts: parseInt(catData.itemCounts, 10) || 0,
          status: catData.status || 'Active'
        };

        let existing = await Category.findOne({
          $or: [
            { id: targetId },
            { name: { $regex: new RegExp(`^${nameClean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }
          ]
        }).exec();

        if (existing) {
          const existingSubs = Array.isArray(existing.subCategories) ? existing.subCategories : [];
          existing.name = nameClean;
          existing.subCategories = Array.from(new Set([...existingSubs, ...subs]));
          if (catData.description) existing.description = catData.description;
          if (catData.genderType) existing.genderType = catData.genderType;
          if (catData.seasonTag) existing.seasonTag = catData.seasonTag;
          if (catData.status) existing.status = catData.status;
          mongoResult = await existing.save();
        } else {
          mongoResult = await Category.findOneAndUpdate(
            { id: targetId },
            { $set: catFields },
            { upsert: true, new: true, runValidators: false }
          ).exec();
        }
      } catch (err) {
        console.warn('MongoDB category save notice:', err.message);
      }
    }

    const finalCat = mongoResult ? (mongoResult.toObject ? mongoResult.toObject() : mongoResult) : { id: catData.id || `CAT-${Date.now()}`, ...catData, name: nameClean, subCategories: subs };
    return finalCat;
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
      const queries = [];
      const idStr = id ? String(id).trim() : '';
      const nameStr = name ? String(name).trim() : '';

      if (idStr) {
        queries.push({ id: { $regex: new RegExp(`^${idStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
        if (mongoose.Types.ObjectId.isValid(idStr)) {
          queries.push({ _id: idStr });
        }
      }
      if (nameStr) {
        queries.push({ name: { $regex: new RegExp(`^${nameStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
      }
      if (queries.length > 0) {
        await Category.deleteMany({ $or: queries }).exec();
      }
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

  getClientRelatedData: async (clientId, userId = null) => {
    const filter = userId ? { userId } : {};
    let clients = await Client.find(filter).lean().exec();
    const invoices = await Invoice.find(filter).lean().exec();

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

  getCategoryRelatedData: async (categoryIdOrName, userId = null) => {
    const filter = userId ? { userId } : {};
    const categories = await Category.find(filter).lean().exec();
    const products = await Product.find(filter).lean().exec();
    const invoices = await Invoice.find(filter).lean().exec();

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

  getRelationalSummary: async (userId = null) => {
    const filter = userId ? { userId } : {};
    const clients = await Client.find(filter).lean().exec();
    const invoices = await Invoice.find(filter).lean().exec();
    const products = await Product.find(filter).lean().exec();
    const categories = await Category.find(filter).lean().exec();
    const bills = await Bill.find(filter).lean().exec();

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

  backupAllData: async ({ invoices = [], products = [], categories = [], clients = [], bills = [] }, userId = null) => {
    let syncedInvoices = 0;
    let syncedProducts = 0;
    let syncedCategories = 0;
    let syncedClients = 0;
    let syncedBills = 0;

    // 1. Sync Active Products to MongoDB Atlas
    if (Array.isArray(products)) {
      const activePrdIds = new Set(products.map(p => String(p.id || p.name || '').toLowerCase().trim()));
      for (const prd of products) {
        try {
          if (prd && prd.name) {
            await dataStore.createProduct(prd, userId);
            syncedProducts++;
          }
        } catch (e) {
          console.warn('Backup product sync warning:', e.message);
        }
      }
      if (mongoose.connection && mongoose.connection.readyState === 1 && products.length > 0) {
        try {
          const dbProducts = await Product.find({}).lean().exec();
          for (const dbP of dbProducts) {
            const keyId = String(dbP.id || '').toLowerCase().trim();
            const keyName = String(dbP.name || '').toLowerCase().trim();
            if (!activePrdIds.has(keyId) && !activePrdIds.has(keyName)) {
              await Product.deleteOne({ _id: dbP._id }).exec();
            }
          }
        } catch (e) {}
      }
    }

    // 2. Sync Active Categories to MongoDB Atlas
    if (Array.isArray(categories)) {
      const activeCatNames = new Set(categories.map(c => String(c.name || '').toLowerCase().trim()));
      for (const cat of categories) {
        try {
          if (cat && cat.name) {
            await dataStore.createCategory(cat, userId);
            syncedCategories++;
          }
        } catch (e) {
          console.warn('Backup category sync warning:', e.message);
        }
      }
      if (mongoose.connection && mongoose.connection.readyState === 1 && categories.length > 0) {
        try {
          const dbCategories = await Category.find({}).lean().exec();
          for (const dbC of dbCategories) {
            const keyName = String(dbC.name || '').toLowerCase().trim();
            if (!activeCatNames.has(keyName)) {
              await Category.deleteOne({ _id: dbC._id }).exec();
            }
          }
        } catch (e) {}
      }
    }

    // 3. Save Invoices to MongoDB Atlas
    if (Array.isArray(invoices)) {
      for (const inv of invoices) {
        try {
          if (inv && (inv.clientName || inv.amount || inv.id)) {
            await dataStore.createInvoice(inv, userId);
            syncedInvoices++;
          }
        } catch (e) {
          console.warn('Backup invoice sync warning:', e.message);
        }
      }
    }

    // 4. Save Clients to MongoDB Atlas
    if (Array.isArray(clients)) {
      for (const cl of clients) {
        try {
          if (cl && cl.name) {
            await dataStore.createClient(cl, userId);
            syncedClients++;
          }
        } catch (e) {
          console.warn('Backup client sync warning:', e.message);
        }
      }
    }

    // 5. Save Bills to MongoDB Atlas
    if (Array.isArray(bills)) {
      for (const b of bills) {
        try {
          if (b && (b.vendor || b.amount)) {
            await dataStore.createBill(b, userId);
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
  },

  // Brand Methods
  getBrands: async (companyId) => {
    const filter = companyId ? { companyId } : {};
    return await Brand.find(filter).sort({ name: 1 }).lean().exec();
  },

  createBrand: async (brandData, companyId) => {
    const cid = companyId || brandData.companyId || 'shop_default';
    const id = brandData.id || `BRD-${Date.now().toString().slice(-6)}`;
    const brand = new Brand({
      id,
      companyId: cid,
      name: brandData.name,
      description: brandData.description || '',
      logo: brandData.logo || '',
      status: brandData.status || 'Active'
    });
    return await brand.save();
  },

  updateBrand: async (id, brandData, companyId) => {
    const filter = companyId ? { id, companyId } : { id };
    return await Brand.findOneAndUpdate(filter, { $set: brandData }, { new: true }).exec();
  },

  deleteBrand: async (id, companyId) => {
    const filter = companyId ? { id, companyId } : { id };
    return await Brand.deleteOne(filter).exec();
  },

  // Supplier Methods
  getSuppliers: async (companyId) => {
    const filter = companyId ? { companyId } : {};
    return await Supplier.find(filter).sort({ name: 1 }).lean().exec();
  },

  createSupplier: async (supplierData, companyId) => {
    const cid = companyId || supplierData.companyId || 'shop_default';
    const id = supplierData.id || `SUP-${Date.now().toString().slice(-6)}`;
    const supplier = new Supplier({
      id,
      companyId: cid,
      name: supplierData.name,
      contactPerson: supplierData.contactPerson || '',
      email: supplierData.email || '',
      phone: supplierData.phone || '',
      address: supplierData.address || '',
      category: supplierData.category || 'Apparel',
      status: supplierData.status || 'Active'
    });
    return await supplier.save();
  },

  updateSupplier: async (id, supplierData, companyId) => {
    const filter = companyId ? { id, companyId } : { id };
    return await Supplier.findOneAndUpdate(filter, { $set: supplierData }, { new: true }).exec();
  },

  deleteSupplier: async (id, companyId) => {
    const filter = companyId ? { id, companyId } : { id };
    return await Supplier.deleteOne(filter).exec();
  },

  // Sale Methods
  recordSale: async (saleData, companyId) => {
    const cid = companyId || saleData.companyId || 'shop_default';
    const id = saleData.id || `SALE-${Date.now().toString().slice(-6)}`;
    const sale = new Sale({
      id,
      companyId: cid,
      invoiceId: saleData.invoiceId,
      clientName: saleData.clientName || 'Walk-in Customer',
      amount: parseFloat(saleData.amount) || 0,
      paymentMode: saleData.paymentMode || 'Cash',
      itemCount: parseInt(saleData.itemCount, 10) || 1,
      saleDate: saleData.saleDate || new Date().toISOString().split('T')[0]
    });
    return await sale.save();
  },

  getSales: async (companyId) => {
    const filter = companyId ? { companyId } : {};
    return await Sale.find(filter).sort({ saleDate: -1 }).lean().exec();
  },

  // Inventory Movements Log
  logInventoryMovement: async (logData, companyId) => {
    const cid = companyId || logData.companyId || 'shop_default';
    const id = logData.id || `LOG-${Date.now().toString().slice(-6)}`;
    const log = new InventoryLog({
      id,
      companyId: cid,
      productId: logData.productId,
      productName: logData.productName || 'Product',
      type: logData.type || 'ADJUSTMENT',
      quantityChanged: parseInt(logData.quantityChanged, 10) || 0,
      newStockCount: parseInt(logData.newStockCount, 10) || 0,
      reason: logData.reason || '',
      referenceId: logData.referenceId || ''
    });
    return await log.save();
  },

  getInventoryLogs: async (companyId) => {
    const filter = companyId ? { companyId } : {};
    return await InventoryLog.find(filter).sort({ createdAt: -1 }).limit(100).lean().exec();
  }
};

module.exports = dataStore;


