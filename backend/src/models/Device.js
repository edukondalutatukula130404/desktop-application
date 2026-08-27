const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  email: { type: String, required: true, index: true },
  deviceName: { type: String, default: 'Desktop Application' },
  lastSync: { type: Date, default: Date.now },
  status: { type: String, enum: ['Online', 'Offline'], default: 'Online' }
}, {
  timestamps: true
});

module.exports = mongoose.model('Device', deviceSchema);
