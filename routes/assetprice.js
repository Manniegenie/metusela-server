const express = require('express');
const axios = require('axios');
const config = require('./config');

const router = express.Router();
let bitcoinPrice = null;
let nairaPrice = null;

async function updateBitcoinPrice() {
  try {
    const { data } = await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
    bitcoinPrice = data.price;
    console.log(new Date(), 'Updated Bitcoin price:', bitcoinPrice);
  } catch (error) {
    console.error('Error fetching Bitcoin price:', error);
  }
}

async function updateNairaPrice() {
  try {
    const { data } = await axios.get('https://api.monierate.com/core/rates/latest.json?base=USDT&market=mid', {
      headers: { Authorization: `API_KEY: ${config.usdtpriceapi}` }
    });
    nairaPrice = data.price;
    console.log(new Date(), 'Updated Naira price:', nairaPrice);
  } catch (error) {
    console.error('Error fetching Naira price:', error);
  }
}

updateBitcoinPrice();
setInterval(updateBitcoinPrice, 300000);
updateNairaPrice();
setInterval(updateNairaPrice, 300000);

router.get('/bitcoin-price', (req, res) => {
  if (!bitcoinPrice) return res.status(503).json({ error: 'Bitcoin price not available yet' });
  res.json({ price: bitcoinPrice, updatedAt: new Date().toISOString() });
});

router.get('/usdt-price', (req, res) => {
  if (!nairaPrice) return res.status(503).json({ error: 'Naira price not available yet' });
  res.json({ price: nairaPrice, updatedAt: new Date().toISOString() });
});

module.exports = router;
