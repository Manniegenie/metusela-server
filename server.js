// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const config = require('./routes/config'); // Ensure this path is correct
const connectWalletRoutes = require('./routes/connect-wallet');
const loginRoutes = require('./routes/login');
const signupRoutes = require('./routes/sign-up');

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
    origin: 'http://localhost:5500', // Match your frontend origin
    credentials: true, // Allow cookies
}));

// Add a root route for testing
app.get('/', (req, res) => {
    res.send('Server is running!');
});

// MongoDB connection
mongoose.connect(config.mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => {
        console.error('MongoDB error:', err.message);
        process.exit(1); // Exit if DB fails to prevent hanging
    });

// Mount routes
app.use('/connect-wallet', connectWalletRoutes);
app.use('/login', loginRoutes);
app.use('/signup', signupRoutes);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});