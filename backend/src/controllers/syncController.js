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

      const device = await Device.findOneAndUpdate(
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

      // Emit real-time socket event to all devices in company room
      try {
        const { emitToCompany } = require('../services/socketService');
        emitToCompany(companyId, 'device:registered', { device });
      } catch (e) {}

      res.json({ success: true, device });
    } catch (error) {
      console.error('registerDevice error:', error.message);
      res.status(500).json({ success: false, message: 'Failed to register device' });
    }
  },

  getDevices: async (req, res) => {
    try {
      const companyId = req.user?.companyId || req.query?.companyId || 'shop_default';
      const userId = req.user?.id || req.query?.userId || 'usr_offline';
      const email = req.user?.email || req.query?.email || '';

      const devices = await Device.find({
        $or: [
          { companyId },
          { userId },
          ...(email ? [{ email }] : [])
        ]
      })
      .sort({ lastSync: -1 })
      .lean()
      .exec();

      res.json({ success: true, devices: devices || [] });
    } catch (error) {
      console.error('getDevices error:', error.message);
      res.status(500).json({ success: false, message: 'Failed to fetch registered devices' });
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
  }
};

module.exports = syncController;
