const mongoose = require('mongoose');
const sqliteStore = require('../db/sqliteStore');
const { getDeviceId } = sqliteStore;

const Invoice = require('../models/Invoice');
const Bill = require('../models/Bill');
const Client = require('../models/Client');
const Product = require('../models/Product');
const Category = require('../models/Category');

let syncInterval = null;
let isSyncing = false;
let syncQueued = false;
let lastSyncedAt = null;
let lastError = null;
let retryBackoffMs = 5000;
const MAX_BACKOFF_MS = 60000;

function isMongoConnected() {
  return mongoose.connection && mongoose.connection.readyState === 1;
}

async function runSyncCycle() {
  if (isSyncing) {
    syncQueued = true;
    return;
  }
  
  if (!isMongoConnected()) {
    lastError = 'MongoDB connection offline';
    return;
  }

  isSyncing = true;
  try {
    // 1. Push pending local changes to MongoDB Atlas
    await pushLocalChangesToMongo();

    // 2. Pull remote changes from MongoDB Atlas to local SQLite
    await pullRemoteChangesFromMongo();

    lastSyncedAt = new Date().toISOString();
    lastError = null;
    retryBackoffMs = 5000; // Reset exponential backoff on success
  } catch (err) {
    lastError = err.message;
    retryBackoffMs = Math.min(retryBackoffMs * 2, MAX_BACKOFF_MS);
    if (err.message && (err.message.includes('timed out') || err.message.includes('ECONNREFUSED') || err.message.includes('ENOTFOUND'))) {
      // Quietly wait for network reconnection
    } else {
      console.error('[Sync Engine] Synchronization cycle notice:', err.message);
    }
  } finally {
    isSyncing = false;
    if (syncQueued) {
      syncQueued = false;
      setTimeout(() => { runSyncCycle(); }, 300);
    }
  }
}

async function pushLocalChangesToMongo() {
  const pendingItems = await sqliteStore.getPendingSyncItems();
  if (!pendingItems || pendingItems.length === 0) {
    return;
  }

  console.log(`[Sync Engine] Found ${pendingItems.length} pending local change items to push.`);

  // Define priority dependency order
  const priorityMap = {
    'CATEGORY': 1,
    'SUPPLIER': 2,
    'CUSTOMER': 3,
    'PRODUCT': 4,
    'INVOICE': 5,
    'BILL': 6
  };

  pendingItems.sort((a, b) => (priorityMap[a.entity_type] || 5) - (priorityMap[b.entity_type] || 5));

  for (const item of pendingItems) {
    try {
      const payload = typeof item.payload === 'string' ? JSON.parse(item.payload) : item.payload;
      const deviceId = item.device_id || getDeviceId();

      if (item.entity_type === 'CATEGORY') {
        if (item.operation === 'DELETE') {
          await Category.deleteOne({ id: item.entity_id }).exec();
        } else {
          let parsedSubCats = [];
          if (Array.isArray(payload.subCategories)) {
            parsedSubCats = payload.subCategories;
          } else if (typeof payload.subCategories === 'string') {
            try { parsedSubCats = JSON.parse(payload.subCategories); } catch(e) { parsedSubCats = payload.subCategories ? [payload.subCategories] : []; }
          }
          const catStatus = (payload.status === 'Disabled' || payload.status === 'Inactive') ? 'Inactive' : 'Active';

          await Category.findOneAndUpdate(
            { id: payload.id || item.entity_id },
            {
              id: payload.id || item.entity_id,
              companyId: payload.companyId || 'shop_default',
              name: payload.name,
              subCategories: parsedSubCats,
              status: catStatus,
              itemCounts: payload.productCount || payload.itemCounts || 0,
              updatedAt: payload.updated_at || new Date().toISOString(),
              deviceId
            },
            { upsert: true, new: true }
          ).exec();
        }
      } else if (item.entity_type === 'CUSTOMER') {
        const clientUpdate = {
          id: payload.id || item.entity_id,
          companyId: payload.companyId || 'shop_default'
        };
        if (payload.name) clientUpdate.name = payload.name;
        if (payload.email !== undefined) clientUpdate.email = payload.email;
        if (payload.phone !== undefined) clientUpdate.phone = payload.phone;
        if (payload.contact !== undefined) clientUpdate.contact = payload.contact;
        if (payload.status !== undefined) clientUpdate.status = payload.status;
        if (payload.totalBilled !== undefined) clientUpdate.totalBilled = payload.totalBilled;
        clientUpdate.updatedAt = payload.updated_at || new Date().toISOString();
        clientUpdate.deviceId = deviceId;

        await Client.findOneAndUpdate(
          { id: payload.id || item.entity_id },
          { $set: clientUpdate },
          { upsert: true, new: true, runValidators: false }
        ).exec();
      } else if (item.entity_type === 'PRODUCT') {
        if (item.operation === 'DELETE') {
          const payload = typeof item.payload === 'string' ? JSON.parse(item.payload || '{}') : (item.payload || {});
          const idVal = payload.id || item.entity_id;
          const nameVal = payload.name || '';
          const deleteConditions = [];
          if (idVal) {
            deleteConditions.push({ id: idVal });
            deleteConditions.push({ id: new RegExp(`^${String(idVal).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
          }
          if (nameVal) {
            deleteConditions.push({ name: nameVal });
            deleteConditions.push({ name: new RegExp(`^${String(nameVal).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
          }
          if (deleteConditions.length > 0) {
            await Product.deleteMany({ $or: deleteConditions }).exec();
          }
        } else {
          const productUpdate = {
            id: payload.id || item.entity_id,
            companyId: payload.companyId || 'shop_default'
          };
          if (payload.name) productUpdate.name = payload.name;
          if (payload.category !== undefined) productUpdate.category = payload.category;
          if (payload.subCategory !== undefined) productUpdate.subCategory = payload.subCategory;
          if (payload.color !== undefined) productUpdate.color = payload.color;
          if (payload.size !== undefined) productUpdate.size = payload.size;
          if (payload.price !== undefined) productUpdate.price = Number(payload.price) || 0;
          if (payload.stock !== undefined) productUpdate.stock = payload.stock;
          if (payload.count !== undefined) productUpdate.count = Number(payload.count) || 50;
          productUpdate.updatedAt = payload.updated_at || new Date().toISOString();
          productUpdate.deviceId = deviceId;

          await Product.findOneAndUpdate(
            { id: payload.id || item.entity_id },
            { $set: productUpdate },
            { upsert: true, new: true, runValidators: false }
          ).exec();
        }
      } else if (item.entity_type === 'INVOICE') {
        const issueDateVal = payload.issueDate || payload.date || payload.dueDate || new Date().toISOString().split('T')[0];
        const dueDateVal = payload.dueDate || payload.issueDate || payload.date || new Date().toISOString().split('T')[0];

        const invoiceUpdate = {
          id: payload.id || item.entity_id,
          companyId: payload.companyId || 'shop_default',
          clientId: payload.clientId || '',
          clientName: payload.clientName || 'Walk-in Retail Customer',
          clientEmail: payload.clientEmail || '',
          issueDate: issueDateVal,
          dueDate: dueDateVal,
          amount: payload.amount !== undefined ? Number(payload.amount) : 0,
          subtotal: payload.subtotal !== undefined ? Number(payload.subtotal) : (Number(payload.amount) || 0),
          tax: payload.tax !== undefined ? Number(payload.tax) : 0,
          discount: payload.discount !== undefined ? Number(payload.discount) : 0,
          status: payload.status || 'Paid',
          category: payload.category || 'Retail Sale',
          paymentMode: payload.paymentMode || 'Cash',
          items: Array.isArray(payload.items) ? payload.items : [],
          notes: payload.notes || '',
          updatedAt: payload.updated_at || new Date().toISOString(),
          deviceId
        };

        await Invoice.findOneAndUpdate(
          { id: payload.id || item.entity_id },
          { $set: invoiceUpdate },
          { upsert: true, new: true, runValidators: false }
        ).exec();
      } else if (item.entity_type === 'BILL') {
        await Bill.findOneAndUpdate(
          { id: payload.id || item.entity_id },
          {
            id: payload.id || item.entity_id,
            companyId: payload.companyId || 'shop_default',
            vendor: payload.vendor,
            category: payload.category,
            dueDate: payload.dueDate,
            amount: payload.amount,
            status: payload.status || 'Unpaid',
            autoPay: !!payload.autoPay,
            updatedAt: payload.updated_at || new Date().toISOString(),
            deviceId
          },
          { upsert: true, new: true }
        ).exec();
      }

      await sqliteStore.markSyncItemSynced(item.id);
    } catch (err) {
      console.warn(`[Sync Engine] Failed pushing item ${item.id} (${item.entity_type}):`, err.message);
      await sqliteStore.markSyncItemFailed(item.id, err.message);
    }
  }
}

async function pullRemoteChangesFromMongo() {
  const lastPull = (await sqliteStore.getSyncMetaData('last_pull_timestamp')) || '1970-01-01T00:00:00.000Z';
  const myDeviceId = getDeviceId();
  const pullOpts = { skipSyncQueue: true };
  let hasNewPullData = false;

  // 1. Pull Products (Shared Catalog)
  const remotePrds = await Product.find().lean().exec();
  const localPrds = await sqliteStore.getProducts();
  const deletedKeysList = typeof sqliteStore.getDeletedProductKeys === 'function' ? sqliteStore.getDeletedProductKeys() : [];
  const deletedKeys = new Set(deletedKeysList.map(k => String(k).toLowerCase().trim()));
  const localPrdMap = new Map((localPrds || []).map(p => [(p.id || '').toLowerCase(), p]));

  for (const p of remotePrds || []) {
    if (p.id) {
      const pIdLower = String(p.id).toLowerCase().trim();
      const pNameLower = p.name ? String(p.name).toLowerCase().trim() : '';

      if (deletedKeys.has(pIdLower) || (pNameLower && deletedKeys.has(pNameLower))) {
        try {
          await Product.deleteMany({ $or: [{ id: p.id }, { name: p.name }] }).exec();
        } catch (e) {}
        continue;
      }

      const existing = localPrdMap.get(pIdLower);
      if (!existing || existing.name !== p.name || existing.price !== p.price || existing.stock !== p.stock) {
        hasNewPullData = true;
      }
      await sqliteStore.createProduct({
        id: p.id,
        name: p.name,
        category: p.category,
        subCategory: p.subCategory,
        color: p.color,
        size: p.size,
        price: p.price,
        stock: p.stock,
        count: p.count
      }, pullOpts);
    }
  }

  // 2. Pull Categories (Shared Catalog)
  const remoteCats = await Category.find().lean().exec();
  const localCats = await sqliteStore.getCategories();
  const localCatMap = new Map((localCats || []).map(c => [(c.id || '').toLowerCase(), c]));
  for (const cat of remoteCats || []) {
    if (cat.id) {
      if (!localCatMap.has(String(cat.id).toLowerCase())) {
        hasNewPullData = true;
      }
      await sqliteStore.createCategory({
        id: cat.id,
        name: cat.name,
        subCategories: cat.subCategories,
        status: cat.status,
        productCount: cat.productCount
      }, pullOpts);
    }
  }

  // 3. Pull Customers (profile data only)
  const remoteClients = await Client.find().lean().exec();
  const localClients = await sqliteStore.getClients();
  const localClientMap = new Map((localClients || []).map(c => [(c.id || '').toLowerCase(), c]));
  for (const c of remoteClients || []) {
    if (c.id) {
      if (!localClientMap.has(String(c.id).toLowerCase())) {
        hasNewPullData = true;
      }
      await sqliteStore.createClient({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        contact: c.contact,
        status: c.status
      }, pullOpts);
    }
  }

  // 4. Pull Invoices
  const remoteInvoices = await Invoice.find().lean().exec();
  for (const inv of remoteInvoices || []) {
    const invId = inv.id || (inv._id ? String(inv._id) : null);
    if (invId) {
      const existingLocal = await sqliteStore.getInvoiceById(invId);
      if (!existingLocal) {
        hasNewPullData = true;
        await sqliteStore.createInvoice({
          id: invId,
          clientId: inv.clientId || '',
          clientName: inv.clientName || 'Walk-in Retail Customer',
          clientEmail: inv.clientEmail || '',
          issueDate: inv.issueDate || inv.date || new Date().toISOString().split('T')[0],
          dueDate: inv.dueDate || inv.issueDate || new Date().toISOString().split('T')[0],
          amount: Number(inv.amount) || 0,
          subtotal: Number(inv.subtotal) || Number(inv.amount) || 0,
          tax: Number(inv.tax) || 0,
          discount: Number(inv.discount) || 0,
          status: inv.status || 'Paid',
          category: inv.category || 'Retail Sale',
          paymentMode: inv.paymentMode || 'Cash',
          items: Array.isArray(inv.items) ? inv.items : [],
          notes: inv.notes || ''
        }, pullOpts);
      }
    }
  }

  // 5. Pull Bills
  const remoteBills = await Bill.find().lean().exec();
  for (const b of remoteBills || []) {
    if (b.id) {
      const existingLocal = await sqliteStore.getBills();
      const found = existingLocal.find(x => x.id === b.id);
      if (!found) {
        hasNewPullData = true;
        await sqliteStore.createBill({
          id: b.id,
          vendor: b.vendor,
          category: b.category,
          dueDate: b.dueDate,
          amount: b.amount,
          status: b.status,
          autoPay: b.autoPay
        }, pullOpts);
      }
    }
  }

  // Clean up completed/synced items from sync_queue
  await sqliteStore.clearCompletedSyncQueue();
  await sqliteStore.setSyncMetaData('last_pull_timestamp', new Date().toISOString());
}


function startSyncEngine(intervalMs = 5000) {
  if (syncInterval) clearInterval(syncInterval);
  console.log(`[Sync Engine] Initializing background synchronization service (pulse: ${intervalMs}ms)...`);
  
  // Initial pulse after 2s delay to allow DB connections to settle
  setTimeout(() => {
    runSyncCycle();
  }, 2000);

  syncInterval = setInterval(() => {
    runSyncCycle();
  }, intervalMs);
}

async function triggerManualSync() {
  if (isSyncing) {
    syncQueued = true;
    let attempts = 0;
    while (isSyncing && attempts < 20) {
      await new Promise(resolve => setTimeout(resolve, 200));
      attempts++;
    }
  } else {
    await runSyncCycle();
  }
  return getSyncStatus();
}

async function getSyncStatus() {
  const pendingItems = await sqliteStore.getPendingSyncItems();
  const pendingCount = pendingItems ? pendingItems.length : 0;
  const online = isMongoConnected();

  let status = 'online_synced';
  if (isSyncing) {
    status = 'syncing';
  } else if (!online) {
    status = 'offline';
  } else if (lastError) {
    status = 'error';
  } else if (pendingCount > 0) {
    status = 'syncing';
  }

  return {
    status,
    online,
    pendingCount,
    lastSyncedAt,
    deviceId: getDeviceId(),
    lastError
  };
}

module.exports = {
  startSyncEngine,
  triggerManualSync,
  getSyncStatus,
  runSyncCycle
};
