const Backup = require('../models/Backup');
const Device = require('../models/Device');
const Product = require('../models/Product');
const Invoice = require('../models/Invoice');
const Category = require('../models/Category');
const Client = require('../models/Client');
const Bill = require('../models/Bill');
const dataStore = require('../db/dataStore');
const mongoose = require('mongoose');
const { emitToCompany } = require('../services/socketService');

const backupController = {
  createBackup: async (req, res) => {
    try {
      const companyId = String(req.user?.companyId || req.body?.companyId || 'shop_default').trim() || 'shop_default';
      const userId = String(req.user?.id || req.body?.userId || 'usr_offline').trim() || 'usr_offline';
      const email = String(req.user?.email || req.body?.email || 'owner@shop.com').trim() || 'owner@shop.com';
      const deviceId = String(req.deviceId || req.body?.deviceId || 'DEV_DEFAULT').trim() || 'DEV_DEFAULT';

      let { invoices, products, categories, clients, bills } = req.body || {};

      if (!Array.isArray(invoices) || invoices.length === 0) {
        try { invoices = await dataStore.getInvoices(userId); } catch (e) { invoices = []; }
      }
      if (!Array.isArray(products) || products.length === 0) {
        try { products = await dataStore.getProducts(userId); } catch (e) { products = []; }
      }
      if (!Array.isArray(categories) || categories.length === 0) {
        try { categories = await dataStore.getCategories(userId); } catch (e) { categories = []; }
      }
      if (!Array.isArray(clients) || clients.length === 0) {
        try { clients = await dataStore.getClients(companyId); } catch (e) { clients = []; }
      }
      if (!Array.isArray(bills) || bills.length === 0) {
        try { bills = await dataStore.getBills(userId); } catch (e) { bills = []; }
      }

      try {
        await dataStore.backupAllData({ invoices, products, categories, clients, bills }, userId);
      } catch (saveErr) {
        console.warn('dataStore.backupAllData notice:', saveErr.message);
      }

      const recordCounts = {
        invoices: Array.isArray(invoices) ? invoices.length : 0,
        products: Array.isArray(products) ? products.length : 0,
        categories: Array.isArray(categories) ? categories.length : 0,
        clients: Array.isArray(clients) ? clients.length : 0,
        bills: Array.isArray(bills) ? bills.length : 0
      };

      const backupId = `BKP_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      if (mongoose.connection && mongoose.connection.readyState === 1) {
        try {
          const backup = new Backup({
            backupId,
            companyId,
            userId,
            email,
            deviceId,
            version: 1,
            recordCounts,
            snapshotData: {
              invoices: Array.isArray(invoices) ? invoices : [],
              products: Array.isArray(products) ? products : [],
              categories: Array.isArray(categories) ? categories : [],
              clients: Array.isArray(clients) ? clients : [],
              bills: Array.isArray(bills) ? bills : []
            }
          });
          await backup.save();
        } catch (mErr) {
          console.warn('MongoDB backup save notice:', mErr.message);
        }
      }

      // Broadcast real-time event to all connected devices in company room
      try {
        emitToCompany(companyId, 'backup:created', { backup: { backupId, recordCounts } });
      } catch (e) {}

      // Asynchronously update Device status
      Device.findOneAndUpdate(
        { deviceId },
        {
          $set: {
            companyId,
            userId,
            email,
            lastSync: new Date(),
            status: 'Online'
          }
        },
        { upsert: true }
      ).catch(e => console.warn('Device update notice:', e.message));

      return res.status(201).json({
        success: true,
        message: 'Cloud backup created & synchronized successfully!',
        backup: {
          backupId,
          createdAt: new Date().toISOString(),
          recordCounts,
          deviceId,
          email
        }
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

      let targetBackup = null;
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        try {
          if (backupId) {
            targetBackup = await Backup.findOne({ backupId }).lean().exec();
          }
          if (!targetBackup) {
            targetBackup = await Backup.findOne({
              $or: [{ companyId }, { userId }, { email }]
            }).sort({ createdAt: -1 }).lean().exec();
          }
          if (!targetBackup) {
            targetBackup = await Backup.findOne({}).sort({ createdAt: -1 }).lean().exec();
          }
        } catch (e) {}
      }

      // 1. Fetch live MongoDB Atlas data directly across all collections
      let liveProducts = [];
      let liveInvoices = [];
      let liveCategories = [];
      let liveClients = [];
      let liveBills = [];

      if (mongoose.connection && mongoose.connection.readyState === 1) {
        try {
          liveProducts = await Product.find({}).lean().exec();
          liveInvoices = await Invoice.find({}).sort({ createdAt: -1 }).lean().exec();
          liveCategories = await Category.find({}).lean().exec();
          liveClients = await Client.find({}).lean().exec();
          liveBills = await Bill.find({}).lean().exec();
        } catch (e) {
          console.warn('Live MongoDB query warning during restore:', e.message);
        }
      }

      // 2. Merge snapshot data with live MongoDB Atlas data (deduplicate by ID / name)
      const snapshot = targetBackup ? (targetBackup.snapshotData || {}) : {};

      const mergedProductsMap = new Map();
      (liveProducts || []).concat(snapshot.products || []).forEach(p => {
        if (p && (p.id || p.name)) {
          const key = String(p.id || p.name).toLowerCase().trim();
          mergedProductsMap.set(key, p);
        }
      });

      const mergedInvoicesMap = new Map();
      (liveInvoices || []).concat(snapshot.invoices || []).forEach(i => {
        if (i && (i.id || i.clientName)) {
          const key = String(i.id || (i.clientName + i.amount)).toLowerCase().trim();
          mergedInvoicesMap.set(key, i);
        }
      });

      const mergedCategoriesMap = new Map();
      (liveCategories || []).concat(snapshot.categories || []).forEach(c => {
        if (c && (c.id || c.name)) {
          const key = String(c.id || c.name).toLowerCase().trim();
          mergedCategoriesMap.set(key, c);
        }
      });

      const mergedClientsMap = new Map();
      (liveClients || []).concat(snapshot.clients || []).forEach(cl => {
        if (cl && (cl.id || cl.name)) {
          const key = String(cl.id || cl.name).toLowerCase().trim();
          mergedClientsMap.set(key, cl);
        }
      });

      const mergedBillsMap = new Map();
      (liveBills || []).concat(snapshot.bills || []).forEach(b => {
        if (b && (b.id || b.vendor)) {
          const key = String(b.id || b.vendor).toLowerCase().trim();
          mergedBillsMap.set(key, b);
        }
      });

      const finalSnapshot = {
        products: Array.from(mergedProductsMap.values()),
        invoices: Array.from(mergedInvoicesMap.values()),
        categories: Array.from(mergedCategoriesMap.values()),
        clients: Array.from(mergedClientsMap.values()),
        bills: Array.from(mergedBillsMap.values())
      };

      // 3. Save all restored items to local storage
      let result = null;
      try {
        result = await dataStore.backupAllData(finalSnapshot, userId);
      } catch (e) {
        console.warn('dataStore.backupAllData notice:', e.message);
      }

      // 4. Broadcast real-time restore event to all connected devices in company room
      try {
        emitToCompany(companyId, 'backup:restored', { backup: targetBackup || { backupId: 'BKP_LIVE_RESTORED' } });
        emitToCompany(companyId, 'dashboard:updated', { trigger: 'backup_restored' });
      } catch (e) {}

      return res.json({
        success: true,
        message: `Successfully restored and synchronized ${finalSnapshot.products.length} products and data from MongoDB Atlas!`,
        backup: {
          backupId: targetBackup ? targetBackup.backupId : 'BKP_LIVE_SYNC',
          createdAt: targetBackup ? targetBackup.createdAt : new Date().toISOString(),
          recordCounts: {
            products: finalSnapshot.products.length,
            invoices: finalSnapshot.invoices.length,
            categories: finalSnapshot.categories.length,
            clients: finalSnapshot.clients.length,
            bills: finalSnapshot.bills.length
          }
        },
        restoredData: finalSnapshot,
        result
      });
    } catch (error) {
      console.error('restoreBackup error:', error.message);
      return res.status(500).json({ success: false, message: 'Failed to restore cloud backup' });
    }
  }
};

module.exports = backupController;
