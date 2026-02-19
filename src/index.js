
require('dotenv').config();
const express = require('express');
const { issueBonus } = require('./services/transactions');
const { spend } = require('./services/transactions');
const { getUserBalance } = require('./services/balance');
const {getAccountBalance} = require('./services/balance');
const app = express();

app.use(express.json());

//health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Wallet service is running',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

// Get user balance by ownerId
app.get('/balance/:ownerId', async (req, res) => {
  try {
    const balance = await getUserBalance(req.params.ownerId);
    res.json({ owner: req.params.ownerId, balance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Bonus issuance endpoint
app.post('/bonus', async (req, res) => {
  try {
    const { ownerId, amount, idempotencyKey, description } = req.body;

    if (!ownerId || !amount || !idempotencyKey) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await issueBonus({
      ownerId,
      amount: Number(amount),
      idempotencyKey,
      description,
    });

    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});


// Spend endpoint
app.post('/spend', async (req, res) => {
  try {
    const { ownerId, amount, idempotencyKey, description } = req.body;

    if (!ownerId || !amount || !idempotencyKey) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await spend({
      ownerId,
      amount: Number(amount),
      idempotencyKey,
      description,
    });

    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    const status = err.message.includes('Insufficient') ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});


// Utility endpoint to generate UUID for idempotency keys (temp solution)
app.get('/uuid', (req, res) => {
  res.json({ idempotencyKey: require('uuid').v4() });
});


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Wallet service running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});