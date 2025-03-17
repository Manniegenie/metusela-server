const { ethers } = require('ethers');

// Test private key (from a dev wallet, NOT a real one!)
const privateKey = '0ba64360a4c43f12b4c43164f0d4f50420ed875dcf92477849c05ebf12bd3668'; // Replace with a test key
const wallet = new ethers.Wallet(privateKey);
const nonce = '715391'; // Use the nonce from Step 1
const message = `Sign this nonce to authenticate: ${nonce}`;

async function signMessage() {
  const signature = await wallet.signMessage(message);
  console.log('Signature:', signature);
  console.log('Address:', wallet.address);
}

signMessage();