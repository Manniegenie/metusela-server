// routes/login.js
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { User } = require("./Userschema");
const config = require("./config");

const router = express.Router();

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const generateTokens = (user) => {
  return {
    accessToken: jwt.sign(
      {
        email: user.email,
        username: user.username,
        country: user.country, // now already in code format (e.g., "NG")
        type: "access",
      },
      config.JWT_SECRET,
      { expiresIn: "15m" }
    ),
    refreshToken: jwt.sign(
      { email: user.email, type: "refresh" },
      config.REFRESH_TOKEN_SECRET,
      { expiresIn: "7d" }
    ),
  };
};

router.post("/", async (req, res) => {
  const { email, password, country } = req.body;

  if (!email || !password)
    return res.status(400).json({ success: false, error: "Email and password required" });
  if (!validateEmail(email))
    return res.status(400).json({ success: false, error: "Invalid email format" });

  // Validate country if provided: expect a two-letter code (optional)
  if (country && !/^[A-Z]{2}$/.test(country.toUpperCase())) {
    return res.status(400).json({ success: false, error: "Invalid country code. Expect a 2-letter ISO code." });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ success: false, error: "Incorrect password" });

    // If the client sends a country code and the user's country is not set, update it.
    if (country && (!user.country || user.country !== country.toUpperCase())) {
      user.country = country.toUpperCase();
      await user.save();
    }

    const { accessToken, refreshToken } = generateTokens(user);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    user.refreshTokens.push({ token: refreshToken, expiresAt });
    await user.save();

    res.json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        email: user.email,
        username: user.username,
        country: user.country, // already in code format
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, error: "Login failed" });
  }
});

module.exports = router;
