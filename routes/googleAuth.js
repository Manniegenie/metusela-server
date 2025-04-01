const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User } = require('./Userschema');
const config = require('./config');

const router = express.Router();

// Configure Passport Google Strategy using values from the config file.
passport.use(new GoogleStrategy(
  {
    clientID: config.googleClientId,
    clientSecret: config.googleClientSecret,
    callbackURL: config.googleCallbackURL, // e.g., 'http://localhost:5000/auth/google/callback'
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails[0].value;
      let user = await User.findOne({ email });

      if (!user) {
        // Create a new user if one doesn't exist.
        // Generate a secure random password for OAuth users.
        const randomPassword = crypto.randomBytes(24).toString('hex');
        // Create a sanitized username from displayName or fallback to the email prefix.
        const baseUsername = profile.displayName 
          ? profile.displayName.replace(/\s+/g, '').toLowerCase() 
          : email.split('@')[0];
        const username = baseUsername + Math.floor(Math.random() * 1000);

        user = await User.create({
          email,
          username,
          password: randomPassword, // Will be hashed by pre-save hook
          googleId: profile.id,
          refreshTokens: []
        });
      } else if (!user.googleId) {
        // Link Google account if user exists but hasn't been linked.
        user.googleId = profile.id;
        await user.save();
      }

      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }
));

// Generate JWT Tokens using the user object.
const generateTokens = (user) => {
  return {
    accessToken: jwt.sign(
      { email: user.email, username: user.username, type: "access" },
      config.jwtSecret,
      { expiresIn: "15m" }
    ),
    refreshToken: jwt.sign(
      { email: user.email, type: "refresh" },
      config.refreshTokenSecret,
      { expiresIn: "7d" }
    ),
  };
};

// Route to initiate Google OAuth
router.get('/', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google OAuth callback route
router.get('/callback', 
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  async (req, res) => {
    try {
      const tokens = generateTokens(req.user);
      // Save refresh token to the user document.
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      req.user.refreshTokens.push({ token: tokens.refreshToken, expiresAt });
      await req.user.save();

      // Redirect to the frontend with tokens in the query parameters.
      // In production, consider a more secure method (e.g., HTTP-only cookies).
      res.redirect(`${config.frontendUrl}/oauth-success?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`);
    } catch (error) {
      console.error('OAuth callback error:', error);
      res.redirect(`${config.frontendUrl}/login?error=auth_failed`);
    }
  }
);

module.exports = router;
