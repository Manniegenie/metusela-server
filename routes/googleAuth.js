const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
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
        // If user not found, don't create a new user.
        // Signal failure so that the failureRedirect in the callback is triggered.
        return done(null, false, { message: 'User not registered, please sign up.' });
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
  passport.authenticate('google', { session: false, failureRedirect: `${config.frontendUrl}/signup` }),
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
