const express = require('express');
const jwt = require('jsonwebtoken');
const { User } = require('./Userschema');
const config = require('./config');


const router = express.Router();

// Add this endpoint to your googleAuth.js (or your auth router)
router.post('/refresh-token', async (req, res) => {
    const { refreshToken } = req.body;
  
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required.' });
    }
  
    try {
      // Fetch the user that has this refresh token in their refreshTokens array.
      const user = await User.findOne({ 'refreshTokens.token': refreshToken });
      if (!user) {
        return res.redirect(`${config.frontendUrl}/login?error=token_not_recognized`);
      }
  
      // Get the specific token document from the user's refreshTokens array.
      const tokenDoc = user.refreshTokens.find(rt => rt.token === refreshToken);
      if (!tokenDoc) {
        return res.redirect(`${config.frontendUrl}/login?error=token_not_found`);
      }
  
      // Check if the refresh token has expired.
      if (new Date() > tokenDoc.expiresAt) {
        return res.redirect(`${config.frontendUrl}/login?error=token_expired`);
      }
  
      // Verify the refresh token with JWT.
      jwt.verify(refreshToken, config.refreshTokenSecret, async (err) => {
        if (err) {
          return res.redirect(`${config.frontendUrl}/login?error=invalid_token`);
        }
  
        // Generate a new access token.
        const newAccessToken = jwt.sign(
          { email: user.email, username: user.username, type: 'access' },
          config.jwtSecret,
          { expiresIn: '15m' }
        );
  
        // Generate a new refresh token.
        const newRefreshToken = jwt.sign(
          { email: user.email, type: 'refresh' },
          config.refreshTokenSecret,
          { expiresIn: '7d' }
        );
  
        // Replace the old refresh token with the new one in the database.
        tokenDoc.token = newRefreshToken;
        tokenDoc.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
  
        await user.save();
  
        return res.status(200).json({
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        });
      });
    } catch (error) {
      console.error('Error processing refresh token:', error);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  });
  