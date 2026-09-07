const Backup = require('../models/Backup');
const Device = require('../models/Device');
const Product = require('../models/Product');
const Invoice = require('../models/Invoice');
const Category = require('../models/Category');
const Client = require('../models/Client');
const Bill = require('../models/Bill');
const dataStore = require('../db/dataStore');
const sqliteStore = require('../db/sqliteStore');
const mongoose = require('mongoose');
const { emitToCompany } = require('../services/socketService');

function isCloudConnected() {
  return !!(mongoose.connection && mongoose.connection.readyState === 1);
}

const backupController = {
  createBackup: async (req, res) => {
    try {
      const companyId = String(req.user?.companyId || req.body?.companyId || 'shop_default').trim() || 'shop_default';
      const userId = String(req.user?.id || req.body?.userId || 'usr_offline').trim() || 'usr_offline';
      const email = String(req.user?.email || req.body?.email || 'owner@shop.com').trim() || 'owner@shop.com';
      const deviceId = String(req.deviceId || req.body?.deviceId || 'DEV_DEFAULT').trim() || 'DEV_DEFAULT';

      // A backup only counts if it actually reaches the cloud. Never report
      // success for a snapshot that was not uploaded.
      if (!isCloudConnected()) {
        return res.status(503).json({
          success: false,
          offline: true,
          message: 'Cloud database not connected. Backup was NOT uploaded. Reconnect to the internet and click Backup again.'
        });
      }

      let { invoices, products, categories, clients, bills } = req.body || {};

      // For any section the client did not send, fall back to the full local dataset.
      if (!Array.isArray(invoices) || invoices.length === 0) {
        try { invoices = await dataStore.getInvoices(userId, companyId); } catch (e) { invoices = Array.isArray(invoices) ? invoices : []; }
      }
      if (!Array.isArray(products) || products.length === 0) {
        try { products = await dataStore.getProducts(userId, companyId); } catch (e) { products = Array.isArray(products) ? products : []; }
      }
      if (!Array.isArray(categories) || categories.length === 0) {
        try { categories = await dataStore.getCategories(userId); } catch (e) { categories = Array.isArray(categories) ? categories : []; }
      }
      if (!Array.isArray(clients) || clients.length === 0) {
        try { clients = await dataStore.getClients(companyId); } catch (e) { clients = Array.isArray(clients) ? clients : []; }
      }
      if (!Array.isArray(bills) || bills.length === 0) {
        try { bills = await dataStore.getBills(userId); } catch (e) { bills = Array.isArray(bills) ? bills : []; }
      }

      invoices = Array.isArray(invoices) ? invoices : [];
      products = Array.isArray(products) ? products : [];
      categories = Array.isArray(categories) ? categories : [];
      clients = Array.isArray(clients) ? clients : [];
      bills = Array.isArray(bills) ? bills : [];

      const recordCounts = {
        invoices: invoices.length,
        products: products.length,
        categories: categories.length,
        clients: clients.length,
        bills: bills.length
      };

      const backupId = `BKP_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      // Pure snapshot upload. This must NOT touch or delete any live cloud
      // collection — a device with a partial local cache must never be able to
      // shrink the shared cloud data.
      try {
        await Backup.create({
          backupId, companyId, userId, email, deviceId, version: 1, recordCounts,
          snapshotData: { invoices, products, categories, clients, bills }
        });
      } catch (mErr) {
        console.error('createBackup cloud save failed:', mErr.message);
        return res.status(502).json({
          success: false,
          message: `Backup upload to cloud failed: ${mErr.message}`
        });
      }

      // Verify the snapshot is really persisted before telling the user it worked.
      const verify = await Backup.findOne({ backupId }).select('backupId recordCounts createdAt').lean().exec();
      if (!verify) {
        return res.status(502).json({ success: false, message: 'Backup could not be verified in the cloud. Please retry.' });
      }

      // Retention: keep the 30 most recent backups for this account.
      try {
        const stale = await Backup.find({ $or: [{ companyId }, { userId }, { email }] })
          .sort({ createdAt: -1 }).skip(30).select('_id').lean().exec();
        if (stale.length > 0) {
          await Backup.deleteMany({ _id: { $in: stale.map(s => s._id) } });
        }
      } catch (e) {}

      try {
        emitToCompany(companyId, 'backup:created', { backup: { backupId, recordCounts } });
      } catch (e) {}

      Device.findOneAndUpdate(
        { deviceId },
        { $set: { companyId, userId, email, lastSync: new Date(), status: 'Online' } },
        { upsert: true }
      ).catch(e => console.warn('Device update notice:', e.message));

      return res.status(201).json({
        success: true,
        message: 'Cloud backup uploaded & verified successfully.',
        backup: { backupId, createdAt: verify.createdAt, recordCounts, deviceId, email }
      });
    } catch (error) {
      console.error('createBackup error:', error.message);
      return res.status(500).json({ success: false, message: 'Failed to create cloud backup' });
    }
  },

  getLatestBackup: async (req, res) => {
    try {
      const companyId = String(req.user?.companyId || req.query?.companyId || 'shop_default').trim() || 'shop_default';
      const userId = String(req.user?.id || req.query?.userId || 'usr_offline').trim() || 'usr_offline';
      const email = String(req.user?.email || req.query?.email || 'owner@shop.com').trim() || 'owner@shop.com';

      let latestBackup = null;
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        try {
          latestBackup = await Backup.findOne({
            $or: [{ companyId }, { userId }, { email }]
          }).sort({ createdAt: -1 }).lean().exec();

          if (!latestBackup) {
            latestBackup = await Backup.findOne({}).sort({ createdAt: -1 }).lean().exec();
          }
        } catch (e) {}
      }

      if (!latestBackup) {
        return res.json({ success: true, backup: null, message: 'No cloud backups found for this account.' });
      }

      return res.json({
        success: true,
        backup: {
          backupId: latestBackup.backupId,
          createdAt: latestBackup.createdAt,
          recordCounts: latestBackup.recordCounts,
          deviceId: latestBackup.deviceId,
          email: latestBackup.email,
          snapshotData: latestBackup.snapshotData
        }
      });
    } catch (error) {
      console.error('getLatestBackup error:', error.message);
      return res.status(500).json({ success: false, message: 'Failed to fetch latest cloud backup' });
    }
  },

  getBackupList: async (req, res) => {
    try {
      const companyId = String(req.user?.companyId || req.query?.companyId || 'shop_default').trim() || 'shop_default';
      const userId = String(req.user?.id || req.query?.userId || 'usr_offline').trim() || 'usr_offline';
      const email = String(req.user?.email || req.query?.email || 'owner@shop.com').trim() || 'owner@shop.com';

      let backups = [];
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        try {
          backups = await Backup.find({
            $or: [{ companyId }, { userId }, { email }]
          })
          .select('-snapshotData')
          .sort({ createdAt: -1 })
          .limit(20)
          .lean()
          .exec();

          if (!backups || backups.length === 0) {
            backups = await Backup.find({})
              .select('-snapshotData')
              .sort({ createdAt: -1 })
              .limit(20)
              .lean()
              .exec();
          }
        } catch (e) {}
      }

      return res.json({ success: true, backups: backups || [] });
    } catch (error) {
      console.error('getBackupList error:', error.message);
      return res.status(500).json({ success: false, message: 'Failed to fetch backup history' });
    }
  },

  restoreBackup: async (req, res) => {
    try {
      const companyId = String(req.user?.companyId || req.body?.companyId || 'shop_default').trim() || 'shop_default';
      const userId = String(req.user?.id || req.body?.userId || 'usr_offline').trim() || 'usr_offline';
      const email = String(req.user?.email || req.body?.email || 'owner@shop.com').trim() || 'owner@shop.com';
      const { backupId } = req.body || {};

      if (!isCloudConnected()) {
        return res.status(503).json({
          success: false,
          offline: true,
          message: 'Cloud database not connected. Connect to the internet and try Restore again.'
        });
      }

      // Pick exactly one backup snapshot to restore.
      let targetBackup = null;
      if (backupId) {
        targetBackup = await Backup.findOne({ backupId }).lean().exec();
      }
      if (!targetBackup) {
        targetBackup = await Backup.findOne({ $or: [{ companyId }, { userId }, { email }] })
          .sort({ createdAt: -1 }).lean().exec();
      }
      if (!targetBackup) {
        targetBackup = await Backup.findOne({}).sort({ createdAt: -1 }).lean().exec();
      }
      if (!targetBackup) {
        return res.status(404).json({ success: false, message: 'No cloud backup found to restore.' });
      }

      // Restore the snapshot verbatim. Do NOT merge with the live cloud
      // collections and do NOT delete anything from the cloud — the result must
      // be exactly the data that was backed up on the other device.
      const snapshot = targetBackup.snapshotData || {};
      const finalSnapshot = {
        products: Array.isArray(snapshot.products) ? snapshot.products : [],
        invoices: Array.isArray(snapshot.invoices) ? snapshot.invoices : [],
        categories: Array.isArray(snapshot.categories) ? snapshot.categories : [],
        clients: Array.isArray(snapshot.clients) ? snapshot.clients : [],
        bills: Array.isArray(snapshot.bills) ? snapshot.bills : []
      };

      // Apply to the local store (upsert by id, no sync-queue noise). Non-destructive.
      const opts = { skipSyncQueue: true };
      const applied = { products: 0, invoices: 0, categories: 0, clients: 0, bills: 0 };
      for (const c of finalSnapshot.categories) { try { await sqliteStore.createCategory(c, opts); applied.categories++; } catch (e) {} }
      for (const p of finalSnapshot.products) { try { await sqliteStore.createProduct(p, opts); applied.products++; } catch (e) {} }
      for (const cl of finalSnapshot.clients) { try { await sqliteStore.createClient(cl, opts); applied.clients++; } catch (e) {} }
      for (const inv of finalSnapshot.invoices) { try { await sqliteStore.createInvoice(inv, opts); applied.invoices++; } catch (e) {} }
      for (const b of finalSnapshot.bills) { try { await sqliteStore.createBill(b, opts); applied.bills++; } catch (e) {} }

      try {
        emitToCompany(companyId, 'backup:restored', { backup: { backupId: targetBackup.backupId } });
        emitToCompany(companyId, 'dashboard:updated', { trigger: 'backup_restored' });
      } catch (e) {}

      return res.json({
        success: true,
        message: `Restored backup ${targetBackup.backupId} from ${new Date(targetBackup.createdAt).toLocaleString()}.`,
        backup: {
          backupId: targetBackup.backupId,
          createdAt: targetBackup.createdAt,
          recordCounts: targetBackup.recordCounts || applied
        },
        restoredData: finalSnapshot,
        applied
      });
    } catch (error) {
      console.error('restoreBackup error:', error.message);
      return res.status(500).json({ success: false, message: 'Failed to restore cloud backup' });
    }
  }
};

module.exports = backupController;
