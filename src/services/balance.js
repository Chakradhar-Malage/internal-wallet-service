// src/services/balance.js
const knex = require('../config/knex'); 

/**
 * Get current balance for an account (derived from ledger)
 * @param {number} accountId
 * @returns {Promise<number>} balance (positive = funds available)
 */
async function getAccountBalance(accountId) {
  const result = await knex('ledger_entries')
    .select(
      knex.raw(`
        COALESCE(
          SUM(CASE WHEN credit_account_id = ? THEN amount ELSE 0 END) -
          SUM(CASE WHEN debit_account_id = ? THEN amount ELSE 0 END),
          0
        ) AS balance
      `, [accountId, accountId])
    )
    .first();

  return parseFloat(result.balance) || 0;
}

/**
 * Get balance for user by owner_id + asset code
 */
async function getUserBalance(ownerId, assetCode = 'GOLD') {
  const account = await knex('accounts')
    .join('assets', 'accounts.asset_id', 'assets.id')
    .where({ owner_id: ownerId, 'assets.code': assetCode })
    .select('accounts.id')
    .first();

  if (!account) throw new Error(`Account not found for ${ownerId}`);

  return getAccountBalance(account.id);
}

module.exports = { getAccountBalance, getUserBalance };