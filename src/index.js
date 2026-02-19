
require('dotenv').config();
const knex = require('./config/knex');
const express = require('express');
const { issueBonus } = require('./services/transactions');
const { spend } = require('./services/transactions');
const { getUserBalance } = require('./services/balance');
const {getAccountBalance} = require('./services/balance');
const { topUp } = require('./services/transactions');
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


app.post('/topup', async (req, res) => {
  try {
    const { ownerId, amount, idempotencyKey, description, paymentReference } = req.body;

    if (!ownerId || !amount || !idempotencyKey) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await topUp({
      ownerId,
      amount: Number(amount),
      idempotencyKey,
      description,
      paymentReference,
    });

    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    const status = err.message.includes('not found') ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
});


// GET /transactions/:ownerId?limit=10&offset=0
app.get('/transactions/:ownerId', async (req, res) => {
  try {
    const { ownerId } = req.params;
    const { limit = 10, offset = 0, assetCode = 'GOLD' } = req.query;

    const entries = await knex('ledger_entries')
      .join('accounts as debit_acc', 'ledger_entries.debit_account_id', 'debit_acc.id')
      .join('accounts as credit_acc', 'ledger_entries.credit_account_id', 'credit_acc.id')
      .join('assets', 'ledger_entries.asset_id', 'assets.id')
      .where(function () {
        this.where('debit_acc.owner_id', ownerId)
            .orWhere('credit_acc.owner_id', ownerId);
      })
      .andWhere('assets.code', assetCode)
      .select(
        'ledger_entries.id',
        'ledger_entries.transaction_id',
        'ledger_entries.type',
        'ledger_entries.amount',
        'ledger_entries.description',
        'ledger_entries.executed_at',
        knex.raw("CASE WHEN debit_acc.owner_id = ? THEN 'debit' ELSE 'credit' END AS direction", [ownerId]),
        knex.raw("debit_acc.name AS debit_account_name"),
        knex.raw("credit_acc.name AS credit_account_name")
      )
      .orderBy('ledger_entries.executed_at', 'desc')
      .limit(Number(limit))
      .offset(Number(offset));

    const total = await knex('ledger_entries')
      .join('accounts as debit_acc', 'ledger_entries.debit_account_id', 'debit_acc.id')
      .join('accounts as credit_acc', 'ledger_entries.credit_account_id', 'credit_acc.id')
      .where(function () {
        this.where('debit_acc.owner_id', ownerId)
            .orWhere('credit_acc.owner_id', ownerId);
      })
      .count('* as count')
      .first();

    res.json({
      ownerId,
      transactions: entries,
      pagination: {
        total: Number(total.count),
        limit: Number(limit),
        offset: Number(offset),
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Wallet service running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});