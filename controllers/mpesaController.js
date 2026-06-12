const axios = require('axios');
const moment = require('moment');

// ==================== GET M-PESA ACCESS TOKEN ====================
async function getAccessToken() {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    throw new Error('M-Pesa credentials missing. Check your .env file.');
  }

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const url = process.env.MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
    : 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';

  console.log('🔑 Getting access token from Safaricom...');

  try {
    const response = await axios.get(url, {
      headers: { Authorization: `Basic ${auth}` }
    });
    console.log('✅ Access token obtained');
    return response.data.access_token;
  } catch (error) {
    console.error('❌ Failed to get access token:', error.response?.data || error.message);
    throw error;
  }
}

// ==================== GENERATE PASSWORD FOR STK PUSH ====================
function generatePassword() {
  const timestamp = moment().format('YYYYMMDDHHmmss');
  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;

  if (!shortcode || !passkey) {
    throw new Error('M-Pesa shortcode or passkey missing');
  }

  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
  return { timestamp, password };
}

// ==================== FORMAT PHONE NUMBER TO 254XXXXXXXXX ====================
function formatPhoneNumber(phone) {
  let formatted = phone.toString().replace(/\s/g, '');
  if (formatted.startsWith('0')) {
    formatted = '254' + formatted.substring(1);
  } else if (formatted.startsWith('+')) {
    formatted = formatted.substring(1);
  } else if (formatted.startsWith('7')) {
    formatted = '254' + formatted;
  }
  return formatted;
}

// ==================== STK PUSH FUNCTION ====================
async function stkPush(phoneNumber, amount, accountReference, transactionDesc) {
  try {
    const accessToken = await getAccessToken();
    const { timestamp, password } = generatePassword();
    const formattedPhone = formatPhoneNumber(phoneNumber);
    const shortcode = process.env.MPESA_SHORTCODE;

    const url = process.env.MPESA_ENV === 'production'
      ? 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
      : 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

    const requestBody = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amount),
      PartyA: formattedPhone,
      PartyB: shortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: process.env.MPESA_CALLBACK_URL,
      AccountReference: accountReference.substring(0, 12),
      TransactionDesc: (transactionDesc || 'Rent Payment').substring(0, 13)
    };

    console.log('📤 Sending STK Push request to Safaricom...');
    console.log(`   Phone: ${formattedPhone}, Amount: KES ${amount}, Ref: ${accountReference}`);

    const response = await axios.post(url, requestBody, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data.ResponseCode === '0') {
      console.log('✅ STK Push sent successfully. CheckoutRequestID:', response.data.CheckoutRequestID);
      return {
        success: true,
        checkoutRequestID: response.data.CheckoutRequestID,
        data: response.data
      };
    } else {
      console.error('❌ STK Push failed:', response.data.ResponseDescription);
      return {
        success: false,
        error: response.data.ResponseDescription || 'STK Push failed'
      };
    }
  } catch (error) {
    console.error('❌ STK Push error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.errorMessage || error.message
    };
  }
}

// ==================== QUERY STK PUSH STATUS ====================
async function querySTKStatus(checkoutRequestID) {
  try {
    const accessToken = await getAccessToken();
    const { timestamp, password } = generatePassword();
    const shortcode = process.env.MPESA_SHORTCODE;

    const url = process.env.MPESA_ENV === 'production'
      ? 'https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query'
      : 'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query';

    const requestBody = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestID
    };

    console.log('🔍 Querying payment status for:', checkoutRequestID);

    const response = await axios.post(url, requestBody, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Query response:', response.data.ResultCode, response.data.ResultDesc);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('❌ Query error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.errorMessage || error.message
    };
  }
}

// ==================== HANDLE M-PESA CALLBACK ====================
async function handleCallback(req, res) {
  const callbackData = req.body;
  console.log('📞 M-Pesa Callback received');

  const stkCallback = callbackData.Body?.stkCallback;
  if (!stkCallback) {
    console.error('❌ Invalid callback structure');
    return res.json({ ResultCode: 1, ResultDesc: 'Invalid callback structure' });
  }

  const resultCode = stkCallback.ResultCode;
  const resultDesc = stkCallback.ResultDesc;
  const checkoutRequestID = stkCallback.CheckoutRequestID;
  const merchantRequestID = stkCallback.MerchantRequestID;

  console.log(`   Result Code: ${resultCode}`);
  console.log(`   Result Description: ${resultDesc}`);
  console.log(`   CheckoutRequestID: ${checkoutRequestID}`);

  if (resultCode === 0) {
    // Payment successful - extract metadata
    const callbackMetadata = stkCallback.CallbackMetadata?.Item || [];
    const amount = callbackMetadata.find(item => item.Name === 'Amount')?.Value;
    const mpesaReceiptNumber = callbackMetadata.find(item => item.Name === 'MpesaReceiptNumber')?.Value;
    const transactionDate = callbackMetadata.find(item => item.Name === 'TransactionDate')?.Value;
    const phoneNumber = callbackMetadata.find(item => item.Name === 'PhoneNumber')?.Value;

    console.log('✅✅✅ PAYMENT SUCCESSFUL! ✅✅✅');
    console.log(`   Amount: KES ${amount}`);
    console.log(`   Receipt Number: ${mpesaReceiptNumber}`);
    console.log(`   Phone: ${phoneNumber}`);
    console.log(`   Transaction Date: ${transactionDate}`);

    // TODO: Update your database here
    // await updatePaymentStatus(checkoutRequestID, {
    //   status: 'completed',
    //   amount: amount,
    //   mpesaReceiptNumber: mpesaReceiptNumber,
    //   transactionDate: transactionDate,
    //   phoneNumber: phoneNumber
    // });
  } else {
    console.log(`❌❌❌ PAYMENT FAILED: ${resultDesc}`);
    // TODO: Update database with failure status
  }

  // Always respond with success to Safaricom
  res.json({ ResultCode: 0, ResultDesc: 'Success' });
}

module.exports = {
  stkPush,
  querySTKStatus,
  handleCallback,
  getAccessToken  // exported for testing
};