try { require('dotenv').config(); } catch (e) {}
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { connectDB, getDBStatus } = require('./src/db/connect');
const authRoutes = require('./src/routes/authRoutes');
const businessRoutes = require('./src/routes/businessRoutes');

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
    service: 'Authentication & Business Management API (Local / Cloud)'
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

// Authentication & Business Routes
app.use('/api/auth', authRoutes);
app.use('/api/business', businessRoutes);

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
  await connectDB();
  const HOST = '127.0.0.1';
  const server = app.listen(port, HOST, () => {
    console.log(`=================================`);
    console.log(`🚀 Backend Auth Server running on http://${HOST}:${port}`);
    console.log(`=================================`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n⚠️  Port ${port} is currently in use by another process.`);
      console.error(`👉 Stop the process occupying port ${port} or run on a different port.\n`);
    } else {
      console.error('Server error:', err);
    }
  });

  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer, PORT };
