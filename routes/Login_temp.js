// routes/login.js
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { User } = require('./Userschema'); // Adjust path if needed
const config = require('../config'); // Adjust path if needed
const router = express.Router();

// Helper function to generate tokens
const generateTokens = (email) => {
  const accessToken = jwt.sign(
    { email },
    config.jwtSecret,
    { expiresIn: '15m' }
  );
  const refreshToken = jwt.sign(
    { email },
    config.refreshTokenSecret,
    { expiresIn: '7d' }
  );
  return { accessToken, refreshToken };
};

// POST /login endpoint
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Email and password are required',
    });
  }

  const emailDomainRegex = /@(gmail|yahoo|hotmail)\.com$/i;
  if (!emailDomainRegex.test(email)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid email domain',
      message: 'Email must end with @gmail.com, @yahoo.com, or @hotmail.com',
    });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Incorrect password',
      });
    }

    const { accessToken, refreshToken } = generateTokens(email);

    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7);

    user.refreshTokens.push({
      token: refreshToken,
      expiresAt: refreshTokenExpiry,
    });

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: { email: user.email },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'An error occurred during login',
    });
  }
});

module.exports = router;