
# Smart Contract Escrow API

A backend API built with Node.js, Express, and MongoDB to facilitate a smart contract escrow system. The API handles user registration, email verification, wallet connection, bank account linking, authentication via Google OAuth, token management, and personalized greetings based on user location.

---

## Features

- **User Registration & Email Verification**  
  - Register new users with email confirmation  
  - Manage pending users during verification

- **User Authentication**  
  - Secure login with JWT tokens  
  - Password hashing using bcrypt  
  - Refresh token support

- **Wallet Connectivity**  
  - Secure wallet connection via nonce generation and signature verification using Ethereum

- **Bank Account Linking**  
  - Integration with Mono API for bank account linking  
  - Initiation and authentication endpoints for bank linking

- **Google OAuth**  
  - Sign in using Google OAuth  
  - Link existing user accounts via Google

- **Dynamic Greetings**  
  - Customized greetings based on the user's country and local time

---

## Installation

1. **Clone the Repository**

   ```bash
   git clone https://github.com/yourusername/smart-contract-escrow-api.git
   cd smart-contract-escrow-api
   ```

2. **Install Dependencies**

   ```bash
   npm install
   ```

3. **Configure Environment Variables**

   Create a `.env` file in the root directory and add the following (example variables):

   ```bash
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   REFRESH_TOKEN_SECRET=your_refresh_token_secret
   MONO_SECRET_KEY=your_mono_secret_key
   MONO_REDIRECT_URL=your_mono_redirect_url
   MAILGUN_API_KEY=your_mailgun_api_key
   MAILGUN_DOMAIN=your_mailgun_domain
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_CALLBACK_URL=your_google_callback_url
   USDT_PRICE_API_KEY=your_usdt_price_api_key
   FRONTEND_URL=http://localhost:3000
   ```

4. **Start the Server**

   ```bash
   npm start
   ```

   The API server should be running on `http://localhost:5000` (or the port specified in your `.env`).

---

## API Usage

### Endpoints

- **Registration & Email Verification**
  - `POST /sign-up` – Register new users (creates a pending user)
  - `POST /verify-email` – Verify email and create the user account

- **Login & Token Refresh**
  - `POST /login` – Authenticate users and issue JWT tokens
  - `POST /refreshtoken` – Refresh the JWT access token

- **Wallet Connectivity**
  - `POST /connect-wallet` – Connect or authenticate the user’s wallet (protected with JWT)
  - `POST /disconnect-wallet` – Disconnect the user’s wallet (protected with JWT)

- **Bank Linking**
  - `POST /initiate` – Initiate bank account linking via Mono API
  - `POST /authenticate` – Authenticate bank linking via Mono API

- **Google OAuth**
  - `GET /auth/google` – Initiate Google OAuth authentication
  - `GET /auth/google/callback` – Google OAuth callback endpoint

- **Dashboard Greeting**
  - `GET /greeting` – Returns a personalized greeting based on the user's country and local time (protected with JWT)

### Protected Routes

For endpoints that require user authentication, include the JWT in the HTTP header:

```
Authorization: Bearer <your_jwt_token>
```

---

## Contributing

Contributions are welcome! Please submit issues or pull requests as needed.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

Simply copy the above content into your `README.md` file to provide a comprehensive overview of your project.
