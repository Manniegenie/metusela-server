const express = require("express");
const { User, PendingUser } = require("./Userschema");
const { sendVerificationEmail, generateVerificationCode } = require("./verify-email");
const bcrypt = require("bcrypt");

const router = express.Router();

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validateUsername = (username) => /^[a-zA-Z0-9]{3,20}$/.test(username);
const validatePassword = (password) => password.length >= 8;

// POST /sign-up - Register New User (Pending)
router.post("/", async (req, res) => {
  const { email, username, password } = req.body;

  if (!email || !username || !password) {
    return res.status(400).json({ success: false, error: "All fields required" });
  }
  if (!validateEmail(email) || !validateUsername(username) || !validatePassword(password)) {
    return res.status(400).json({ success: false, error: "Invalid input format" });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, error: "Email already in use" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationCode = generateVerificationCode();

    // Save pending user with expiration of 10 minutes
    await PendingUser.create({
      email,
      username,
      password: hashedPassword,
      verificationCode,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    // Send verification email
    await sendVerificationEmail(email, verificationCode);

    res.status(201).json({ success: true, message: "Verification email sent. Please check your inbox." });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ success: false, error: "Registration failed" });
  }
});

module.exports = router;
