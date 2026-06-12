const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

const app = express();

// ==================== MIDDLEWARE ====================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==================== ROUTES ====================
// Import route modules
const authRoutes = require('./routes/auth');
const mpesaRoutes = require('./routes/mpesa');
const paymentRoutes = require('./routes/payments');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/mpesa', mpesaRoutes);
app.use('/api/payments', paymentRoutes);

// ==================== HEALTH & ROOT ENDPOINTS ====================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'RentTrack API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.MPESA_ENV || 'sandbox'
  });
});

app.get('/', (req, res) => {
  res.json({
    name: 'RentTrack Payment Backend',
    version: '1.0.0',
    status: 'online',
    endpoints: {
      health: 'GET /api/health',
      login: 'POST /api/auth/login',
      register: 'POST /api/auth/register',
      stkpush: 'POST /api/mpesa/stkpush',
      callback: 'POST /api/mpesa/callback',
      payments: 'GET /api/payments'
    }
  });
});

// ==================== ERROR HANDLER ====================
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════╗
║   🚀 RentTrack Backend Server Started!             ║
║   📍 Port: ${PORT}                                      ║
║   🌍 Environment: ${process.env.MPESA_ENV || 'sandbox'}     ║
║   📡 API URL: http://localhost:${PORT}/api/health       ║
╚════════════════════════════════════════════════════╝
  `);
});