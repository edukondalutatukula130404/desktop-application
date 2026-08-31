const path = require('path');
try { require('dotenv').config({ path: path.join(__dirname, '../../.env') }); } catch (e) {}
const mongoose = require('mongoose');
const { startLocalMongoServer } = require('./localMongo');

let isConnected = false;
let isAtlasConnected = false;

const DEFAULT_ATLAS_URI = 'mongodb://tatukulaedukondalu_db_user:NEXUSSUITE@ac-73qhkjq-shard-00-00.qdjwbzw.mongodb.net:27017,ac-73qhkjq-shard-00-01.qdjwbzw.mongodb.net:27017,ac-73qhkjq-shard-00-02.qdjwbzw.mongodb.net:27017/test?ssl=true&replicaSet=atlas-ogncp9-shard-0&authSource=admin&appName=Cluster0';

const connectDB = async () => {
  if (isConnected && isAtlasConnected) {
    return;
  }

  let mongoURI = process.env.MONGO_URI || DEFAULT_ATLAS_URI;

  if (mongoURI) {
    try {
      console.log('🍃 Connecting to Shared MongoDB Atlas Database...');
      const conn = await mongoose.connect(mongoURI, {
        serverSelectionTimeoutMS: 8000,
        connectTimeoutMS: 8000,
        socketTimeoutMS: 20000
      });
      isConnected = !!conn.connections[0].readyState;
      console.log(`=================================`);
      console.log(`🍃 Shared MongoDB Atlas Connected: ${conn.connection.host} (Database: ${conn.connection.name})`);
      console.log(`=================================`);

      try {
        const Invoice = require('../models/Invoice');
        await Invoice.collection.dropIndex('id_1');
      } catch (dropErr) {}

      try {
        const Client = require('../models/Client');
        await Client.collection.dropIndex('id_1');
        console.log('🍃 [MongoDB Atlas] Legacy unique index id_1 on clients dropped.');
      } catch (dropErr) {}

      return;

    } catch (error) {
      console.warn('⚠️ Could not connect to MongoDB Atlas, falling back to local database:', error.message);
    }
  }

  // Attempt local MongoDB on default port first
  try {
    const defaultLocalURI = 'mongodb://127.0.0.1:27017/login_page_db';
    const conn = await mongoose.connect(defaultLocalURI, { serverSelectionTimeoutMS: 1000 });
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

