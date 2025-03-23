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
};