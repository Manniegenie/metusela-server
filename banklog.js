const mongoose = require('mongoose');

const bankAccountLogSchema = new mongoose.Schema({
  monoAccountId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  walletAddress: {
    type: String,
    required: true,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('BankAccountLog', bankAccountLogSchema);