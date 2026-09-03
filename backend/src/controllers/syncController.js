const Device = require('../models/Device');

const syncController = {
  getSyncStatus: async (req, res) => {
    try {
      const companyId = req.user?.companyId || 'shop_default';
      const deviceId = req.deviceId || 'DEV_DEFAULT';

      res.json({
        success: true,
        status: 'Online',
        syncMode: 'MongoDB Atlas Real-Time Centralized Sync',
        companyId,
        deviceId,
        serverTime: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch sync status' });
    }
  },

  triggerSync: async (req, res) => {
    try {
      const companyId = req.user?.companyId || 'shop_default';
      const { emitToCompany } = require('../services/socketService');

      emitToCompany(companyId, 'dashboard:updated', { trigger: 'manual_sync' });

      res.json({
        success: true,
        message: 'Real-time multi-device cloud synchronization triggered successfully!'
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to trigger sync' });
    }
  },

  registerDevice: async (req, res) => {
    try {
      const companyId = req.user?.companyId || req.body?.companyId || 'shop_default';
      const userId = req.user?.id || req.body?.userId || 'usr_offline';
      const email = req.user?.email || req.body?.email || req.user?.email || 'owner@shop.com';
      const deviceId = String(req.body?.deviceId || req.headers['x-device-id'] || req.deviceId || 'DEV_DEFAULT').trim();
      const { deviceName = 'Windows Desktop' } = req.body || {};

      const isMongoReady = require('mongoose').connection.readyState === 1;
      let device = { deviceId, companyId, userId, email, deviceName, lastSync: new Date(), status: isMongoReady ? 'Online' : 'Local' };

      if (isMongoReady) {
        try {
          device = await Device.findOneAndUpdate(
            { deviceId },
            {
              $set: {
                companyId,
                userId,
                email,
                deviceName,
                lastSync: new Date(),
                status: 'Online'
              }
            },
            { upsert: true, new: true }
          );
        } catch (e) {}
      }

      // Emit real-time socket event to all devices in company room
      try {
        const { emitToCompany } = require('../services/socketService');
        emitToCompany(companyId, 'device:registered', { device });
      } catch (e) {}

      res.json({ success: true, device });
    } catch (error) {
      res.json({ success: true, device: { deviceId: 'DEV_LOCAL', status: 'Local' } });
    }
  },

  getDevices: async (req, res) => {
    try {
      const companyId = req.user?.companyId || req.query?.companyId || 'shop_default';
      const userId = req.user?.id || req.query?.userId || 'usr_offline';
      const email = req.user?.email || req.query?.email || '';

      const isMongoReady = require('mongoose').connection.readyState === 1;
      let devices = [];
      if (isMongoReady) {
        try {
          devices = await Device.find({
            $or: [
              { companyId },
              { userId },
              ...(email ? [{ email }] : [])
            ]
          })
          .sort({ lastSync: -1 })
          .lean()
          .exec();
        } catch (e) {}
      }

      res.json({ success: true, devices: devices || [] });
    } catch (error) {
      res.json({ success: true, devices: [] });
    }
  },

  revokeDevice: async (req, res) => {
    try {
      const { deviceId } = req.params;
      const companyId = req.user?.companyId || 'shop_default';

      await Device.deleteOne({ deviceId });

      try {
        const { emitToCompany } = require('../services/socketService');
        emitToCompany(companyId, 'device:revoked', { deviceId });
      } catch (e) {}

      res.json({ success: true, message: `Device ${deviceId} successfully revoked.` });
    } catch (error) {
      console.error('revokeDevice error:', error.message);
      res.status(500).json({ success: false, message: 'Failed to revoke device' });
    }
  },

  pushSyncChanges: async (req, res) => {
    try {
      const companyId = req.user?.companyId || 'shop_default';
      const { triggerManualSync } = require('../services/syncEngine');
      const { emitToCompany } = require('../services/socketService');

      let syncStatus = {};
      try {
        syncStatus = await triggerManualSync();
      } catch (e) {
        console.warn('Sync engine trigger notice:', e.message);
      }

      try {
        emitToCompany(companyId, 'sync:pushed', { timestamp: new Date().toISOString() });
      } catch (e) {}

      res.json({
        success: true,
        message: 'Sync push processed successfully',
        syncStatus
      });
    } catch (error) {
      console.error('pushSyncChanges error:', error.message);
      res.status(500).json({ success: false, message: 'Failed to push sync changes', error: error.message });
    }
  },

  pullSyncChanges: async (req, res) => {
    try {
      const companyId = req.user?.companyId || 'shop_default';
      const { triggerManualSync } = require('../services/syncEngine');

      let syncStatus = {};
      try {
        syncStatus = await triggerManualSync();
      } catch (e) {
        console.warn('Sync engine trigger notice:', e.message);
      }

      res.json({
        success: true,
        message: 'Sync pull processed successfully',
        syncStatus
      });
    } catch (error) {
      console.error('pullSyncChanges error:', error.message);
      res.status(500).json({ success: false, message: 'Failed to pull sync changes', error: error.message });
    }
  },

  getIncrementalSync: async (req, res) => {
    try {
      const companyId = req.user?.companyId || 'shop_default';
      const cursor = req.query.cursor || req.body.cursor || '1970-01-01T00:00:00.000Z';
      const cursorDate = new Date(cursor);

      const Product = require('../models/Product');
      const Category = require('../models/Category');
      const Client = require('../models/Client');
      const Invoice = require('../models/Invoice');
      const Bill = require('../models/Bill');

      const isMongoReady = require('mongoose').connection.readyState === 1;
      let changes = { products: [], categories: [], clients: [], invoices: [], bills: [] };

      if (isMongoReady) {
        const queryFilter = {
          $or: [
            { updatedAt: { $gt: cursorDate } },
            { updated_at: { $gt: cursorDate } }
          ]
        };

        const [prds, cats, clients, invs, bills] = await Promise.all([
          Product.find(queryFilter).lean().exec(),
          Category.find(queryFilter).lean().exec(),
          Client.find(queryFilter).lean().exec(),
          Invoice.find(queryFilter).lean().exec(),
          Bill.find(queryFilter).lean().exec()
        ]);

        changes = {
          products: prds || [],
          categories: cats || [],
          clients: clients || [],
          invoices: invs || [],
          bills: bills || []
        };
      }

      const newCursor = new Date().toISOString();
      res.json({
        success: true,
        cursor: newCursor,
        changes
      });
    } catch (error) {
      console.error('getIncrementalSync error:', error.message);
      res.status(500).json({ success: false, message: 'Failed to fetch incremental sync changes', error: error.message });
    }
  }
};

module.exports = syncController;
