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

// Account Log Schema
const accountLogSchema = new mongoose.Schema({
  monoAccountId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  walletAddress: {
    type: String,
    index: true
  },
  accountName: {
    type: String,
    default: 'Account 1'
  },
  details: {
    institutionName: String,
    accountNumber: String,
    accountName: String,
    balance: Number
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const AccountLog = mongoose.model('AccountLog', accountLogSchema);

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
const secret = process.env.MONO_SECRET_KEY;
function verifyWebhook(req, res, next) {
  if (req.headers['mono-webhook-secret'] !== secret) {
    return res.status(401).json({ message: 'Unauthorized request.' });
  }
  next();
}

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

// Check linked accounts endpoint
app.get('/check-linked-accounts', web3Auth, async (req, res) => {
  try {
    const walletAddress = req.walletAddress;

    const linkedAccounts = await AccountLog.find({ 
      walletAddress,
      walletAddress: { $not: { $regex: /^unclaimed_/ } }
    });

    if (linkedAccounts.length > 0) {
      return res.json({
        status: 'successful',
        message: 'Linked accounts found',
        data: linkedAccounts.map(log => ({
          id: log._id,
          monoAccountId: log.monoAccountId,
          accountName: log.accountName,
          details: {
            institutionName: log.details.institutionName,
            accountNumber: log.details.accountNumber,
            accountName: log.details.accountName,
            balance: log.details.balance
          },
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
      status: data.status,
      message: 'No linked accounts found, initiating Mono linking',
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

app.post('/approve-tokens', web3Auth, async (req, res) => {
  try {
    const { tokenAddress } = req.body;
    const { walletAddress } = req;

    if (!isAddress(tokenAddress)) {
      return res.status(400).json({ error: 'Invalid token address' });
    }

    const signer = provider.getSigner(walletAddress);
    const tokenContract = new Contract(tokenAddress, tokenAbi, signer);
    const currentAllowance = await tokenContract.allowance(walletAddress, trustEscrowAddress);

    if (currentAllowance.lt(MAX_UINT256)) {
      const tx = await tokenContract.approve(trustEscrowAddress, MAX_UINT256);
      const receipt = await tx.wait();
      return res.json({ success: true, txHash: receipt.transactionHash });
    }
    res.json({ success: true, message: 'Tokens already approved' });
  } catch (error) {
    res.status(500).json({ error: 'Token approval failed', details: error.message });
  }
});

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

app.post('/initiate-mono-account', web3Auth, async (req, res) => {
  try {
    const walletAddress = req.walletAddress;

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

app.post('/link-mono-account', web3Auth, async (req, res) => {
  const { code } = req.body;
  const walletAddress = req.walletAddress;

  if (!code) {
    return res.status(400).json({ error: 'Code is required' });
  }

  try {
    const response = await axios.post(
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

    const monoAccountId = response.data.id;
    if (!monoAccountId) {
      throw new Error('No account ID returned from Mono API');
    }

    const user = await User.findOneAndUpdate(
      { walletAddress },
      { monoAccountId },
      { new: true, upsert: true }
    );

    res.json({
      status: 'successful',
      message: 'Mono account linked successfully',
      data: { monoAccountId: user.monoAccountId },
    });
  } catch (error) {
    console.error('Mono auth error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to link Mono account',
      details: error.response?.data?.message || error.message,
    });
  }
});

app.post('/webhook', verifyWebhook, async (req, res) => {
  const webhook = req.body;

  if (webhook.event !== 'mono.events.account_updated') {
    return res.sendStatus(200);
  }

  try {
    const { account } = webhook.data;
    const monoAccountId = account._id;

    const existingLog = await AccountLog.findOne({ monoAccountId });

    if (existingLog && !existingLog.walletAddress.startsWith('unclaimed_')) {
      return res.json({
        status: 'successful',
        message: 'Account already linked',
        data: {
          id: existingLog._id,
          monoAccountId: existingLog.monoAccountId,
          walletAddress: existingLog.walletAddress,
          accountName: existingLog.accountName,
          details: existingLog.details,
          createdAt: existingLog.createdAt
        }
      });
    }

    const accountDetails = await fetchMonoAccountDetails(monoAccountId);

    const logEntry = await AccountLog.findOneAndUpdate(
      { monoAccountId },
      {
        $set: {
          walletAddress: `unclaimed_${monoAccountId}`,
          details: {
            institutionName: accountDetails.institution.name,
            accountNumber: accountDetails.accountNumber,
            accountName: accountDetails.accountName,
            balance: accountDetails.balance
          }
        }
      },
      { upsert: true, new: true }
    );

    console.log(`Created/Updated account log for Mono account ${monoAccountId}`);
    res.json({
      status: 'successful',
      message: 'Account log created',
      data: {
        id: logEntry._id,
        monoAccountId: logEntry.monoAccountId,
        walletAddress: logEntry.walletAddress,
        accountName: logEntry.accountName,
        details: logEntry.details,
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

app.get('/account-logs', web3Auth, async (req, res) => {
  try {
    const { walletAddress } = req;

    const logs = await AccountLog.find({
      $or: [
        { walletAddress },
        { walletAddress: { $regex: /^unclaimed_/ } }
      ]
    }).sort({ createdAt: -1 });

    res.json({
      status: 'successful',
      data: logs.map(log => ({
        id: log._id,
        monoAccountId: log.monoAccountId,
        walletAddress: log.walletAddress,
        accountName: log.accountName,
        details: log.details,
        createdAt: log.createdAt
      }))
    });
  } catch (error) {
    console.error('Account logs fetch error:', error.message);
    res.status(500).json({
      error: 'Failed to fetch account logs',
      details: error.message
    });
  }
});

app.post('/claim-account-log', web3Auth, async (req, res) => {
  try {
    const { walletAddress } = req;
    const { logId } = req.body;

    if (!logId) {
      return res.status(400).json({ error: 'Log ID is required' });
    }

    const log = await AccountLog.findById(logId);
    
    if (!log) {
      return res.status(404).json({ error: 'Log not found' });
    }

    if (!log.walletAddress.startsWith('unclaimed_') && log.walletAddress !== walletAddress) {
      return res.status(403).json({
        status: 'error',
        message: 'Account belongs to someone else, contact support'
      });
    }

    const updatedLog = await AccountLog.findOneAndUpdate(
      { _id: logId, walletAddress: { $regex: /^unclaimed_/ } },
      { $set: { walletAddress } },
      { new: true }
    );

    if (!updatedLog) {
      return res.status(400).json({ 
        error: 'Log already claimed or invalid state' 
      });
    }

    res.json({
      status: 'successful',
      message: 'Account log claimed successfully',
      data: {
        id: updatedLog._id,
        monoAccountId: updatedLog.monoAccountId,
        walletAddress: updatedLog.walletAddress,
        accountName: updatedLog.accountName,
        details: updatedLog.details,
        createdAt: updatedLog.createdAt
      }
    });
  } catch (error) {
    console.error('Account log claim error:', error.message);
    res.status(500).json({
      error: 'Failed to claim account log',
      details: error.message
    });
  }
});

async function fetchMonoAccountDetails(monoAccountId) {
  try {
    const response = await axios.get(
      `https://api.withmono.com/v1/accounts/${monoAccountId}`,
      {
        headers: {
          'accept': 'application/json',
          'mono-sec-key': process.env.MONO_SECRET_KEY,
        },
      }
    );

    const { data } = response;
    if (!data || !data.account) {
      throw new Error('Invalid Mono account response');
    }

    return {
      institution: { name: data.account.institution?.name || 'Unknown' },
      accountNumber: data.account.accountNumber,
      accountName: data.account.accountName,
      balance: data.account.balance
    };
  } catch (error) {
    console.error('Mono API fetch error:', error.response?.data || error.message);
    throw new Error(`Failed to fetch Mono account details: ${error.message}`);
  }
}

async function notifyMismatch(monoAccountId) {
  const webhookUrl = 'https://your-webhook-receiver.com/endpoint';
  const payload = {
    event: 'mono.account_id_mismatch',
    data: {
      monoAccountId,
      message: 'No wallet address associated with this Mono account ID',
      timestamp: new Date().toISOString(),
    },
  };

  try {
    await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.WEBHOOK_AUTH_TOKEN}`,
      },
    });
    console.log(`Webhook sent for unmatched account ID: ${monoAccountId}`);
  } catch (webhookError) {
    console.error('Webhook sending failed:', webhookError.message);
  }
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});