const deviceMiddleware = (req, res, next) => {
  const deviceId = req.headers['x-device-id'] || req.query.deviceId || 'DEV_DEFAULT';
  req.deviceId = String(deviceId).trim();
  next();
};

module.exports = deviceMiddleware;
