const express = require('express');
const axios = require('axios');
const { BankAccountLog, User } = require('./Userschema');
const config = require('./config');

const router = express.Router();
router.use(express.json());


router.post('/initiate', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required.' });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const options = {
      method: 'POST',
      url: 'https://api.withmono.com/v2/accounts/initiate',
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/json',
        'mono-sec-key': config.monoSecKey,
      },
      data: {
        customer: {
          name: user.username,
          email: user.email,
        },
        meta: { ref: '99008877TEST' },
        scope: 'auth',
        redirect_url: 'https://mono.co',
      },
    };
    const response = await axios.request(options);
    const monoResponse = response.data;
    const monoData = monoResponse.data;
    return res.status(200).json({
      status: 'successful',
      message: 'Request was successfully completed',
      timestamp: new Date().toISOString(),
      data: {
        mono_url: monoData.mono_url,
        customer: monoData.customer,
        meta: monoData.meta,
        scope: monoData.scope,
        redirect_url: monoData.redirect_url,
        created_at: monoData.created_at,
      },
    });
  } catch (error) {
    console.error('Error in /initiate endpoint:', error.message);
    return res.status(500).json({
      error: 'Failed to process Mono account initiation',
      details: error.message,
    });
  }
});

router.post('/authenticate', async (req, res) => {
  try {
    const { userId, code } = req.body;
    if (!userId || !code) {
      return res.status(400).json({ error: 'User ID and code are required.' });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const options = {
      method: 'POST',
      url: 'https://api.withmono.com/v2/accounts/auth',
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/json',
        'mono-sec-key': config.monoSecKey,
      },
      data: { code },
    };
    const response = await axios.request(options);
    const monoResponse = response.data;
    const monoData = monoResponse.data;
    const existingAccount = await BankAccountLog.findOne({ monoAccountId: monoData.customer });
    if (existingAccount) {
      return res.status(400).json({ error: 'Account already exists.' });
    }
    const newLog = await BankAccountLog.create({
      monoAccountId: monoData.customer,
      walletAddress: monoData.mono_url,
      userId: user._id,
    });
    if (!user.bankAccountLogs.includes(newLog._id)) {
      user.bankAccountLogs.push(newLog._id);
      await user.save();
    }
    return res.status(200).json({
      status: 'successful',
      message: 'Request was successfully completed',
      timestamp: new Date().toISOString(),
      data: {
        mono_url: monoData.mono_url,
        customer: monoData.customer,
        meta: monoData.meta,
        scope: monoData.scope,
        redirect_url: monoData.redirect_url,
        created_at: monoData.created_at,
      },
    });
  } catch (error) {
    console.error('Error in /authenticate endpoint:', error.message);
    return res.status(500).json({
      error: 'Failed to process Mono account authentication',
      details: error.message,
    });
  }
});

module.exports = router;
