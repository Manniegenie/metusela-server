const express = require("express");
const { User, PendingUser } = require("./Userschema");
const { sendVerificationEmail } = require("../services/sendEmail");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const config = require("../config");

const router = express.Router();

// Helper functions for input validation.
const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validateUsername = (username) => /^[a-zA-Z0-9]{3,20}$/.test(username);
const validatePassword = (password) => password.length >= 8;

// Generates a random 4-digit code as a string (e.g., "0934")
function generateVerificationCode() {
  const code = Math.floor(1000 + Math.random() * 9000);
  return code.toString();  // Always 4 digits by design
}

// Generate a JWT specifically for the verification endpoint
function generateVerificationJwt(payload, expiresIn = "15m") {
  return jwt.sign(payload, config.jwtSecret, { expiresIn });
}

/**
 * POST /sign-up - Register a new user and send a verification email.
 *
 * Expected JSON properties in req.body:
 *    - email, username, password, confirmPassword, country
 */
router.post("/", async (req, res) => {
  const { email, username, password, confirmPassword, country } = req.body;

  // Check for missing fields.
  if (!email || !username || !password || !confirmPassword || !country) {
    return res.status(400).json({ success: false, error: "All fields required" });
  }

  // Validate matching passwords.
  if (password !== confirmPassword) {
    return res.status(400).json({ success: false, error: "Passwords do not match" });
  }

  // Validate proper formatting.
  if (!validateEmail(email) || !validateUsername(username) || !validatePassword(password)) {
    return res.status(400).json({ success: false, error: "Invalid input format" });
  }

  try {
    // Check if the email is already registered.
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, error: "Email already in use" });
    }

    // Hash the password.
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate a random 4-digit verification code.
    const verificationCode = generateVerificationCode();

    // Generate a JWT that will be used by the front end to call the verify email endpoint.
    // You could include a unique identifier or the user's email in the payload.
    const verificationJwt = generateVerificationJwt({ email, username });

    // Create a pending user record with a 15-minute expiration, including both tokens.
    await PendingUser.create({
      email,
      username,
      password: hashedPassword,
      verificationCode,  // Save the short code for manual entry
      verificationJwt,   // Save the JWT for endpoint authorization
      country,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15-minute expiry
    });

    // Send a verification email which includes the 4-digit code.
    await sendVerificationEmail(email, verificationCode, username);

    // Respond with success and send the JWT to the front end.
    // The front end should store this token (typically in memory) and use it to authenticate a call to the verification endpoint.
    res.status(201).json({
      success: true,
      message: "Verification email sent. Please check your inbox.",
      token: verificationJwt
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ success: false, error: "Registration failed" });
  }
});

module.exports = router;
