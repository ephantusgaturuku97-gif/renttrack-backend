const express = require('express');
const router = express.Router();

// ==================== IN-MEMORY PAYMENT STORAGE ====================
// In production, replace with a real database
let payments = [];

// ==================== GET ALL PAYMENTS ====================
// GET /api/payments
router.get('/', (req, res) => {
  res.json({
    success: true,
    count: payments.length,
    payments: payments
  });
});

// ==================== GET PAYMENT BY ID ====================
// GET /api/payments/:id
router.get('/:id', (req, res) => {
  const paymentId = req.params.id;
  const payment = payments.find(p => p.id === paymentId);

  if (!payment) {
    return res.status(404).json({
      success: false,
      error: 'Payment not found'
    });
  }

  res.json({
    success: true,
    payment: payment
  });
});

// ==================== GET PAYMENTS BY TENANT ====================
// GET /api/payments/tenant/:tenantId
router.get('/tenant/:tenantId', (req, res) => {
  const tenantId = req.params.tenantId;
  const tenantPayments = payments.filter(p => p.tenantId === tenantId);

  res.json({
    success: true,
    count: tenantPayments.length,
    payments: tenantPayments
  });
});

// ==================== CREATE NEW PAYMENT RECORD ====================
// POST /api/payments
router.post('/', (req, res) => {
  const {
    tenantId,
    tenantName,
    unit,
    amount,
    paymentMethod,
    transactionReference,
    mpesaReceiptNumber,
    status
  } = req.body;

  // Validate required fields
  if (!tenantId || !amount) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: tenantId and amount'
    });
  }

  const newPayment = {
    id: 'PAY_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    tenantId: tenantId,
    tenantName: tenantName || 'Unknown',
    unit: unit || 'N/A',
    amount: amount,
    paymentMethod: paymentMethod || 'M-Pesa',
    transactionReference: transactionReference || mpesaReceiptNumber || 'TXN_' + Date.now(),
    mpesaReceiptNumber: mpesaReceiptNumber || null,
    status: status || 'completed',
    paymentDate: new Date().toISOString(),
    monthFor: new Date().toLocaleString('default', { month: 'long', year: 'numeric' })
  };

  payments.unshift(newPayment); // Add to beginning of array

  console.log(`💰 Payment recorded: ${newPayment.id} for ${tenantName} (${unit}) - KES ${amount}`);

  res.status(201).json({
    success: true,
    message: 'Payment recorded successfully',
    payment: newPayment
  });
});

// ==================== CONFIRM PAYMENT (Mark as confirmed) ====================
// PUT /api/payments/:id/confirm
router.put('/:id/confirm', (req, res) => {
  const paymentId = req.params.id;
  const payment = payments.find(p => p.id === paymentId);

  if (!payment) {
    return res.status(404).json({
      success: false,
      error: 'Payment not found'
    });
  }

  payment.status = 'confirmed';
  payment.confirmedAt = new Date().toISOString();

  res.json({
    success: true,
    message: 'Payment confirmed successfully',
    payment: payment
  });
});

// ==================== GET PAYMENT SUMMARY STATISTICS ====================
// GET /api/payments/summary/stats
router.get('/summary/stats', (req, res) => {
  const totalPayments = payments.length;
  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const completedPayments = payments.filter(p => p.status === 'completed').length;
  const pendingPayments = payments.filter(p => p.status === 'pending').length;

  // Group by month
  const paymentsByMonth = {};
  payments.forEach(p => {
    const month = p.paymentDate.substring(0, 7); // YYYY-MM
    if (!paymentsByMonth[month]) {
      paymentsByMonth[month] = { count: 0, amount: 0 };
    }
    paymentsByMonth[month].count++;
    paymentsByMonth[month].amount += p.amount;
  });

  res.json({
    success: true,
    summary: {
      totalPayments: totalPayments,
      totalAmount: totalAmount,
      completedPayments: completedPayments,
      pendingPayments: pendingPayments,
      averagePayment: totalPayments > 0 ? totalAmount / totalPayments : 0
    },
    paymentsByMonth: paymentsByMonth
  });
});

// ==================== DELETE PAYMENT (Admin only) ====================
// DELETE /api/payments/:id
router.delete('/:id', (req, res) => {
  const paymentId = req.params.id;
  const paymentIndex = payments.findIndex(p => p.id === paymentId);

  if (paymentIndex === -1) {
    return res.status(404).json({
      success: false,
      error: 'Payment not found'
    });
  }

  payments.splice(paymentIndex, 1);

  res.json({
    success: true,
    message: 'Payment deleted successfully'
  });
});

// ==================== CLEAR ALL PAYMENTS (Testing only) ====================
// DELETE /api/payments
router.delete('/', (req, res) => {
  payments = [];
  res.json({
    success: true,
    message: 'All payments cleared'
  });
});

module.exports = router;