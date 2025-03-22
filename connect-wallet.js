const express = require("express");
const jwt = require("jsonwebtoken");
const { isAddress, verifyMessage } = require("ethers");
const { User } = require("./Userschema");
const config = require("./config");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// JWT authentication middleware
const jwtAuth = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ 
      success: false,
      error: 'Authentication token required' 
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded; // Contains email and possibly walletAddress
    next();
  } catch (error) {
    return res.status(401).json({ 
      success: false,
      error: 'Invalid or expired token',
      details: error.message 
    });
  }
};

// Utility function to generate nonce
const generateNonce = () => {
  return Math.floor(Math.random() * 1000000).toString();
};

app.post('/connectwallet', jwtAuth, async (req, res) => {
  try {
    const { walletAddress, signature } = req.body;
    const email = req.user.email; // From JWT via authMiddleware

    if (!walletAddress || !isAddress(walletAddress)) {
      return res.status(400).json({ error: 'Valid wallet address required' });
    }

    const normalizedAddress = walletAddress.toLowerCase();
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // First request: generate and store nonce
    if (!signature) {
      const nonce = generateNonce();
      user.nonce = nonce; // Assuming your User schema has a nonce field
      await user.save();
      return res.json({ nonce });
    }

    // Second request: verify signature with stored nonce
    if (!user.nonce) {
      return res.status(400).json({ 
        error: 'No active nonce found. Please start authentication process again' 
      });
    }

    const message = `Sign this nonce to authenticate: ${user.nonce}`;
    const recoveredAddress = verifyMessage(message, signature);
    
    if (recoveredAddress.toLowerCase() !== normalizedAddress) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Clear nonce after successful verification
    user.nonce = null;

    if (!user.walletAddress) {
      user.walletAddress = normalizedAddress;
    } else if (user.walletAddress.toLowerCase() !== normalizedAddress) {
      return res.status(403).json({ error: 'Wallet address does not match registered user' });
    }

    await user.save();

    const token = jwt.sign(
      { email, walletAddress: normalizedAddress },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    res.json({ token });
  } catch (error) {
    console.error('Wallet connection error:', error);
    res.status(500).json({ error: 'Failed to connect wallet', details: error.message });
  }
});

app.listen(config.connectWalletPort || 3005, () => {
  console.log(`Connect Wallet server running on port ${config.connectWalletPort || 3005}`);
});