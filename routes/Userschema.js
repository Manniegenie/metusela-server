// Userschema.js
const mongoose = require('mongoose');

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
      createdAt: { type: Date, default: Date.now },
      isActive: { type: Boolean, default: true },
    }],
    walletAddress: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      index: true, // No default value
    },
    bankAccountLogs: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BankAccountLog',
      validate: {
        validator: function() {
          return this.bankAccountLogs.length <= 3;
        },
        message: 'Maximum of 3 bank accounts allowed per user'
      }
    }],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Bank Account Log Schema (unchanged)
const bankAccountLogSchema = new mongoose.Schema({
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
  createdAt: {
    type: Date,
    default: Date.now,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    required: true,
  },
});

bankAccountLogSchema.virtual('formattedBalance').get(function () {
  return (this.balance / 100).toFixed(2);
});

module.exports = {
  User: mongoose.model('User', userSchema),
  BankAccountLog: mongoose.model('BankAccountLog', bankAccountLogSchema),
};