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

function clearStaleLocks(dirPath) {
  try {
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

  // Check if external MONGO_URI is explicitly provided in env
  if (process.env.MONGO_URI && !process.env.MONGO_URI.includes('127.0.0.1') && !process.env.MONGO_URI.includes('localhost')) {
    console.log('[MongoManager] Using external MONGO_URI from environment.');
    mongoUri = process.env.MONGO_URI;
    return mongoUri;
  }

  const { MongoMemoryServer } = require('mongodb-memory-server');
  const binariesDir = path.join(getAppDataDir(), 'mongo-binaries');
  if (!fs.existsSync(binariesDir)) {
    fs.mkdirSync(binariesDir, { recursive: true });
  }

  // Attempt 1: Primary persistent directory
  const primaryDbPath = path.join(getAppDataDir(), 'mongo-data');
  if (!fs.existsSync(primaryDbPath)) {
    fs.mkdirSync(primaryDbPath, { recursive: true });
  }
  clearStaleLocks(primaryDbPath);

  try {
    console.log(`[MongoManager] Initializing local MongoDB daemon at: ${primaryDbPath}`);
    mongodInstance = await MongoMemoryServer.create({
      instance: {
        dbPath: primaryDbPath,
        storageEngine: 'wiredTiger'
      },
      binary: {
        downloadDir: binariesDir
      }
    });
    mongoUri = mongodInstance.getUri();
    console.log(`[MongoManager] Embedded MongoDB ready at: ${mongoUri}`);
    return mongoUri;
  } catch (err) {
    console.warn('[MongoManager] Primary dbPath launch warning:', err.message);
    clearStaleLocks(primaryDbPath);
  }

  // Attempt 2: Secondary persistent store directory
  const secondaryDbPath = path.join(getAppDataDir(), 'mongo-data-store');
  if (!fs.existsSync(secondaryDbPath)) {
    fs.mkdirSync(secondaryDbPath, { recursive: true });
  }
  clearStaleLocks(secondaryDbPath);

  try {
    console.log(`[MongoManager] Initializing secondary local MongoDB daemon at: ${secondaryDbPath}`);
    mongodInstance = await MongoMemoryServer.create({
      instance: {
        dbPath: secondaryDbPath,
        storageEngine: 'wiredTiger'
      },
      binary: {
        downloadDir: binariesDir
      }
    });
    mongoUri = mongodInstance.getUri();
    console.log(`[MongoManager] Secondary persistent MongoDB ready at: ${mongoUri}`);
    return mongoUri;
  } catch (err2) {
    console.warn('[MongoManager] Secondary dbPath launch warning:', err2.message);
  }

  // Attempt 3: In-memory fallback instance
  try {
    console.log('[MongoManager] Starting ephemeral fallback instance...');
    mongodInstance = await MongoMemoryServer.create();
    mongoUri = mongodInstance.getUri();
    console.log(`[MongoManager] Embedded fallback ready at: ${mongoUri}`);
    return mongoUri;
  } catch (fallbackErr) {
    console.error('[MongoManager] Embedded fallback error:', fallbackErr.message);
    mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/login_page_db';
    return mongoUri;
  }
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
