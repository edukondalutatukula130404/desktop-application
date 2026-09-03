const fs = require('fs');
const path = require('path');
const os = require('os');

let mongodInstance = null;

/**
 * Starts a persistent local MongoDB server instance using mongodb-memory-server
 * with storage engine set to wiredTiger and dbPath set to OS APPDATA / user folder.
 */
async function startLocalMongoServer() {
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');

    const appDataDir = process.env.APPDATA || (process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Preferences') : path.join(os.homedir(), '.config'));
    const dbPath = path.join(appDataDir, 'InvoiceProDesktop', 'mongo-data');

    if (!fs.existsSync(dbPath)) {
      fs.mkdirSync(dbPath, { recursive: true });
    }

    const lockFile = path.join(dbPath, 'mongod.lock');
    if (fs.existsSync(lockFile)) {
      try {
        fs.unlinkSync(lockFile);
        console.log('[LocalMongo] Cleaned up stale mongod.lock file.');
      } catch (e) {}
    }

    console.log(`[LocalMongo] Initializing embedded MongoDB server at: ${dbPath}`);

    try {
      mongodInstance = await MongoMemoryServer.create({
        instance: {
          dbPath: dbPath,
          storageEngine: 'wiredTiger',
        }
      });
      const uri = mongodInstance.getUri();
      console.log(`[LocalMongo] Persistent local MongoDB running at: ${uri}`);
      return uri;
    } catch (createErr) {
      console.warn('[LocalMongo] MongoMemoryServer launch warning, falling back to local port 27017:', createErr.message);
      return 'mongodb://127.0.0.1:27017/login_page_db';
    }
  } catch (err) {
    console.error('[LocalMongo] Embedded MongoDB server fallback notice:', err.message);
    return 'mongodb://127.0.0.1:27017/login_page_db';
  }
}

async function stopLocalMongoServer() {
  if (mongodInstance) {
    console.log('[LocalMongo] Stopping embedded MongoDB server...');
    await mongodInstance.stop();
    mongodInstance = null;
  }
}

module.exports = {
  startLocalMongoServer,
  stopLocalMongoServer
};
