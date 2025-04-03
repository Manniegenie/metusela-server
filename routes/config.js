// config.js
require('dotenv').config(); // Load environment variables from .env file

module.exports = {
  passwordRegex: /^(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{6,15}$/,
  saltRounds: 10,
  monoSecretKey: process.env.MONO_SECRET_KEY,
  monoRedirectUrl: process.env.MONO_REDIRECT_URL,
  mongoUri: process.env.MONGO_URI,
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET, // Must be defined
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET,
  // Mailgun settings:
  mailgunApiKey: process.env.MAILGUN_API_KEY,
  mailgunDomain: process.env.MAILGUN_DOMAIN,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  googleCallbackURL: process.env.GOOGLE_CALLBACK_URL,
  
  
  // Frontend URL configuration:
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
};
