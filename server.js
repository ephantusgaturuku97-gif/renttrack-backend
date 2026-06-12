const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import routes
const authRoutes = require('./routes/auth');
const mpesaRoutes = require('./routes/mpesa');
const paymentRoutes = require('./routes/payments');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/mpesa', mpesaRoutes);
app.use('/api/payments', paymentRoutes);

// ========== HEALTH CHECK (FIXED) ==========
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'RentTrack API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.MPESA_ENV || 'sandbox'
  });
});

// Root endpoint
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

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
