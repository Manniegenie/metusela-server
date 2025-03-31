const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { User } = require("./Userschema");
const config = require("./config");

const router = express.Router();

// **Generate JWT Tokens**
const generateTokens = (email) => ({
    accessToken: jwt.sign({ email, type: "access" }, config.jwtSecret, { expiresIn: "15m" }),
    refreshToken: jwt.sign({ email, type: "refresh" }, config.refreshTokenSecret, { expiresIn: "7d" }),
});

// **Validation Function**
const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// **POST /login** - User Login
router.post("/", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, error: "Email and password required" });
    }
    if (!validateEmail(email)) {
        return res.status(400).json({ success: false, error: "Invalid email format" });
    }

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ success: false, error: "User not found" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ success: false, error: "Incorrect password" });

        const { accessToken, refreshToken } = generateTokens(email);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

        // Save the refresh token to the user's refreshTokens array
        user.refreshTokens.push({ token: refreshToken, expiresAt });
        await user.save();

        res.json({
            success: true,
            accessToken,
            refreshToken,
            user: { email: user.email, username: user.username },
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ success: false, error: "Login failed" });
    }
});

module.exports = router;