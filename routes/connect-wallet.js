const express = require('express');
const jwt = require('jsonwebtoken');
const { isAddress, verifyMessage } = require('ethers');
const { User } = require('./Userschema'); // Adjust path if needed
const config = require('./config'); // Adjust path if needed
const crypto = require('crypto');

const router = express.Router();

// Utility function to generate a secure nonce
const generateNonce = () => {
  return crypto.randomBytes(16).toString('hex');
};

// POST /connect-wallet - Connect or authenticate wallet
router.post('/connect-wallet', async (req, res) => {
  try {
    const { walletAddress, signature } = req.body;
    const email = req.user.email; // Provided by authenticateToken middleware

    // Validate wallet address
    if (!walletAddress || !isAddress(walletAddress)) {
      return res.status(400).json({ success: false, error: 'Valid wallet address required' });
    }
    const normalizedAddress = walletAddress.toLowerCase();

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Step 1: If no signature, generate and return a nonce
    if (!signature) {
      const nonce = generateNonce();
      user.authNonce = { nonce, expiresAt: new Date(Date.now() + 5 * 60 * 1000) }; // Expires in 5 minutes
      await user.save();
      return res.json({ success: true, nonce });
    }

    // Step 2: Verify signature if provided
    if (!user.authNonce || !user.authNonce.nonce || user.authNonce.expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        error: 'No active nonce found or nonce expired. Please restart authentication process.'
      });
    }

    const message = `Sign this nonce to authenticate: ${user.authNonce.nonce}`;
    const recoveredAddress = verifyMessage(message, signature);

    if (recoveredAddress.toLowerCase() !== normalizedAddress) {
      return res.status(401).json({ success: false, error: 'Invalid signature' });
    }

    // Clear the nonce after successful verification
    user.authNonce = undefined;

    // Assign or verify wallet address
    if (!user.walletAddress) {
      user.walletAddress = normalizedAddress;
    } else if (user.walletAddress.toLowerCase() !== normalizedAddress) {
      return res.status(403).json({
        success: false,
        error: 'Wallet address does not match registered user'
      });
    }

    await user.save();

    // Generate a new JWT token
    const token = jwt.sign(
      { email, walletAddress: normalizedAddress },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    return res.json({ success: true, token });
  } catch (error) {
    console.error('Wallet connection error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to connect wallet',
      details: error.message
    });
  }
});

// POST /disconnect-wallet - Disconnect user's wallet
router.post('/disconnect-wallet', async (req, res) => {
  try {
    const email = req.user.email; // Provided by authenticateToken middleware
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Clear the wallet address
    user.walletAddress = undefined;
    await user.save();

    return res.json({ success: true, message: 'Wallet disconnected successfully' });
  } catch (error) {
    console.error('Wallet disconnect error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to disconnect wallet',
      details: error.message
    });
  }
});

module.exports = router;
