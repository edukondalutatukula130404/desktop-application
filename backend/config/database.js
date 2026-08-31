const mongoose = require('mongoose');

async function connectDatabase() {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/invoicepro';

  try {
    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000
    });
    console.log(`=================================`);
    console.log(`🟢 Centralized MongoDB Atlas Connected: ${conn.connection.host}`);
    console.log(`=================================`);
    return conn;
  } catch (error) {
    console.warn(`⚠️ Centralized MongoDB Connection Warning: ${error.message}`);
    return null;
  }
}

function getDatabaseStatus() {
  const readyState = mongoose.connection ? mongoose.connection.readyState : 0;
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  return states[readyState] || 'unknown';
}

module.exports = {
  connectDatabase,
  getDatabaseStatus
};
