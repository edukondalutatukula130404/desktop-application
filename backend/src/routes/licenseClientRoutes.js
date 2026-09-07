const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/licenseClientController');

let activationLimiter = (req, res, next) => next();
try {
  // reuse the auth rate limiter if present
  activationLimiter = require('../middleware/rateLimiter').authLimiter || activationLimiter;
} catch (e) {}

// These endpoints are intentionally NOT behind authMiddleware or licenseMiddleware:
// the renderer must reach them before login and while the app is locked.
router.get('/status', ctrl.getStatus);
router.post('/activate', activationLimiter, ctrl.activate);
router.post('/refresh', ctrl.refresh);

module.exports = router;
