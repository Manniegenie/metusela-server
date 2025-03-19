const mongoose = require('mongoose');

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
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'], // Basic email validation
    },
    password: {
      type: String,
      required: true,
      trim: true,
    },
    username: {
      type: String,
      required: false, // Optional now, since email is the primary identifier
      unique: true,
      sparse: true, // Allows multiple null/undefined values
      trim: true,
      minlength: 3,
      maxlength: 50,
    },
    walletAddress: {
      type: String,
      required: false, // Not required at signup, added later
      unique: true,
      sparse: true, // Allows multiple null/undefined values
      lowercase: true,
      trim: true,
      index: true,
      default: "",
    },
    monoAccountId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      default: "",
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

module.exports = mongoose.model('User', userSchema);