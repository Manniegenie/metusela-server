const express = require("express");
const mongoose = require("mongoose");
const app = express();
const User = require("./Userschema"); // Import User model from Userschema.js
const bcrypt = require("bcrypt");
const axios = require("axios");
const config = require("./config"); // Import configurations

// Connect to MongoDB
mongoose.connect(config.mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('Connected to MongoDB')).catch(err => console.error('MongoDB error:', err));

// Middleware
app.use(express.json());

app.post("/signup", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: "Email and password are required",
    });
  }

  const emailDomainRegex = /@(gmail|yahoo|hotmail)\.com$/i;
  if (!emailDomainRegex.test(email)) {
    return res.status(400).json({
      success: false,
      error: "Invalid email domain",
      message: "Email must end with @gmail.com, @yahoo.com, or @hotmail.com",
    });
  }

  if (!config.passwordRegex.test(password)) {
    return res.status(400).json({
      success: false,
      error: "Password must be 6-15 characters and contain at least one number and one special character",
    });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: "Email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, config.saltRounds);
    const user = new User({
      email,
      password: hashedPassword,
      monoAccountIds: [] // Initialize as empty array
    });

    await user.save();
    res.status(201).json({
      success: true,
      message: "User created successfully",
      user: {
        email: user.email,
        accountIDs: user.monoAccountIds,
      },
    });
  } catch (_error) {
    res.status(500).json({
      success: false,
      error: "An error occurred during signup",
    });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: "Email and password are required",
    });
  }

  const emailDomainRegex = /@(gmail|yahoo|hotmail)\.com$/i;
  if (!emailDomainRegex.test(email)) {
    return res.status(400).json({
      success: false,
      error: "Invalid email domain",
      message: "Email must end with @gmail.com, @yahoo.com, or @hotmail.com",
    });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: "Incorrect password",
      });
    }

    res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        email: user.email,
        accountIDs: user.monoAccountIds || [],
      },
    });
  } catch (_error) {
    res.status(500).json({
      success: false,
      error: "An error occurred during login",
    });
  }
});

app.post('/check-linked-accounts', async (req, res) => {
    try {
      const { name, email } = req.body;
  
      if (!name || !email) {
        return res.status(400).json({
          status: 'error',
          error: 'Name and email are required',
        });
      }

      const validEmailDomains = /\.(com)$/i;
      const emailDomainRegex = /@(gmail|yahoo|hotmail)\.com$/i;
      if (!emailDomainRegex.test(email) || !validEmailDomains.test(email)) {
        return res.status(400).json({
          error: 'Invalid email domain',
          message: 'Email must end with @gmail.com, @yahoo.com, or @hotmail.com',
        });
      }
  
      const options = {
        method: 'POST',
        url: 'https://api.withmono.com/v2/accounts/initiate',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'mono-sec-key': config.monoSecretKey,
        },
        data: {
          customer: {
            name,
            email,
          },
          meta: { ref: '99008877TEST' },
          scope: 'auth',
          redirect_url: config.monoRedirectUrl,
        },
      };
  
      const response = await axios.request(options);
      const data = response.data;
  
      if (data.status !== 'successful' || !data.data || !data.data.mono_url) {
        throw new Error('Unexpected response format from Mono API');
      }
  
      res.json({
        status: 'requires_linking',
        message: 'Please proceed with linking your bank account',
        data: {
          mono_url: data.data.mono_url,
          customer: data.data.customer,
          meta: data.data.meta,
          scope: data.data.scope,
          redirect_url: data.data.redirect_url,
          created_at: data.data.created_at,
        },
      });
    } catch (_error) {
      console.error('Check linked accounts error:', _error.response?.data || _error.message);
      res.status(500).json({
        status: 'error',
        error: 'Failed to initiate account linking',
        details: _error.response?.data?.message || _error.message,
      });
    }
});

app.post('/link-mono-account', async (req, res) => {
  try {
    const { code, email, signupEmail } = req.body;

    if (!code || !email || !signupEmail) {
      return res.status(400).json({
        error: 'Code, linking email, and signup email are required',
      });
    }

    if (email !== signupEmail) {
      return res.status(400).json({
        error: 'Email mismatch',
        message: 'The linking email must match the signup email',
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'No user found with this email. Please sign up first.',
      });
    }

    // Check if the user has reached the maximum number of linked accounts (3)
    if (user.monoAccountIds && user.monoAccountIds.length >= 3) {
      return res.status(400).json({
        error: 'Account limit reached',
        message: 'Maximum of 3 bank accounts can be linked to an email address',
      });
    }

    const authResponse = await axios.post(
      'https://api.withmono.com/v2/accounts/auth',
      { code },
      {
        headers: {
          'Content-Type': 'application/json',
          'accept': 'application/json',
          'mono-sec-key': config.monoSecretKey,
        },
      }
    );

    const monoAccountId = authResponse.data.id;
    if (!monoAccountId) {
      throw new Error('No account ID returned from Mono API');
    }

    // Check if this account ID is already linked
    if (user.monoAccountIds && user.monoAccountIds.includes(monoAccountId)) {
      return res.status(400).json({
        error: 'Account already linked',
        message: 'This bank account is already linked to your email',
      });
    }

    // Add the new account ID to the array
    const updatedUser = await User.findOneAndUpdate(
      { email },
      { $push: { monoAccountIds: monoAccountId } },
      { new: true }
    );

    res.json({
      status: 'successful',
      message: 'Bank account linked successfully',
      data: {
        email: updatedUser.email,
        accountIDs: updatedUser.monoAccountIds,
        updatedAt: updatedUser.updatedAt,
      },
    });
  } catch (_error) {
    console.error('Mono linking error:', _error.response?.data || _error.message);
    res.status(_error.response?.status || 500).json({
      error: 'Failed to link bank account',
      details: _error.response?.data?.message || _error.message,
    });
  }
});

app.listen(config.port, () => console.log(`Server running on port ${config.port}`));