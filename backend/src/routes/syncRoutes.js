const express = require('express');
const router = express.Router();
const syncEngine = require('../services/syncEngine');

// GET /api/sync/status
router.get('/status', async (req, res) => {
  try {
    const status = await syncEngine.getSyncStatus();
    res.json({ success: true, ...status });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/sync/trigger
router.post('/trigger', async (req, res) => {
  try {
    const status = await syncEngine.triggerManualSync();
    res.json({ success: true, message: 'Manual sync triggered', ...status });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
