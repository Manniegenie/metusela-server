require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");

const signUpRoutes = require("./routes/sign-up");
const loginRoutes = require("./routes/login");
const walletRoutes = require("./routes/connect-wallet");
const escrowRoutes = require("./routes/escrow");
const emailserviceRoutes = require("./routes/verify-email")
const verifyRoutes = require("./routes/verify")
const banklinkingRoutes = require("./routes/banklinking");

const app = express();

// **Database Connection**
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => {
        console.error("❌ MongoDB Connection Error:", err.message);
        process.exit(1);
    });

// **Middleware**
app.use(express.json());
app.use(cors());
app.use(helmet());

// **Global Rate Limiter**
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { success: false, error: "Too many requests, please try again later" },
});
app.use(apiLimiter);

// **JWT Authentication Middleware**
const authenticateToken = (req, res, next) => {
    const token = req.headers["authorization"]?.split(" ")[1]; // Expect "Bearer <token>"
    if (!token) return res.status(401).json({ success: false, error: "Unauthorized" });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, error: "Forbidden" });
        req.user = user;
        next();
    });
};

// **Public Routes**
app.use("/sign-up", signUpRoutes);
app.use("/login", loginRoutes);
app.use("/verify-email", emailserviceRoutes)
app.use("/verify", verifyRoutes)


// **Protected Routes**
app.use("/connect-wallet", authenticateToken, walletRoutes);
app.use("/banklinking", authenticateToken, banklinkingRoutes);
app.use("/escrow", authenticateToken, escrowRoutes);


// **Root Route**
app.get("/", (req, res) => res.send("🚀 OnePage API Running"));

// **Global Error Handler**
app.use((err, req, res,) => {
    console.error("Unhandled error:", err.stack);
    res.status(500).json({ success: false, error: "Internal Server Error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🔥 Server running on port ${PORT}`));