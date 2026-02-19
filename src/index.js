// src/index.js
require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Wallet service is running',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

//temporarily
const { getUserBalance } = require('./services/balance');

app.get('/balance/:ownerId', async (req, res) => {
  try {
    const balance = await getUserBalance(req.params.ownerId);
    res.json({ owner: req.params.ownerId, balance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Wallet service running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});