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

    mongodInstance = await MongoMemoryServer.create({
      instance: {
        dbPath: dbPath,
        storageEngine: 'wiredTiger',
      }
    });

    const uri = mongodInstance.getUri();
    console.log(`[LocalMongo] Persistent local MongoDB running at: ${uri}`);
    return uri;
  } catch (err) {
    console.error('[LocalMongo] Failed to start embedded MongoDB server:', err.message);
    throw err;
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
