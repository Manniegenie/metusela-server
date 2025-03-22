const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { User } = require("./Userschema");
const bcrypt = require("bcrypt");
const config = require("./config");

const app = express();
app.use(express.json());

mongoose.connect(config.mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('Connected to MongoDB')).catch(err => console.error('MongoDB error:', err));

// Helper function to generate tokens
const generateTokens = (email) => {
  const accessToken = jwt.sign(
    { email },
    config.jwtSecret,
    { expiresIn: '15m' } // Short-lived access token (15 minutes)
  );
  const refreshToken = jwt.sign(
    { email },
    config.refreshTokenSecret, // Use a different secret for refresh tokens
    { expiresIn: '7d' }  // Long-lived refresh token (7 days)
  );
  return { accessToken, refreshToken };
};

// login.js
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: "Email and password are required",
    });
  }

  const emailDomainRegex = /@(gmail|yahoo|hotmail)\.com$/i;
  if (!emailDomainRegex.test(email)) {
    return res.status(400).json({
      success: false,
      error: "Invalid email domain",
      message: "Email must end with @gmail.com, @yahoo.com, or @hotmail.com",
    });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: "Incorrect password",
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
      message: "Login successful",
      accessToken,
      refreshToken,
      user: { email: user.email },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      error: "An error occurred during login",
    });
  }
});

app.listen(config.loginPort || 3001, () => console.log(`Login server running on port ${config.loginPort || 3001}`));