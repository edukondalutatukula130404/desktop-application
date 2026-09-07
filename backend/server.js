try { require('dotenv').config(); } catch (e) {}
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { connectDatabase } = require('./config/database');
const { connectDB, getDBStatus } = require('./src/db/connect');
const { startSyncEngine } = require('./src/services/syncEngine');
const authRoutes = require('./src/routes/authRoutes');
const businessRoutes = require('./src/routes/businessRoutes');
const syncRoutes = require('./src/routes/syncRoutes');
const licenseClientRoutes = require('./src/routes/licenseClientRoutes');
const licenseMiddleware = require('./src/middleware/licenseMiddleware');
const licenseState = require('./src/licensing/licenseState');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for all frontend requests & allow custom headers (x-device-id)
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-device-id, X-Device-Id, x-company-id, X-Company-Id, x-user-id, X-User-Id, cache-control, pragma');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Body Parser Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Healthcheck Route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    database: getDBStatus(),
    timestamp: new Date().toISOString(),
    service: 'Authentication & Business Management API (Offline-First / Cloud Sync)'
  });
});

// Ensure invoices storage folder exists
const invoicesDir = path.join(__dirname, 'data', 'invoices');
if (!fs.existsSync(invoicesDir)) {
  fs.mkdirSync(invoicesDir, { recursive: true });
}

// Local (on-device) license endpoints — reachable before login and while locked.
app.use('/api/license', licenseClientRoutes);

// Route to save PDF from base64
app.post('/api/business/invoices/save-pdf', licenseMiddleware, (req, res) => {
  try {
    const { invoiceId, base64Data } = req.body;
    if (!invoiceId || !base64Data) {
      return res.status(400).json({ success: false, message: 'invoiceId and base64Data required' });
    }
    const cleanId = String(invoiceId).replace(/[^a-zA-Z0-9_-]/g, '');
    const pdfPath = path.join(invoicesDir, `${cleanId}.pdf`);
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(pdfPath, buffer);

    const downloadUrl = `http://localhost:${PORT}/api/business/invoices/download-pdf/${cleanId}`;
    return res.json({ success: true, downloadUrl });
  } catch (err) {
    console.error('Error saving PDF on server:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Route to download PDF file
app.get('/api/business/invoices/download-pdf/:invoiceId', licenseMiddleware, (req, res) => {
  try {
    const cleanId = String(req.params.invoiceId).replace(/[^a-zA-Z0-9_-]/g, '');
    const pdfPath = path.join(invoicesDir, `${cleanId}.pdf`);
    if (fs.existsSync(pdfPath)) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="Invoice_${cleanId}.pdf"`);
      return res.sendFile(pdfPath);
    }
    return res.status(404).send('Invoice PDF not found.');
  } catch (err) {
    return res.status(500).send('Error serving PDF.');
  }
});

// Authentication, Business & Sync Routes
// Business + sync data APIs are gated by the license layer (defense-in-depth:
// they stop responding the moment the license lapses, independent of the UI).
app.use('/api/auth', authRoutes);
app.use('/api/business', licenseMiddleware, businessRoutes);
app.use('/api/sync', licenseMiddleware, syncRoutes);

// Serve Frontend Static Dist Assets (Production Desktop App)
const frontendDist = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

const http = require('http');
const { initSocket } = require('./src/services/socketService');

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Global Error Handler:', err.stack);
  res.status(500).json({
    success: false,
    message: 'An unexpected server error occurred.'
  });
});

// Start Server helper function
async function startServer(port = PORT) {
  try {
    console.log('[Express Server] Connecting background DB connections...');
    await connectDB();
  } catch (dbErr) {
    console.warn('[Express Server] MongoDB Atlas offline mode active:', dbErr.message);
  }

  // License enforcement: load any activated license and start a coarse refresh
  // loop. In the packaged app, electron/main.cjs calls licenseState.init() again
  // with the DPAPI-backed vault + real machine fingerprint and owns the
  // authoritative monotonic watchdog (Phase 4); this timer is the fallback.
  try {
    licenseState.init();
    await licenseState.evaluate().catch(() => {});
    if (!global.__licenseRefreshTimer) {
      global.__licenseRefreshTimer = setInterval(() => {
        licenseState.evaluate().catch(() => {});
      }, 20 * 1000);
      global.__licenseRefreshTimer.unref && global.__licenseRefreshTimer.unref();
    }
  } catch (licErr) {
    console.warn('[Express Server] license init warning:', licErr.message);
  }

  // Start background 2-way sync engine
  startSyncEngine(5000);
  const HOST = '0.0.0.0';
  const initialPort = parseInt(port || '5050', 10);

  const createServer = (p) => {
    const currentPort = parseInt(p, 10);
    return new Promise((resolve) => {
      const server = http.createServer(app);
      initSocket(server);

      server.listen(currentPort, HOST, () => {
        console.log(`=================================`);
        console.log(`🚀 Backend Real-Time Server running on http://${HOST}:${currentPort}`);
        console.log(`⚡ Socket.IO Cloud Real-Time Sync Active`);
        console.log(`=================================`);
        resolve(server);
      });

      server.on('error', async (err) => {
        if (err.code === 'EADDRINUSE') {
          const nextPort = currentPort + 1;
          console.warn(`⚠️ Port ${currentPort} in use, trying port ${nextPort}...`);
          const fallbackServer = await createServer(nextPort);
          resolve(fallbackServer);
        } else {
          console.error('Server error:', err);
          resolve(null);
        }
      });
    });
  };

  return await createServer(initialPort);
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer, PORT };

