const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { User } = require("./Userschema");
const mongoose = require("mongoose");
const config = require("./config");
const helmet = require("helmet");
const cors = require("cors");

const router = express.Router();

router.use(express.json());
router.use(helmet());
router.use(cors());


mongoose.connect(config.mongoUri, {
}).then(() => console.log("Connected to MongoDB"))
  .catch(err => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });



const PASSWORD_REGEX = /^(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{6,15}$/;

const generateTokens = (email) => {
  if (!config.jwtSecret || !config.refreshTokenSecret) throw new Error("JWT secrets not configured");
  const accessToken = jwt.sign({ email, type: "access" }, config.jwtSecret, { expiresIn: "15m" });
  const refreshToken = jwt.sign({ email, type: "refresh" }, config.refreshTokenSecret, { expiresIn: "7d" });
  return { accessToken, refreshToken };
};

// POST /login
router.post("/", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: "Email and password are required" });
  }

  const emailDomainRegex = /@(gmail|yahoo|hotmail)\.com$/i;
  if (!emailDomainRegex.test(email)) {
    return res.status(400).json({ success: false, error: "Invalid email domain", message: "Email must end with @gmail.com, @yahoo.com, or @hotmail.com" });
  }

  if (!PASSWORD_REGEX.test(password)) {
    return res.status(400).json({ success: false, error: "Invalid password format", message: "Password must be 6-15 characters and contain at least one number and one special character" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: "Incorrect password" });
    }

    const { accessToken, refreshToken } = generateTokens(email);
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 7);

    user.refreshTokens.push({
      token: refreshToken,
      expiresAt: refreshTokenExpiry,
      createdAt: new Date(),
      isActive: true,
    });

    await user.save();

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      accessToken,
      user: { email: user.email, username: user.username },
    });
  } catch (error) {
    console.error("Login error:", error.stack);
    res.status(500).json({ success: false, error: "An error occurred during login", details: error.message });
  }
});

module.exports = router;