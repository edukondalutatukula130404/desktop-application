const Backup = require('../models/Backup');
const Device = require('../models/Device');
const dataStore = require('../db/dataStore');

const backupController = {
  createBackup: async (req, res) => {
    try {
      const userId = req.user?.id;
      const email = req.user?.email || '';
      const deviceId = req.deviceId || 'DEV_DEFAULT';

      const { invoices = [], products = [], categories = [], clients = [], bills = [] } = req.body || {};

      const recordCounts = {
        invoices: Array.isArray(invoices) ? invoices.length : 0,
        products: Array.isArray(products) ? products.length : 0,
        categories: Array.isArray(categories) ? categories.length : 0,
        clients: Array.isArray(clients) ? clients.length : 0,
        bills: Array.isArray(bills) ? bills.length : 0
      };

      const backupId = `BKP_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      const backup = new Backup({
        backupId,
        userId,
        email,
        deviceId,
        version: 1,
        recordCounts,
        snapshotData: { invoices, products, categories, clients, bills }
      });

      await backup.save();

      // Register or update device sync timestamp asynchronously without blocking response
      Device.findOneAndUpdate(
        { deviceId },
        {
          $set: {
            userId,
            email,
            lastSync: new Date(),
            status: 'Online'
          }
        },
        { upsert: true }
      ).catch(e => console.warn('Device update notice:', e.message));

      res.status(201).json({
        success: true,
        message: 'Cloud backup created successfully!',
        backup: {
          backupId: backup.backupId,
          createdAt: backup.createdAt,
          recordCounts: backup.recordCounts,
          deviceId: backup.deviceId,
          email: backup.email
        }
      });
    } catch (error) {
      console.error('createBackup error:', error);
      res.status(500).json({ success: false, message: 'Failed to create cloud backup' });
    }
  },

  getLatestBackup: async (req, res) => {
    try {
      const userId = req.user?.id;
      const email = req.user?.email || '';

      const latestBackup = await Backup.findOne({
        $or: [{ userId }, { email }]
      }).sort({ createdAt: -1 }).lean().exec();

      if (!latestBackup) {
        return res.json({ success: true, backup: null, message: 'No cloud backups found for this account.' });
      }

      res.json({
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
      console.error('getLatestBackup error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch latest cloud backup' });
    }
  },

  getBackupList: async (req, res) => {
    try {
      const userId = req.user?.id;
      const email = req.user?.email || '';

      const backups = await Backup.find({
        $or: [{ userId }, { email }]
      })
      .select('-snapshotData')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()
      .exec();

      res.json({ success: true, backups });
    } catch (error) {
      console.error('getBackupList error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch backup history' });
    }
  },

  restoreBackup: async (req, res) => {
    try {
      const userId = req.user?.id;
      const email = req.user?.email || '';
      const { backupId, mode = 'merge' } = req.body || {};

      let query = { $or: [{ userId }, { email }] };
      if (backupId) {
        query = { backupId, ...query };
      }

      const targetBackup = await Backup.findOne(query).sort({ createdAt: -1 }).lean().exec();

      if (!targetBackup || !targetBackup.snapshotData) {
        return res.status(404).json({ success: false, message: 'Specified cloud backup was not found.' });
      }

      const snapshot = targetBackup.snapshotData;

      // Save restored items to database (user-scoped)
      const result = await dataStore.backupAllData({
        invoices: snapshot.invoices || [],
        products: snapshot.products || [],
        categories: snapshot.categories || [],
        clients: snapshot.clients || [],
        bills: snapshot.bills || []
      }, userId);

      res.json({
        success: true,
        message: `Backup ${targetBackup.backupId} successfully restored (${mode} mode)!`,
        backup: {
          backupId: targetBackup.backupId,
          createdAt: targetBackup.createdAt,
          recordCounts: targetBackup.recordCounts
        },
        restoredData: snapshot,
        result
      });
    } catch (error) {
      console.error('restoreBackup error:', error);
      res.status(500).json({ success: false, message: 'Failed to restore backup' });
    }
  }
};

module.exports = backupController;
