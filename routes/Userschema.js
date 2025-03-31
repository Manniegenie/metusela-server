const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// User Schema
const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    password: {
      type: String,
      required: true,
      trim: true,
    },
    username: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      trim: true,
      minlength: 3,
      maxlength: 50,
    },
    refreshTokens: [{
      token: { type: String, required: true },
      expiresAt: { type: Date, required: true },
    }],
    walletAddress: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    bankAccountLogs: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BankAccountLog',
      validate: {
        validator: function () {
          return this.bankAccountLogs.length <= 3;
        },
        message: 'Maximum of 3 bank accounts allowed per user',
      },
    }],
    // New subdocument for authentication nonce
    authNonce: {
      nonce: { type: String },
      expiresAt: { type: Date },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Add index for refreshTokens.token for faster lookups
userSchema.index({ 'refreshTokens.token': 1 });

// Pending User Schema
const pendingUserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, trim: true },
    username: { type: String, required: true, trim: true },
    password: { type: String, required: true, trim: true },
    verificationCode: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  {
    timestamps: true,
  }
);

// Bank Account Log Schema
const bankAccountLogSchema = new mongoose.Schema(
  {
    monoAccountId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    walletAddress: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    accountNumber: {
      type: String,
      trim: true,
      match: /^[0-9]{10}$/,
    },
    institutionName: {
      type: String,
      trim: true,
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
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual field for formatted balance
bankAccountLogSchema.virtual('formattedBalance').get(function () {
  return (this.balance / 100).toFixed(2);
});

// Pre-save hook for password hashing
userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// Export all models using caching to prevent overwrite errors
const User = mongoose.models.User || mongoose.model('User', userSchema);
const PendingUser = mongoose.models.PendingUser || mongoose.model('PendingUser', pendingUserSchema);
const BankAccountLog = mongoose.models.BankAccountLog || mongoose.model('BankAccountLog', bankAccountLogSchema);

module.exports = {
  User,
  PendingUser,
  BankAccountLog,
};
