const express = require("express");
const { User, PendingUser } = require("./Userschema");

const router = express.Router();

// POST /verify-email - Verify the email and complete registration
router.post("/", async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ success: false, error: "Email and verification code required" });
  }

  try {
    const pendingUser = await PendingUser.findOne({ email, verificationCode: code });
    if (!pendingUser) {
      return res.status(400).json({ success: false, error: "Invalid or expired verification code" });
    }

    // Create the user
    const newUser = new User({
      email: pendingUser.email,
      username: pendingUser.username,
      password: pendingUser.password, // already hashed
      emailVerified: true,
    });

    await newUser.save();
    await PendingUser.deleteOne({ email });

    res.status(200).json({ success: true, message: "Email verified and account created" });
  } catch (error) {
    console.error("Verification error:", error);
    res.status(500).json({ success: false, error: "Verification failed" });
  }
});

module.exports = router;
