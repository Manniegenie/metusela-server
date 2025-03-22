const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { User } = require("./Userschema");
const config = require("./config");

const app = express();
app.use(express.json());

mongoose.connect(config.mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('Connected to MongoDB')).catch(err => console.error('MongoDB error:', err));



// Refresh token endpoint
app.post("/refresh", async (req, res) => {
    const { refreshToken } = req.body;
  
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: "Refresh token required" });
    }
  
    try {
      // Verify the refresh token
      const decoded = jwt.verify(refreshToken, config.refreshTokenSecret);
      const email = decoded.email;
  
      // Find the user and validate the refresh token
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }
  
      const storedToken = user.refreshTokens.find(rt => rt.token === refreshToken);
      if (!storedToken) {
        return res.status(401).json({ success: false, error: "Invalid refresh token" });
      }
  
      // Check if the refresh token has expired
      if (new Date() > new Date(storedToken.expiresAt)) {
        // Remove expired token
        user.refreshTokens = user.refreshTokens.filter(rt => rt.token !== refreshToken);
        await user.save();
        return res.status(401).json({ success: false, error: "Refresh token expired" });
      }
  
      // Generate new access token
      const newAccessToken = jwt.sign(
        { email },
        config.jwtSecret,
        { expiresIn: '15m' }
      );
  
      res.status(200).json({
        success: true,
        message: "Token refreshed successfully",
        accessToken: newAccessToken,
        refreshToken, // Optionally return the same refresh token
      });
    } catch (error) {
      console.error("Refresh token error:", error);
      res.status(401).json({ success: false, error: "Invalid or expired refresh token" });
    }
  });