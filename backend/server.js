require('dotenv').config();
const express = require('express');
const cors = require('cors');
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
    timestamp: new Date().toISOString(),
    service: 'Authentication & Business Management API'
  });
});

// Authentication & Business Routes
app.use('/api/auth', authRoutes);
app.use('/api/business', businessRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Global Error Handler:', err.stack);
  res.status(500).json({
    success: false,
    message: 'An unexpected server error occurred.'
  });
});

// Start Server
const server = app.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`🚀 Backend Auth Server running on http://localhost:${PORT}`);
  console.log(`=================================`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n⚠️  Port ${PORT} is currently in use by another process.`);
    console.error(`👉 Stop the process occupying port ${PORT} or run on a different port.\n`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
  }
});
