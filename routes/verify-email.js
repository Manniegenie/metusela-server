const express = require("express");
const jwt = require("jsonwebtoken");
const { User, PendingUser } = require("./Userschema");
const config = require("../config");

const router = express.Router();

/**
 * POST /verify-email - Verify the email and complete registration.
 *
 * Expected JSON properties in req.body:
 *   - email: user's email address
 *   - token: the JWT generated during sign-up (used for endpoint authorization)
 *   - code: the 4-digit verification code sent via email to the user
 */
router.post("/", async (req, res) => {
  const { email, token, code } = req.body;

  if (!email || !token || !code) {
    return res.status(400).json({ 
      success: false, 
      error: "Email, token, and verification code required" 
    });
  }

  try {
    // Retrieve the pending user record by email.
    const pendingUser = await PendingUser.findOne({ email });
    if (!pendingUser) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid or expired verification details" 
      });
    }

    // Check that the stored JWT matches the provided token.
    if (pendingUser.verificationJwt !== token) {
      return res.status(400).json({ 
        success: false, 
        error: "Verification token mismatch" 
      });
    }

    // Verify the JWT to ensure it's valid and not expired.
    try {
      jwt.verify(token, config.jwtSecret);
    } catch (error) {
      console.error("JWT verification error:", error);
      return res.status(400).json({ 
        success: false, 
        error: "Invalid or expired token" 
      });
    }

    // Compare the provided verification code with the one stored in the pending user record.
    if (pendingUser.verificationCode !== code) {
      return res.status(400).json({ 
        success: false, 
        error: "Verification code does not match" 
      });
    }

    // All validations passed; create the new user record.
    const newUser = new User({
      email: pendingUser.email,
      username: pendingUser.username,
      password: pendingUser.password, // already hashed during sign-up
      emailVerified: true,
    });

    await newUser.save();
    // Remove the pending user record once the account is created.
    await PendingUser.deleteOne({ email });

    res.status(200).json({ 
      success: true, 
      message: "Email verified and account created" 
    });
  } catch (error) {
    console.error("Verification error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Verification failed" 
    });
  }
});

module.exports = router;
