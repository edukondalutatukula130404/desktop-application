const fs = require('fs');
const path = require('path');
const os = require('os');

let mongodInstance = null;
let mongoUri = null;

/**
 * Returns the default persistent application data directory for MongoDB
 */
function getAppDataDir() {
  if (process.env.APPDATA) {
    return path.join(process.env.APPDATA, 'InvoiceProDesktop');
  }
  const home = os.homedir();
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'InvoiceProDesktop');
  }
  return path.join(home, '.config', 'InvoiceProDesktop');
}

const { execSync } = require('child_process');

function clearStaleLocks(dirPath) {
  try {
    if (process.platform === 'win32') {
      try {
        execSync('taskkill /F /IM mongod.exe /T', { stdio: 'ignore' });
      } catch (e) {}
    }
    const lockFiles = ['mongod.lock', 'WiredTiger.lock', 'WiredTiger.turtle.set'];
    lockFiles.forEach((file) => {
      const p = path.join(dirPath, file);
      if (fs.existsSync(p)) {
        try { fs.unlinkSync(p); } catch (e) {}
      }
    });
  } catch (e) {}
}

/**
 * Starts persistent local MongoDB instance or returns existing connection string
 */
async function startMongo() {
  if (mongodInstance) {
    return mongoUri;
  }

  try {
    require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
  } catch (e) {}

  // Check if external MONGO_URI is explicitly provided in env
  if (process.env.MONGO_URI && !process.env.MONGO_URI.includes('127.0.0.1') && !process.env.MONGO_URI.includes('localhost')) {
    console.log('[MongoManager] Using external MONGO_URI from environment.');
    mongoUri = process.env.MONGO_URI;
    return mongoUri;
  }

  const startMongoInternal = async () => {
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const binariesDir = path.join(getAppDataDir(), 'mongo-binaries');
      if (!fs.existsSync(binariesDir)) {
        fs.mkdirSync(binariesDir, { recursive: true });
      }

      const primaryDbPath = path.join(getAppDataDir(), 'mongo-data');
      if (!fs.existsSync(primaryDbPath)) {
        fs.mkdirSync(primaryDbPath, { recursive: true });
      }
      clearStaleLocks(primaryDbPath);

      mongodInstance = await MongoMemoryServer.create({
        instance: { dbPath: primaryDbPath, storageEngine: 'wiredTiger' },
        binary: { downloadDir: binariesDir }
      });
      mongoUri = mongodInstance.getUri();
      console.log(`[MongoManager] Embedded MongoDB ready at: ${mongoUri}`);
      return mongoUri;
    } catch (err) {
      console.warn('[MongoManager] Embedded MongoDB launch fallback:', err.message);
      return process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/login_page_db';
    }
  };

  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => {
      resolve('mongodb://127.0.0.1:27017/login_page_db');
    }, 2500);
  });

  try {
    mongoUri = await Promise.race([startMongoInternal(), timeoutPromise]);
  } catch (e) {
    mongoUri = 'mongodb://127.0.0.1:27017/login_page_db';
  }

  return mongoUri;
}


/**
 * Stops local MongoDB instance on application quit
 */
async function stopMongo() {
  if (mongodInstance) {
    console.log('[MongoManager] Shutting down embedded MongoDB instance...');
    await mongodInstance.stop();
    mongodInstance = null;
    mongoUri = null;
  }
}

function getUri() {
  return mongoUri;
}

module.exports = {
  startMongo,
  stopMongo,
  getUri,
  getAppDataDir
};
