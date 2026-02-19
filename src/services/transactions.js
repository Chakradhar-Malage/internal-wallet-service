const { v4: uuidv4 } = require('uuid');
const knex = require('../config/knex');
const {getAccountBalance} = require('./balance');

async function issueBonus({
  ownerId,          // e.g. 'Chakradhar'
  amount,           
  assetCode = 'GOLD',
  idempotencyKey,   // required uuid 
  description = 'Referral bonus',
}) {
  if (!idempotencyKey) throw new Error('idempotencyKey is required');
  if (amount <= 0) throw new Error('Amount must be positive');

  return await knex.transaction(async (trx) => {
    // 1. Check idempotency first (inside transaction for atomicity)
    const existing = await trx('idempotency_keys')
      .where({ key: idempotencyKey })
      .first();

    if (existing) {
      if (existing.status === 'processed') {
        // Already done → return previous result (idempotent success)
        return {
          status: 'already_processed',
          transactionId: existing.transaction_id,
          message: 'Bonus already applied',
        };
      }
      throw new Error('Previous attempt failed — please try new key');
    }

    // 2. Find accounts (user + treasury)
    const userAccount = await trx('accounts')
      .join('assets', 'accounts.asset_id', 'assets.id')
      .where({
        'accounts.owner_id': ownerId,
        'assets.code': assetCode,
      })
      .select(
        'accounts.id as user_account_id',
        'accounts.asset_id'
        )

      .first();

    if (!userAccount) throw new Error(`User account not found: ${ownerId}`);

    const treasuryAccount = await trx('accounts')
      .where({
        account_type: 'system',
        name: 'Treasury',
        asset_id: userAccount.asset_id,  // reuse same asset
      })
      .select('id as treasury_account_id')
      .first();

    if (!treasuryAccount) throw new Error('Treasury account not found');

    // 3. Generate transaction ID (one for the pair)
    const transactionId = uuidv4();

    // 4. Insert two ledger entries (bonus = treasury → user)
    await trx('ledger_entries').insert({
    transaction_id: transactionId,
    debit_account_id: treasuryAccount.treasury_account_id,
    credit_account_id: userAccount.user_account_id,
    amount,
    asset_id: userAccount.asset_id,
    type: 'bonus',
    description,
    idempotency_key: idempotencyKey,
    executed_at: trx.fn.now(),
    });

    // 5. Record idempotency success
    await trx('idempotency_keys').insert({
      key: idempotencyKey,
      operation_type: 'bonus',
      account_id: userAccount.user_account_id,
      transaction_id: transactionId,
      status: 'processed',
      created_at: trx.fn.now(),
    });

    // 6. Get new balance
    const newBalance = await getAccountBalance(userAccount.user_account_id, trx);

    return {
      status: 'success',
      transactionId,
      ownerId,
      amount,
      newBalance,
      asset: assetCode,
    };
  });
}


/**
 * Spend credits from user wallet (user → treasury)
 * Prevents negative balance
 */
async function spend({
  ownerId,
  amount,
  assetCode = 'GOLD',
  idempotencyKey,
  description = 'In-game purchase',
}) {
  if (!idempotencyKey) throw new Error('idempotencyKey is required');
  if (amount <= 0) throw new Error('Amount must be positive');

  return await knex.transaction(async (trx) => {
    // 1. Idempotency check
    const existing = await trx('idempotency_keys')
      .where({ key: idempotencyKey })
      .first();

    if (existing) {
      if (existing.status === 'processed') {
        return {
          status: 'already_processed',
          transactionId: existing.transaction_id,
          message: 'Spend already applied',
        };
      }
      throw new Error('Previous attempt failed — try new key');
    }

    // 2. Find accounts + LOCK them to prevent races
    // We lock user first, then treasury → fixed order avoids deadlocks
    const userAccount = await trx('accounts')
      .join('assets', 'accounts.asset_id', 'assets.id')
      .where({
        'accounts.owner_id': ownerId,
        'assets.code': assetCode,
      })
      .select(
        'accounts.id as user_account_id',
        'accounts.asset_id'
      )
      .forUpdate()               // ← KEY: pessimistic lock on user row
      .first();

    if (!userAccount) throw new Error(`User account not found: ${ownerId}`);

    const treasuryAccount = await trx('accounts')
      .where({
        account_type: 'system',
        name: 'Treasury',
        asset_id: userAccount.asset_id,
      })
      .select('id as treasury_account_id')
      .forUpdate()               // ← lock treasury too
      .first();

    if (!treasuryAccount) throw new Error('Treasury not found');

    // 3. Check current balance INSIDE transaction (after locks)
    const currentBalance = await getAccountBalance(userAccount.user_account_id, trx);

    if (currentBalance < amount) {
      throw new Error('Insufficient balance');
    }

    // 4. Create transaction
    const transactionId = uuidv4();

    // Insert ONE ledger row: debit user, credit treasury
    await trx('ledger_entries').insert({
      transaction_id: transactionId,
      debit_account_id: userAccount.user_account_id,      // user loses
      credit_account_id: treasuryAccount.treasury_account_id,  // treasury gains
      amount,
      asset_id: userAccount.asset_id,
      type: 'spend',
      description,
      idempotency_key: idempotencyKey,
      executed_at: trx.fn.now(),
    });

    // 5. Record idempotency
    await trx('idempotency_keys').insert({
      key: idempotencyKey,
      operation_type: 'spend',
      account_id: userAccount.user_account_id,
      transaction_id: transactionId,
      status: 'processed',
      created_at: trx.fn.now(),
    });

    // 6. New balance
    const newBalance = await getAccountBalance(userAccount.user_account_id, trx);

    return {
      status: 'success',
      transactionId,
      ownerId,
      amount,
      newBalance,
      asset: assetCode,
    };
  });
}

module.exports = { issueBonus, spend };
