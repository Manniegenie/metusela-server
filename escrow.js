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
const popularTokens = process.env.POPULAR_TOKENS.split(',');

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('Connected to MongoDB')).catch((err) => console.error('MongoDB error:', err));

// User Schema
const userSchema = new mongoose.Schema(
  {
    walletAddress: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 50,
    },
    monoAccountId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    institutionName: {
      type: String,
      trim: true,
    },
    accountNumber: {
      type: String,
      trim: true,
      match: /^[0-9]{10}$/,
    },
    accountName: {
      type: String,
      trim: true,
    },
    balance: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

userSchema.virtual('formattedBalance').get(function () {
  return (this.balance / 100).toFixed(2);
});

const User = mongoose.model('User', userSchema);

// Simplified Bank Account Log Schema (only walletAddress and monoAccountId)

const bankAccountLogSchema = new mongoose.Schema({
  monoAccountId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  walletAddress: {
    type: String,
    required: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const BankAccountLog = mongoose.model('BankAccountLog', bankAccountLogSchema);

// Middleware
app.use(express.json());

// Web3 authentication middleware

const web3Auth = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
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

// Webhook verification middleware

function verifyWebhook(req, res, next) {
  const webhookSecret = req.headers['mono-webhook-secret'];
  const expectedSecret = process.env.MONO_WEBHOOK_SECRET;

  if (!webhookSecret || webhookSecret !== expectedSecret) {
    return res.status(401).json({ error: 'Invalid or missing webhook secret' });
  }

  next();
}

// Webhook endpoint (simplified to store only walletAddress and monoAccountId)

app.post('/webhook', verifyWebhook, async (req, res) => {
  const webhook = req.body;

  if (webhook.event !== 'mono.events.account_updated') {
    return res.sendStatus(200);
<<<<<<< HEAD
=======
    
>>>>>>> 4e7f10c (Config add)
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
          createdAt: existingLog.createdAt
        }
      });
    }

    const logEntry = await BankAccountLog.findOneAndUpdate(
      { monoAccountId },
      {
        $set: {
          walletAddress: existingLog?.walletAddress || `unclaimed_${monoAccountId}`
        }
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
        createdAt: logEntry.createdAt
      }
    });
  } catch (error) {
    console.error('Webhook processing error:', error.message);
    res.status(500).json({ 
      error: 'Failed to process webhook', 
      details: error.message 
    });
  }
});

// Connect wallet
app.post('/connectwallet', async (req, res) => {
  try {
    const { walletAddress, signature, nonce } = req.body;

    if (!walletAddress || !isAddress(walletAddress)) {
      return res.status(400).json({ error: 'Valid wallet address required' });
    }
    const normalizedAddress = walletAddress.toLowerCase();

    if (!signature) {
      const generatedNonce = Math.floor(Math.random() * 1000000).toString();
      console.log(`Generated nonce for ${normalizedAddress}: ${generatedNonce}`);
      return res.json({ nonce: generatedNonce });
    }

    if (!nonce) {
      return res.status(400).json({ error: 'Nonce required with signature' });
    }

    const message = `Sign this nonce to authenticate: ${nonce}`;
    const recoveredAddress = verifyMessage(message, signature);
    if (recoveredAddress.toLowerCase() !== normalizedAddress) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const token = jwt.sign(
      { walletAddress: normalizedAddress },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ token });
  } catch (error) {
    console.error('Wallet connection error:', error);
    res.status(500).json({ error: 'Failed to connect wallet', details: error.message });
  }
});

// Register user
app.post('/register', web3Auth, async (req, res) => {
  try {
    const { walletAddress } = req;
    let user = await User.findOne({ walletAddress });
    if (!user) {
      const username = `user_${walletAddress.slice(2, 10)}`;
      user = new User({ walletAddress, username });
      await user.save();
    }
    res.json({ username: user.username });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed', details: error.message });
  }
});

// Approve tokens (kept for reference)
app.post('/approve-tokens', web3Auth, async (req, res) => {
  try {
    const { tokenAddress } = req.body;
    const { walletAddress } = req;

    if (!isAddress(tokenAddress)) {
      return res.status(400).json({ error: 'Invalid token address' });
    }

    const normalizedTokenAddress = tokenAddress.toLowerCase();
    if (!popularTokens.includes(normalizedTokenAddress)) {
      return res.status(400).json({ 
        error: 'Unsupported token', 
        message: 'The provided token address is not in the list of supported tokens',
        supportedTokens: popularTokens
      });
    }

    const signer = provider.getSigner(walletAddress);
    const tokenContract = new Contract(normalizedTokenAddress, tokenAbi, signer);
    const currentAllowance = await tokenContract.allowance(walletAddress, trustEscrowAddress);

    if (currentAllowance.lt(MAX_UINT256)) {
      const tx = await tokenContract.approve(trustEscrowAddress, MAX_UINT256);
      const receipt = await tx.wait();
      return res.json({ 
        success: true, 
        approvedToken: normalizedTokenAddress,
        supportedTokens: popularTokens,
        txHash: receipt.transactionHash,
        allowance: MAX_UINT256,
        message: 'Allowance approved successfully'
      });
    }
    
    res.json({ 
      success: true, 
      approvedToken: normalizedTokenAddress,
      supportedTokens: popularTokens,
      allowance: currentAllowance.toString(),
      message: 'Allowance already sufficient' 
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Token allowance approval failed', 
      details: error.message,
      attemptedToken: tokenAddress,
      supportedTokens: popularTokens
    });
  }
});

// Check account details (updated with bankAccountLogs)
app.get('/check-account-details', web3Auth, async (req, res) => {
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
          'mono-sec-key': process.env.MONO_SECRET_KEY
        }
      };

      const response = await axios.request(options);
      return response.data;
    });

    const accountDetails = await Promise.all(accountDetailsPromises);

    res.json({
      success: true,
      message: 'Bank account details retrieved successfully',
      data: accountDetails
    });
  } catch (error) {
    console.error('Error fetching bank account details:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch bank account details', 
      details: error.message 
    });
  }
});

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
    const trustEscrow = new Contract(trustEscrowAddress, trustEscrowAbi, signer);

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

// Check linked accounts
app.get('/check-linked-accounts', web3Auth, async (req, res) => {
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
          createdAt: log.createdAt
        }))
      });
    }

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

// Link Mono account (simplified to store only walletAddress and monoAccountId)
app.post('/link-mono-account', web3Auth, async (req, res) => {
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
          'mono-sec-key': process.env.MONO_SECRET_KEY,
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
        message: 'This bank account is already associated with another wallet address. If this is your account, please contact support.'
      });
    }

    const duplicateCheck = await BankAccountLog.findOne({ 
      walletAddress, 
      monoAccountId 
    });
    
    if (duplicateCheck) {
      return res.status(400).json({
        error: 'Duplicate account',
        message: 'This bank account is already linked to your wallet'
      });
    }

    const logEntry = await BankAccountLog.create({
      walletAddress,
      monoAccountId
    });

    res.json({
      status: 'successful',
      message: 'Bank account linked successfully',
      data: {
        id: logEntry._id,
        monoAccountId: logEntry.monoAccountId,
        walletAddress: logEntry.walletAddress,
        createdAt: logEntry.createdAt
      }
    });
  } catch (error) {
    console.error('Mono linking error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to link bank account',
      details: error.response?.data?.message || error.message,
    });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
