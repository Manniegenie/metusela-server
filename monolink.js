// Imports
require('dotenv').config(); // Load environment variables from .env
const mongoose = require('mongoose');
const axios = require('axios');

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('Connected to MongoDB')).catch((err) => console.error('MongoDB error:', err));

const userSchema = new mongoose.Schema(
  {
    walletAddress: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true, // Remove leading/trailing whitespace
      index: true, // Explicit index for faster lookups
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3, // Basic validation
      maxlength: 50, // Prevent overly long usernames
    },
    monoAccountId: {
      type: String,
      unique: true,
      sparse: true, // Allows null/undefined values without uniqueness conflicts
      index: true, // Improve lookup speed
    },
    institutionName: {
      type: String,
      trim: true,
    },
    accountNumber: {
      type: String,
      trim: true,
      match: /^[0-9]{10}$/, // Example: enforce 10-digit account numbers
    },
    accountName: {
      type: String,
      trim: true,
    },
    balance: {
      type: Number,
      min: 0, // Prevent negative balances
      default: 0, // Default to 0 if not provided
    },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
    toJSON: { virtuals: true }, // Include virtuals in JSON output
    toObject: { virtuals: true }, // Include virtuals in object output
  }
);

// Optional: Add a virtual field for formatted balance
userSchema.virtual('formattedBalance').get(function () {
  return (this.balance / 100).toFixed(2); // e.g., convert kobo to Naira
});

const User = mongoose.model('User', userSchema)


// ... (keep all existing imports, schemas, and other endpoints unchanged)

// Modified webhook endpoint
app.post('/webhook', verifyWebhook, async (req, res) => {
    const webhook = req.body;
  
    if (webhook.event !== 'mono.events.account_updated') {
      return res.sendStatus(200);
    }
  
    try {
      const { account } = webhook.data;
      const monoAccountId = account._id;
  
      // Check if monoAccountId already exists in logs
      const existingLog = await AccountLog.findOne({ monoAccountId });
  
      if (existingLog) {
        // Check if the walletAddress matches
        if (!existingLog.walletAddress.startsWith('unclaimed_')) {
          // If it's claimed by someone else
          if (existingLog.walletAddress !== req.walletAddress) { // Note: req.walletAddress might not be available in webhook context
            console.log(`Error: Account ${monoAccountId} belongs to someone else, contact support`);
            return res.status(403).json({
              status: 'error',
              message: 'Account belongs to someone else, contact support'
            });
          }
          
          // If it matches the wallet, return the existing log
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
        // If it's unclaimed, continue to create/update logic below
      }
  
      // Fetch full account details from Mono
      const accountDetails = await fetchMonoAccountDetails(monoAccountId);
  
      // Create new log entry or update existing unclaimed one
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
  
  // ... (keep all other code including fetchMonoAccountDetails, account-logs endpoint, and claim-account-log endpoint unchanged)