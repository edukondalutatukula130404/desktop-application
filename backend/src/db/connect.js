const mongoose = require('mongoose');
const { startLocalMongoServer } = require('./localMongo');

let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    return;
  }

  let mongoURI = process.env.MONGO_URI;

  if (mongoURI) {
    try {
      const conn = await mongoose.connect(mongoURI);
      isConnected = !!conn.connections[0].readyState;
      console.log(`=================================`);
      console.log(`🍃 MongoDB Connected (Environment URI): ${conn.connection.host}`);
      console.log(`=================================`);
      return;
    } catch (error) {
      console.warn('⚠️ Could not connect to MONGO_URI, falling back to local storage:', error.message);
    }
  }

  // Attempt local MongoDB on default port first
  try {
    const defaultLocalURI = 'mongodb://127.0.0.1:27017/login_page_db';
    const conn = await mongoose.connect(defaultLocalURI, { serverSelectionTimeoutMS: 2000 });
    isConnected = !!conn.connections[0].readyState;
    console.log(`=================================`);
    console.log(`🍃 MongoDB Connected (Local Service 27017): ${conn.connection.host}`);
    console.log(`=================================`);
    return;
  } catch (err) {
    console.log('ℹ️ Local MongoDB service not active on port 27017. Starting embedded local MongoDB server...');
  }

  // Start embedded local MongoDB server with persistent storage engine
  try {
    const embeddedURI = await startLocalMongoServer();
    const conn = await mongoose.connect(embeddedURI);
    isConnected = !!conn.connections[0].readyState;
    console.log(`=================================`);
    console.log(`🍃 MongoDB Connected (Embedded Persistent Engine)`);
    console.log(`=================================`);
  } catch (error) {
    console.error('❌ Failed to establish MongoDB connection:', error.message);
  }
};

const getDBStatus = () => {
  return mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
};

module.exports = { connectDB, getDBStatus };

