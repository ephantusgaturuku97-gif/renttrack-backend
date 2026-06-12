const express = require('express');
const router = express.Router();
const mpesaController = require('../controllers/mpesaController');

// ==================== STK PUSH (Initiate Payment) ====================
// POST /api/mpesa/stkpush
router.post('/stkpush', async (req, res) => {
  const { phoneNumber, amount, accountReference, transactionDesc } = req.body;

  // Validate required fields
  if (!phoneNumber) {
    return res.status(400).json({
      success: false,
      error: 'Phone number is required'
    });
  }
  if (!amount || amount <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Valid amount is required'
    });
  }
  if (!accountReference) {
    return res.status(400).json({
      success: false,
      error: 'Account reference is required'
    });
  }

  console.log(`📱 STK Push request: ${phoneNumber}, amount: KES ${amount}, ref: ${accountReference}`);

  try {
    const result = await mpesaController.stkPush(
      phoneNumber,
      amount,
      accountReference,
      transactionDesc || 'Rent Payment'
    );

    if (result.success) {
      res.json({
        success: true,
        checkoutRequestID: result.checkoutRequestID,
        message: 'STK Push sent successfully. Check your phone for the M-Pesa prompt.'
      });
    } else {
      console.error('STK Push failed:', result.error);
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to send STK Push'
      });
    }
  } catch (error) {
    console.error('STK Push exception:', error.message);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// ==================== QUERY STK PUSH STATUS ====================
// POST /api/mpesa/query
router.post('/query', async (req, res) => {
  const { checkoutRequestID } = req.body;

  if (!checkoutRequestID) {
    return res.status(400).json({
      success: false,
      error: 'CheckoutRequestID is required'
    });
  }

  try {
    const result = await mpesaController.querySTKStatus(checkoutRequestID);
    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to query payment status'
      });
    }
  } catch (error) {
    console.error('Query exception:', error.message);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// ==================== M-PESA CALLBACK (Receives payment confirmation) ====================
// POST /api/mpesa/callback
router.post('/callback', async (req, res) => {
  console.log('📞 M-Pesa Callback received');
  console.log('Callback body:', JSON.stringify(req.body, null, 2));

  try {
    await mpesaController.handleCallback(req, res);
  } catch (error) {
    console.error('Callback processing error:', error.message);
    // Always respond to Safaricom to avoid retries
    res.status(500).json({ ResultCode: 1, ResultDesc: 'Failed to process callback' });
  }
});

// ==================== SIMULATE PAYMENT (For testing without M-Pesa) ====================
// POST /api/mpesa/simulate
router.post('/simulate', (req, res) => {
  const { phoneNumber, amount, accountReference } = req.body;

  if (!phoneNumber || !amount || !accountReference) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields'
    });
  }

  const simulatedResult = {
    success: true,
    checkoutRequestID: 'SIM_' + Date.now(),
    message: 'Simulated payment successful (testing mode)',
    mpesaReceiptNumber: 'SIM' + Math.floor(Math.random() * 1000000),
    amount: amount,
    phoneNumber: phoneNumber,
    accountReference: accountReference
  };

  console.log('🎮 Simulated payment:', simulatedResult);
  res.json(simulatedResult);
});

module.exports = router;