const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    return;
  }

  const mongoURI = process.env.MONGO_URI;

  if (!mongoURI) {
    console.error('❌ MONGO_URI is missing in environment configuration.');
    return;
  }

  try {
    const conn = await mongoose.connect(mongoURI);
    isConnected = !!conn.connections[0].readyState;
    console.log(`=================================`);
    console.log(`🍃 MongoDB Connected: ${conn.connection.host}`);
    console.log(`=================================`);
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    // Don't exit process so app stays responsive even if connection drops temporarily
  }
};

const getDBStatus = () => {
  return mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
};

module.exports = { connectDB, getDBStatus };
