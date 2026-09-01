const fs = require('fs');
const path = require('path');
const os = require('os');
const sqlite3 = require('sqlite3').verbose();
const { randomUUID } = require('crypto');
const uuidv4 = () => randomUUID();

let db = null;
let currentDeviceId = null;

function getStorageDir() {
  const appDataDir = process.env.APPDATA || (process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Preferences') : path.join(os.homedir(), '.config'));
  const dbDir = path.join(appDataDir, 'InvoiceProDesktop', 'local-sqlite');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  return dbDir;
}

function initSQLiteDB() {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);

    const dbDir = getStorageDir();
    const dbPath = path.join(dbDir, 'nexus_local.db');
    console.log(`[SQLite DB] Opening local embedded database at: ${dbPath}`);

    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('[SQLite DB] Connection error:', err.message);
        return reject(err);
      }
      
      // Enable WAL mode and foreign keys for high performance local reads/writes
      db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;`, async (pragmaErr) => {
        if (pragmaErr) console.warn('[SQLite DB] PRAGMA warning:', pragmaErr.message);

        try {
          await createTables();
          await ensureDeviceRegistered();
          console.log(`[SQLite DB] Local database initialized. Device ID: ${currentDeviceId}`);
          resolve(db);
        } catch (tableErr) {
          console.error('[SQLite DB] Schema creation error:', tableErr);
          reject(tableErr);
        }
      });
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function dbExec(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

async function createTables() {
  const schema = `
    CREATE TABLE IF NOT EXISTS devices (
      device_id TEXT PRIMARY KEY,
      device_name TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      subCategory TEXT,
      color TEXT,
      size TEXT,
      price REAL DEFAULT 0,
      stock TEXT DEFAULT 'In Stock',
      count INTEGER DEFAULT 0,
      updated_at TEXT,
      device_id TEXT,
      version INTEGER DEFAULT 1,
      sync_status TEXT DEFAULT 'PENDING'
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      contact TEXT,
      status TEXT DEFAULT 'Active',
      totalBilled REAL DEFAULT 0,
      updated_at TEXT,
      device_id TEXT,
      version INTEGER DEFAULT 1,
      sync_status TEXT DEFAULT 'PENDING'
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact TEXT,
      category TEXT,
      status TEXT DEFAULT 'Active',
      updated_at TEXT,
      device_id TEXT,
      version INTEGER DEFAULT 1,
      sync_status TEXT DEFAULT 'PENDING'
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      subCategories TEXT,
      status TEXT DEFAULT 'Active',
      productCount INTEGER DEFAULT 0,
      updated_at TEXT,
      device_id TEXT,
      version INTEGER DEFAULT 1,
      sync_status TEXT DEFAULT 'PENDING'
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      clientId TEXT,
      clientName TEXT,
      clientEmail TEXT,
      issueDate TEXT,
      dueDate TEXT,
      amount REAL DEFAULT 0,
      subtotal REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      status TEXT DEFAULT 'Paid',
      category TEXT,
      paymentMode TEXT DEFAULT 'Cash',
      notes TEXT,
      updated_at TEXT,
      device_id TEXT,
      version INTEGER DEFAULT 1,
      sync_status TEXT DEFAULT 'PENDING'
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id TEXT PRIMARY KEY,
      invoiceId TEXT NOT NULL,
      productName TEXT,
      category TEXT,
      subCategory TEXT,
      color TEXT,
      size TEXT,
      qty INTEGER DEFAULT 1,
      price REAL DEFAULT 0,
      subtotal REAL DEFAULT 0,
      FOREIGN KEY(invoiceId) REFERENCES invoices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bills (
      id TEXT PRIMARY KEY,
      vendor TEXT NOT NULL,
      category TEXT,
      dueDate TEXT,
      amount REAL DEFAULT 0,
      status TEXT DEFAULT 'Unpaid',
      autoPay INTEGER DEFAULT 0,
      updated_at TEXT,
      device_id TEXT,
      version INTEGER DEFAULT 1,
      sync_status TEXT DEFAULT 'PENDING'
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT DEFAULT 'PENDING',
      retry_count INTEGER DEFAULT 0,
      last_error TEXT,
      synced_at TEXT,
      device_id TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_metadata (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT
    );
  `;
  await dbExec(schema);
}

async function ensureDeviceRegistered() {
  const row = await dbGet(`SELECT device_id FROM devices LIMIT 1`);
  if (row && row.device_id) {
    currentDeviceId = row.device_id;
  } else {
    currentDeviceId = `DEV-${uuidv4().substring(0, 8)}`;
    const hostname = os.hostname() || 'DesktopApp';
    const now = new Date().toISOString();
    await dbRun(`INSERT INTO devices (device_id, device_name, created_at) VALUES (?, ?, ?)`, [
      currentDeviceId,
      hostname,
      now
    ]);
  }
  return currentDeviceId;
}

function getDeviceId() {
  return currentDeviceId || 'DEV-DEFAULT';
}

module.exports = {
  initSQLiteDB,
  dbRun,
  dbGet,
  dbAll,
  dbExec,
  getDeviceId
};
