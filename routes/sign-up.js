const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { User } = require('./Userschema');
const bcrypt = require("bcrypt");
const config = require("./config");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const router = express.Router();

router.use(express.json());
router.use(helmet());

const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: "Too many signup attempts from this IP, please try again after 15 minutes" },
});
router.use(signupLimiter);

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

// POST /signup
router.post("/", async (req, res) => {
  const { email, password, confirmPassword, username } = req.body;

  if (!email || !password || !confirmPassword) {
    return res.status(400).json({ success: false, error: "Email, password, and password confirmation are required" });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ success: false, error: "Passwords do not match" });
  }

  const emailDomainRegex = /@(gmail|yahoo|hotmail)\.com$/i;
  if (!emailDomainRegex.test(email)) {
    return res.status(400).json({ success: false, error: "Invalid email domain", message: "Email must end with @gmail.com, @yahoo.com, or @hotmail.com" });
  }

  if (!PASSWORD_REGEX.test(password)) {
    return res.status(400).json({ success: false, error: "Invalid password", message: "Password must be 6-15 characters and contain at least one number and one special character" });
  }

  if (username && (username.length < 3 || username.length > 50)) {
    return res.status(400).json({ success: false, error: "Username must be between 3 and 50 characters" });
  }

  try {
    const existingUser = await User.findOne({ $or: [{ email }, { username: username || null }] });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: existingUser.email === email ? "Email already exists" : "Username already taken",
      });
    }

    const hashedPassword = await bcrypt.hash(password, config.saltRounds);
    const user = new User({
      email,
      password: hashedPassword,
      username: username || undefined,
    });

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

    res.status(201).json({
      success: true,
      message: "User created successfully",
      accessToken,
      user: { email: user.email, username: user.username, createdAt: user.createdAt },
    });
  } catch (error) {
    console.error("Signup error:", error.stack);
    res.status(500).json({ success: false, error: "An error occurred during signup", details: error.message });
  }
});

module.exports = router;