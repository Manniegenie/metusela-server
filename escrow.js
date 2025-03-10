require('dotenv').config();
const { JsonRpcProvider, Contract, isAddress, verifyMessage } = require('ethers');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const app = express();

// BSC Testnet provider
const provider = new JsonRpcProvider(process.env.BSC_RPC_URL);

// TrustEscrow contract ABI
const trustEscrowAbi = [
  "function createEscrow(address payee, address token, uint256 tokenAmount, uint256 fiatAmount) returns (bytes32)",
  "function releaseTokens(bytes32 escrowId)",
  "function getPayerEscrows(address payer) view returns (bytes32[])",
  "function escrows(bytes32) view returns (address payer, address payee, address token, uint256 tokenAmount, uint256 fiatAmount, bool isCompleted)",
  "event EscrowCreated(bytes32 indexed escrowId, bytes32 indexed txHash, address payer, address payee, uint256 tokenAmount, uint256 fiatAmount)",
  "event TokensReleased(bytes32 indexed escrowId, bytes32 indexed txHash, address payee, uint256 amount)"
];

// ERC20 ABI for approval
const tokenAbi = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)"
];

const trustEscrowAddress = process.env.TRUST_ESCROW_ADDRESS;
const MAX_UINT256 = "115792089237316195423570985008687907853269984665640564039457584007913129639935";
const popularTokens = process.env.POPULAR_TOKENS.split(','); // Comma-separated list from .env

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB error:', err));

// User schema (no passwordHash)
const userSchema = new mongoose.Schema({
  walletAddress: { type: String, required: true, unique: true, lowercase: true },
  username: { type: String, required: true, unique: true },
  monoAccountId: { type: String, unique: true, sparse: true },
  createdAt: { type: Date, default: Date.now },
});
const User = mongoose.model('User', userSchema);

// Middleware
app.use(express.json());

// JWT middleware
const requireAuth = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authentication token required' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.walletAddress = decoded.walletAddress;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Wallet validation middleware
const requireWallet = async (req, res, next) => {
  const { walletAddress } = req.body || req.headers;
  if (!isAddress(walletAddress)) {
    return res.status(401).json({ error: 'Invalid wallet address' });
  }
  if (walletAddress.toLowerCase() !== req.walletAddress) {
    return res.status(403).json({ error: 'Wallet mismatch' });
  }
  req.walletAddress = walletAddress.toLowerCase();
  next();
};

// Get nonce for signature
app.post('/get-nonce', async (req, res) => {
  try {
    const { walletAddress } = req.body;
    if (!isAddress(walletAddress)) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }
    const nonce = Math.floor(Math.random() * 1000000).toString();
    res.json({ nonce });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate nonce' });
  }
});

// Authenticate and register/check user
app.post('/authenticate', async (req, res) => {
  try {
    const { walletAddress, signature, nonce } = req.body;
    if (!isAddress(walletAddress) || !signature || !nonce) {
      return res.status(400).json({ error: 'Missing or invalid fields' });
    }

    const message = `Sign this nonce to authenticate: ${nonce}`;
    const recoveredAddress = verifyMessage(message, signature);
    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    let user = await User.findOne({ walletAddress: walletAddress.toLowerCase() });
    if (!user) {
      const username = `user_${walletAddress.slice(2, 10)}`;
      user = new User({
        walletAddress: walletAddress.toLowerCase(),
        username,
      });
      await user.save();
    }

    const token = jwt.sign(
      { walletAddress: walletAddress.toLowerCase() },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    res.json({ token, username: user.username });
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Approve tokens for TrustEscrow contract
app.post('/approve-tokens', requireAuth, requireWallet, async (req, res) => {
  try {
    const { walletAddress, tokenAddress } = req.body;
    if (!isAddress(tokenAddress)) {
      return res.status(400).json({ error: 'Invalid token address' });
    }

    const signer = provider.getSigner(walletAddress);
    const tokenContract = new Contract(tokenAddress, tokenAbi, signer);
    const currentAllowance = await tokenContract.allowance(walletAddress, trustEscrowAddress);

    if (currentAllowance.lt(MAX_UINT256)) {
      const tx = await tokenContract.approve(trustEscrowAddress, MAX_UINT256);
      const receipt = await tx.wait();
      res.json({ success: true, txHash: receipt.transactionHash });
    } else {
      res.json({ success: true, message: 'Tokens already approved' });
    }
  } catch (error) {
    console.error('Token approval error:', error);
    res.status(500).json({ error: 'Failed to approve tokens', details: error.message });
  }
});

// Create escrow
app.post('/create-escrow', requireAuth, requireWallet, async (req, res) => {
  try {
    const { walletAddress, payee, token, tokenAmount, fiatAmount } = req.body;
    if (!isAddress(payee) || !isAddress(token) || !tokenAmount || !fiatAmount) {
      return res.status(400).json({ error: 'Missing or invalid fields' });
    }

    const signer = provider.getSigner(walletAddress);
    const trustEscrow = new Contract(trustEscrowAddress, trustEscrowAbi, signer);

    const tx = await trustEscrow.createEscrow(
      payee,
      token,
      tokenAmount,
      fiatAmount
    );
    const receipt = await tx.wait();

    res.json({
      success: true,
      escrowId: receipt.events.find(e => e.event === 'EscrowCreated')?.args.escrowId,
      txHash: receipt.transactionHash,
    });
  } catch (error) {
    console.error('Escrow creation error:', error);
    res.status(500).json({ error: 'Failed to create escrow', details: error.message });
  }
});

// Initiate Mono account linking
app.post('/initiate-mono-account', requireAuth, requireWallet, async (req, res) => {
  try {
    const { walletAddress } = req.body;

    const options = {
      method: 'POST',
      url: 'https://api.withmono.com/v2/accounts/initiate',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'mono-sec-key': process.env.MONO_SECRET_KEY,
      },
      data: {
        customer: {
          name: walletAddress,
          email: `${walletAddress}@gmail.com`,
        },
        meta: { ref: '99008877TEST' },
        scope: 'auth',
        redirect_url: process.env.MONO_REDIRECT_URL,
      },
    };

    const response = await axios.request(options);
    const data = response.data;

    if (data.status !== 'successful' || !data.data || !data.data.mono_url) {
      throw new Error('Unexpected response format from Mono API');
    }

    res.json({
      status: data.status,
      message: data.message,
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
    console.error('Mono API error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to initiate Mono account',
      details: error.response?.data?.message || error.message,
    });
  }
});

// Link Mono account
app.post('/link-mono-account', requireAuth, requireWallet, async (req, res) => {
  try {
    const { walletAddress, code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    const options = {
      method: 'POST',
      url: 'https://api.withmono.com/v2/accounts/auth',
      headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json',
        'mono-sec-key': process.env.MONO_SECRET_KEY,
      },
      data: { code },
    };

    const response = await axios.request(options);
    const data = response.data;

    const monoAccountId = data.id;
    if (!monoAccountId) {
      throw new Error('No account ID returned from Mono API');
    }

    const user = await User.findOneAndUpdate(
      { walletAddress: walletAddress.toLowerCase() },
      { monoAccountId },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      status: 'successful',
      message: 'Mono account linked successfully',
      data: { monoAccountId: user.monoAccountId },
    });
  } catch (error) {
    console.error('Mono auth error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to link Mono account',
      details: error.response?.data?.message || error.message,
    });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (BSC Testnet via ChainIDE)`);
});