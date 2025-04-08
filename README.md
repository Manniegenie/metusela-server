Smart Contract Escrow API
A backend API built with Node.js, Express, and MongoDB to facilitate a smart contract escrow system. The API handles user registration, email verification, wallet connection, bank account linking, authentication via Google OAuth, token management, and personalized greetings based on user location.

Features
User Registration & Email Verification
Register new users with email confirmation and pending user verification.

User Authentication
Secure authentication using JWT tokens, password hashing with bcrypt, and refresh token support.

Wallet Connectivity
Secure wallet connection and authentication using cryptographic nonce and Ethereum signature verification.

Bank Account Linking
Integration with Mono API for initiating and authenticating bank account linking.

Google OAuth
Sign in using Google OAuth and link existing user accounts.

Dynamic Greetings
Provides customized greetings based on the user's country and local time.

Installation
Clone the repository:

bash
Copy
git clone https://github.com/yourusername/smart-contract-escrow-api.git

cd smart-contract-escrow-api
Install dependencies:


npm install

Configure Environment Variables:

Create a .env file in the root directory and add the following (example variables):

bash
Copy
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
Start the Server:

bash
Copy
npm start
The API server should be running on http://localhost:5000 (or the port you defined).

Usage
Endpoints:

Registration: POST /sign-up

Email Verification: POST /verify-email

Login: POST /login

Wallet Connection: POST /connect-wallet (protected via JWT)

Bank Linking: POST /banklinking (protected via JWT)

Greeting: GET /greeting (protected via JWT)

Google OAuth: GET /auth/google & /auth/google/callback

Token Refresh: POST /refreshtoken

Protected Routes:
Use the JWT token (Authorization: Bearer <token>) to access protected endpoints.

Contributing
Contributions are welcome! Feel free to submit issues or pull requests.

License
This project is licensed under the MIT License.
