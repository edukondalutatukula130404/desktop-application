const SyncChange = require('../models/SyncChange');
const Device = require('../models/Device');
const dataStore = require('../db/dataStore');

const syncController = {
  pushSyncChanges: async (req, res) => {
    try {
      const userId = req.user?.id || 'usr_default';
      const deviceId = req.deviceId || 'DEV_DEFAULT';
      const { changes = [] } = req.body || {};

      if (!Array.isArray(changes) || changes.length === 0) {
        return res.json({ success: true, appliedCount: 0, message: 'No sync changes provided.' });
      }

      let appliedCount = 0;

      for (const change of changes) {
        try {
          const changeId = change.changeId || `chg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const entityType = String(change.entityType || '').toUpperCase();
          const action = String(change.action || '').toUpperCase();
          const entityId = change.entityId || change.payload?.id || change.payload?._id || '';

          // Upsert change log entry to ensure idempotency
          await SyncChange.updateOne(
            { changeId },
            {
              $setOnInsert: {
                changeId,
                userId,
                deviceId,
                entityType,
                action,
                entityId,
                payload: change.payload,
                timestamp: change.timestamp ? new Date(change.timestamp) : new Date()
              }
            },
            { upsert: true }
          );

          // Execute entity action in dataStore
          if (entityType === 'PRODUCT') {
            if (action === 'CREATE' || action === 'UPDATE') {
              await dataStore.createProduct(change.payload, userId);
            } else if (action === 'DELETE') {
              await dataStore.deleteProduct(entityId, change.payload?.name || '', userId);
            } else if (action === 'UPDATE_STOCK') {
              await dataStore.updateProductStock(entityId, change.payload);
            }
          } else if (entityType === 'CATEGORY') {
            if (action === 'CREATE' || action === 'UPDATE') {
              await dataStore.createCategory(change.payload, userId);
            } else if (action === 'DELETE') {
              await dataStore.deleteCategory(entityId, change.payload?.name || '');
            } else if (action === 'TOGGLE_STATUS') {
              await dataStore.toggleCategoryStatus(entityId);
            }
          } else if (entityType === 'INVOICE') {
            if (action === 'CREATE' || action === 'UPDATE') {
              await dataStore.createInvoice(change.payload, userId);
            } else if (action === 'UPDATE_STATUS') {
              await dataStore.updateInvoiceStatus(entityId, change.payload?.status);
            }
          } else if (entityType === 'CLIENT') {
            if (action === 'CREATE' || action === 'UPDATE') {
              await dataStore.createClient(change.payload, userId);
            } else if (action === 'TOGGLE_STATUS') {
              await dataStore.toggleClientStatus(entityId);
            }
          } else if (entityType === 'BILL') {
            if (action === 'CREATE' || action === 'UPDATE') {
              await dataStore.createBill(change.payload, userId);
            } else if (action === 'PAY') {
              await dataStore.payBill(entityId);
            } else if (action === 'TOGGLE_STATUS') {
              await dataStore.toggleBillStatus(entityId);
            } else if (action === 'TOGGLE_AUTOPAY') {
              await dataStore.toggleBillAutoPay(entityId);
            }
          }

          appliedCount++;
        } catch (err) {
          console.warn(`Failed to process sync change (${change.changeId}):`, err.message);
        }
      }

      // Update Device status
      await Device.findOneAndUpdate(
        { deviceId },
        {
          $set: {
            userId,
            email: req.user?.email || 'admin@gmail.com',
            lastSync: new Date(),
            status: 'Online'
          }
        },
        { upsert: true }
      );

      res.json({
        success: true,
        appliedCount,
        message: `${appliedCount} local change(s) successfully pushed to cloud.`
      });
    } catch (error) {
      console.error('pushSyncChanges error:', error);
      res.status(500).json({ success: false, message: 'Failed to push sync changes' });
    }
  },

  pullSyncChanges: async (req, res) => {
    try {
      const userId = req.user?.id || 'usr_default';
      const deviceId = req.deviceId || 'DEV_DEFAULT';
      const since = req.query.since ? new Date(req.query.since) : new Date(0);

      const changes = await SyncChange.find({
        userId,
        deviceId: { $ne: deviceId },
        timestamp: { $gt: since }
      })
      .sort({ timestamp: 1 })
      .limit(100)
      .lean()
      .exec();

      res.json({
        success: true,
        changes,
        serverTime: new Date().toISOString()
      });
    } catch (error) {
      console.error('pullSyncChanges error:', error);
      res.status(500).json({ success: false, message: 'Failed to pull sync changes' });
    }
  },

  registerDevice: async (req, res) => {
    try {
      const userId = req.user?.id || 'usr_default';
      const email = req.user?.email || 'admin@gmail.com';
      const deviceId = req.deviceId || 'DEV_DEFAULT';
      const { deviceName = 'Desktop Application' } = req.body || {};

      const device = await Device.findOneAndUpdate(
        { deviceId },
        {
          $set: {
            userId,
            email,
            deviceName,
            lastSync: new Date(),
            status: 'Online'
          }
        },
        { upsert: true, new: true }
      );

      res.json({ success: true, device });
    } catch (error) {
      console.error('registerDevice error:', error);
      res.status(500).json({ success: false, message: 'Failed to register device' });
    }
  },

  getDevices: async (req, res) => {
    try {
      const userId = req.user?.id || 'usr_default';
      const email = req.user?.email || 'admin@gmail.com';

      const devices = await Device.find({
        $or: [{ userId }, { email }]
      })
      .sort({ lastSync: -1 })
      .lean()
      .exec();

      res.json({ success: true, devices });
    } catch (error) {
      console.error('getDevices error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch registered devices' });
    }
  },

  revokeDevice: async (req, res) => {
    try {
      const { deviceId } = req.params;
      const userId = req.user?.id || 'usr_default';

      await Device.deleteOne({ deviceId, userId });
      res.json({ success: true, message: `Device ${deviceId} successfully revoked.` });
    } catch (error) {
      console.error('revokeDevice error:', error);
      res.status(500).json({ success: false, message: 'Failed to revoke device' });
    }
  }
};

module.exports = syncController;
