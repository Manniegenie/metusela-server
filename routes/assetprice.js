const express = require('express');
const axios = require('axios');

const router = express.Router();
let bitcoinPrice = null;

async function updateBitcoinPrice() {
  try {
    const response = await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
    bitcoinPrice = response.data.price;
    console.log(new Date(), 'Updated Bitcoin price:', bitcoinPrice);
  } catch (error) {
    console.error('Error fetching Bitcoin price:', error);
  }
}

updateBitcoinPrice();
setInterval(updateBitcoinPrice, 300000);

router.get('/bitcoin-price', (req, res) => {
  if (!bitcoinPrice) {
    return res.status(503).json({ error: 'Price not available yet' });
  }
  res.json({ price: bitcoinPrice, updatedAt: new Date().toISOString() });
});

module.exports = router;
