const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  action: { type: String, required: true },
  target: { type: String, default: '' },
  user: { type: String, default: 'System' },
  timestamp: { type: String, default: () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
  icon: { type: String, default: 'Activity' },
  color: { type: String, default: 'var(--accent-primary)' }
}, {
  timestamps: true
});

module.exports = mongoose.model('ActivityLog', activityLogSchema);
