// index.js
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { JsonRpcProvider, Contract, isAddress, verifyMessage } = require('ethers');
const config = require('./config');
const app = express();

// BSC Testnet provider
const provider = new JsonRpcProvider(config.bscRpcUrl);

// TrustEscrow contract ABI
const trustEscrowAbi = [
  "function createEscrow(address payee, address token, uint256 tokenAmount, uint256 fiatAmount) returns (bytes32)",
  "function releaseTokens(bytes32 escrowId)",
  "function getPayerEscrows(address payer) view returns (bytes32[])",
  "function escrows(bytes32) view returns (address payer, address payee, address token, uint256 tokenAmount, uint256 fiatAmount, bool isCompleted)",
  "event EscrowCreated(bytes32 indexed escrowId, bytes32 indexed txHash, address payer, address payee, uint256 tokenAmount, uint256 fiatAmount)",
  "event TokensReleased(bytes32 indexed escrowId, bytes32 indexed txHash, address payee, uint256 amount)",
];

// ERC20 ABI for approval
const tokenAbi = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
];

const MAX_UINT256 = "115792089237316195423570985008687907853269984665640564039457584007913129639935";

// MongoDB connection
mongoose.connect(config.mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('Connected to MongoDB')).catch((err) => console.error('MongoDB error:', err));

// Middleware
app.use(express.json());

// Web3 authentication middleware
const web3Auth = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const authWalletAddress = decoded.walletAddress;
    if (!isAddress(authWalletAddress)) {
      return res.status(401).json({ error: 'Invalid wallet address in token' });
    }

    const { walletAddress } = req.body || req.headers;
    if (walletAddress) {
      if (!isAddress(walletAddress)) {
        return res.status(400).json({ error: 'Invalid wallet address in request' });
      }
      if (walletAddress.toLowerCase() !== authWalletAddress) {
        return res.status(403).json({ error: 'Wallet address mismatch' });
      }
    }

    req.walletAddress = authWalletAddress;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token', details: error.message });
  }
};


// Create escrow
app.post('/create-escrow', web3Auth, async (req, res) => {
  try {
    const { payee, token, tokenAmount, fiatAmount } = req.body;
    const walletAddress = req.walletAddress;

    if (!payee || !token || !tokenAmount || !fiatAmount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    function isBscAddress(address) {
      if (typeof address !== 'string') return false;
      const bscAddressPattern = /^0x[a-fA-F0-9]{40}$/;
      return bscAddressPattern.test(address);
    }

    if (!isBscAddress(payee)) {
      console.log('Not a BSC wallet address:', payee);
      return res.status(400).json({ error: 'Not a BSC wallet address' });
    }

    if (!isAddress(payee) || !isAddress(token)) {
      return res.status(400).json({ error: 'Invalid address format' });
    }

    const signer = provider.getSigner(walletAddress);
    const trustEscrow = new Contract(config.trustEscrowAddress, trustEscrowAbi, signer);

    const tx = await trustEscrow.createEscrow(payee, token, tokenAmount, fiatAmount);
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

// Start server
app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});