// index.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const config = require('./routes/config'); // Adjust path if needed
const connectWalletRoutes = require('./routes/connect-wallet'); // From previous example
const loginRoutes = require('./routes/login'); // New login module
const signuproutes = require('./routes/sign-up');

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// MongoDB connection
mongoose.connect(config.mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB error:', err));

// Mount routes
app.use('/connect-wallet', connectWalletRoutes);
app.use('/login', loginRoutes);
app.use('/signup', signuproutes);

// Start server
const port = process.env.PORT || 3000; // Railway sets PORT
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});