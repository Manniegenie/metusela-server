// banklinking.js
const express = require('express');
const axios = require('axios');
const { BankAccountLog } = require('../Userschema'); // Import only BankAccountLog
const config = require('./config');

const app = express();

// Middleware
app.use(express.json());

// Verify Webhook Middleware
function verifyWebhook(req, res, next) {
  const webhookSecret = req.headers['mono-webhook-secret'];
  if (!webhookSecret || webhookSecret !== config.monoWebhookSecret) {
    return res.status(401).json({ error: 'Invalid or missing webhook secret' });
  }
  next();
}

// Webhook Endpoint
app.post('/webhook', verifyWebhook, async (req, res) => {
  const webhook = req.body;

  if (webhook.event !== 'mono.events.account_updated') {
    return res.sendStatus(200);
  }

  try {
    const { account } = webhook.data;
    const monoAccountId = account._id;

    const existingLog = await BankAccountLog.findOne({ monoAccountId });

    if (existingLog && !existingLog.walletAddress.startsWith('unclaimed_')) {
      return res.json({
        status: 'successful',
        message: 'Account already linked',
        data: {
          id: existingLog._id,
          monoAccountId: existingLog.monoAccountId,
          walletAddress: existingLog.walletAddress,
          createdAt: existingLog.createdAt,
        },
      });
    }

    const logEntry = await BankAccountLog.findOneAndUpdate(
      { monoAccountId },
      {
        $set: {
          walletAddress: existingLog?.walletAddress || `unclaimed_${monoAccountId}`,
        },
      },
      { upsert: true, new: true }
    );

    console.log(`Processed webhook for Mono account ${monoAccountId}`);
    res.json({
      status: 'successful',
      message: 'Bank account log updated from webhook',
      data: {
        id: logEntry._id,
        monoAccountId: logEntry.monoAccountId,
        walletAddress: logEntry.walletAddress,
        createdAt: logEntry.createdAt,
      },
    });
  } catch (error) {
    console.error('Webhook processing error:', error.message);
    res.status(500).json({ 
      error: 'Failed to process webhook', 
      details: error.message,
    });
  }
});

// Check Account Details
app.get('/check-account-details', async (req, res) => {
  try {
    const { walletAddress } = req;

    const bankAccountLogs = await BankAccountLog.find({ walletAddress });

    if (bankAccountLogs.length === 0) {
      return res.json({ success: false, message: 'No bank account IDs associated with this wallet address' });
    }

    const accountDetailsPromises = bankAccountLogs.map(async (log) => {
      const options = {
        method: 'GET',
        url: `https://api.withmono.com/v2/accounts/${log.monoAccountId}`,
        headers: { 
          'accept': 'application/json',
          'mono-sec-key': config.monoSecretKey,
        },
      };

      const response = await axios.request(options);
      return response.data;
    });

    const accountDetails = await Promise.all(accountDetailsPromises);

    res.json({
      success: true,
      message: 'Bank account details retrieved successfully',
      data: accountDetails,
    });
  } catch (error) {
    console.error('Error fetching bank account details:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch bank account details', 
      details: error.message,
    });
  }
});

// Check Linked Accounts
app.get('/check-linked-accounts', async (req, res) => {
  try {
    const walletAddress = req.walletAddress;

    const bankAccountLogs = await BankAccountLog.find({ walletAddress });

    if (bankAccountLogs.length > 0) {
      return res.json({
        status: 'successful',
        message: 'Linked bank accounts found',
        data: bankAccountLogs.map(log => ({
          id: log._id,
          monoAccountId: log.monoAccountId,
          walletAddress: log.walletAddress,
          createdAt: log.createdAt,
        })),
      });
    }

    const options = {
      method: 'POST',
      url: 'https://api.withmono.com/v2/accounts/initiate',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'mono-sec-key': config.monoSecretKey,
      },
      data: {
        customer: {
          name: walletAddress,
          email: `${walletAddress}@gmail.com`,
        },
        meta: { ref: '99008877TEST' },
        scope: 'auth',
        redirect_url: config.monoRedirectUrl,
      },
    };

    const response = await axios.request(options);
    const data = response.data;

    if (data.status !== 'successful' || !data.data || !data.data.mono_url) {
      throw new Error('Unexpected response format from Mono API');
    }

    res.json({
      status: 'requires_linking',
      message: bankAccountLogs.length > 0 
        ? 'Add another bank account with Mono linking'
        : 'No linked bank accounts found, please proceed with linking',
      data: {
        mono_url: data.data.mono_url,
        customer: data.data.customer,
        meta: data.data.meta,
        scope: data.data.scope,
        redirect_url: data.data.redirect_url,
        created_at: data.data.created_at,
      },
    });
  } catch (error) {
    console.error('Check linked accounts error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to check linked accounts',
      details: error.response?.data?.message || error.message,
    });
  }
});

// Link Mono Account
app.post('/link-mono-account', async (req, res) => {
  try {
    const { code } = req.body;
    const walletAddress = req.walletAddress;

    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    const authResponse = await axios.post(
      'https://api.withmono.com/v2/accounts/auth',
      { code },
      {
        headers: {
          'Content-Type': 'application/json',
          'accept': 'application/json',
          'mono-sec-key': config.monoSecretKey,
        },
      }
    );

    const monoAccountId = authResponse.data.id;
    if (!monoAccountId) {
      throw new Error('No account ID returned from Mono API');
    }

    const existingLog = await BankAccountLog.findOne({ monoAccountId });
    if (existingLog && existingLog.walletAddress !== walletAddress && !existingLog.walletAddress.startsWith('unclaimed_')) {
      return res.status(400).json({
        error: 'Account already linked',
        message: 'This bank account is already associated with another wallet address. If this is your account, please contact support.',
      });
    }

    const duplicateCheck = await BankAccountLog.findOne({ 
      walletAddress, 
      monoAccountId,
    });
    
    if (duplicateCheck) {
      return res.status(400).json({
        error: 'Duplicate account',
        message: 'This bank account is already linked to your wallet',
      });
    }

    const logEntry = await BankAccountLog.create({
      walletAddress,
      monoAccountId,
    });

    res.json({
      status: 'successful',
      message: 'Bank account linked successfully',
      data: {
        id: logEntry._id,
        monoAccountId: logEntry.monoAccountId,
        walletAddress: logEntry.walletAddress,
        createdAt: logEntry.createdAt,
      },
    });
  } catch (error) {
    console.error('Mono linking error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to link bank account',
      details: error.response?.data?.message || error.message,
    });
  }
});

module.exports = app;