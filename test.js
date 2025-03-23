const jwt = require("jsonwebtoken");
const config = require("./routes/config"); // Assuming you have a config file with jwtSecret

// Function to generate a JWT token
const generateJwtToken = (email, options = {}) => {
  // Default options
  const defaultOptions = {
    secret: config.jwtSecret || "default-secret-key", // Fallback secret if config is missing
    expiresIn: "15m", // Default expiration: 15 minutes
  };

  // Merge provided options with defaults
  const { secret, expiresIn } = { ...defaultOptions, ...options };

  // Validate email
  if (!email || typeof email !== "string") {
    throw new Error("A valid email is required to generate a JWT token");
  }

  // Payload for the token
  const payload = { email };

  // Generate the token
  const token = jwt.sign(payload, secret, { expiresIn });

  console.log(`Generated JWT token for email: ${email}`);
  console.log(`Token: ${token}`);

  return token;
};

// Example usage
try {
  const testEmail = "testuser123@gmail.com";
  const token = generateJwtToken(testEmail, {
    expiresIn: "1h", // Optional: override expiration
    secret: config.jwtSecret, // Optional: override secret
  });
} catch (error) {
  console.error("Error generating token:", error.message);
}