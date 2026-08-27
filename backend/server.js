try { require('dotenv').config(); } catch (e) {}
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { connectDB, getDBStatus } = require('./src/db/connect');
const { initSQLiteDB } = require('./src/db/sqliteDB');
const { startSyncEngine } = require('./src/services/syncEngine');
const authRoutes = require('./src/routes/authRoutes');
const businessRoutes = require('./src/routes/businessRoutes');
const syncRoutes = require('./src/routes/syncRoutes');

const app = express();
const PORT = process.env.PORT || 5050;

// Enable CORS for frontend requests
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

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

// Route to save PDF from base64
app.post('/api/business/invoices/save-pdf', (req, res) => {
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
app.get('/api/business/invoices/download-pdf/:invoiceId', (req, res) => {
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
app.use('/api/auth', authRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/sync', syncRoutes);

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
    console.log('[Express Server] Initializing offline-first local SQLite database...');
    await initSQLiteDB();
  } catch (sqlErr) {
    console.error('[Express Server] SQLite initialization warning:', sqlErr.message);
  }

  try {
    console.log('[Express Server] Connecting background DB connections...');
    await connectDB();
  } catch (dbErr) {
    console.warn('[Express Server] MongoDB Atlas offline mode active:', dbErr.message);
  }

  // Start background 2-way sync engine
  startSyncEngine(5000);
  const HOST = '127.0.0.1';
  const initialPort = parseInt(port || '5050', 10);

  const createServer = (p) => {
    const currentPort = parseInt(p, 10);
    return new Promise((resolve) => {
      const s = app.listen(currentPort, HOST, () => {
        console.log(`=================================`);
        console.log(`🚀 Backend Auth Server running on http://${HOST}:${currentPort}`);
        console.log(`=================================`);
        resolve(s);
      });

      s.on('error', async (err) => {
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
