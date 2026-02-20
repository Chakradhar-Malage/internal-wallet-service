/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('ledger_entries').del();
  await knex('idempotency_keys').del();
  await knex('accounts').del();
  await knex('assets').del();

  // 1. Insert assets
  const [{id : goldAssetId}] = await knex('assets')
    .insert([
      {
        name: 'Gold Coins',
        code: 'GOLD',
        description: 'In-game currency',
      }
    ])
    .returning('id');
    

  // 2. System account (Treasury)
  const [{id : treasuryId}] = await knex('accounts')
    .insert({
      account_type: 'system',
      owner_id: null,
      name: 'Treasury',
      asset_id: goldAssetId,
    })
    .returning('id');

  // 3. User accounts
  await knex('accounts').insert([
    {
      account_type: 'user',
      owner_id: 'Chakradhar',
      name: 'Chakradhar',
      asset_id: goldAssetId,
    },
    {
      account_type: 'user',
      owner_id: 'Vinod',
      name: 'Vinod',
      asset_id: goldAssetId,
    }
  ]);

    // 4. Initial Balances (Ledger Entries)
  const chakradharAccount = await knex('accounts')
    .where({ owner_id: 'Chakradhar' })
    .first();

  const vinodAccount = await knex('accounts')
    .where({ owner_id: 'Vinod' })
    .first();

  const { v4: uuidv4 } = require('uuid');

  await knex('ledger_entries').insert([
    {
      transaction_id: uuidv4(),
      debit_account_id: treasuryId,
      credit_account_id: chakradharAccount.id,
      amount: 799.00,
      asset_id: goldAssetId,
      type: 'initial_bonus',
      description: 'Initial seed balance',
      executed_at: knex.fn.now(),
    },
    {
      transaction_id: uuidv4(),
      debit_account_id: treasuryId,
      credit_account_id: vinodAccount.id,
      amount: 300.00,
      asset_id: goldAssetId,
      type: 'initial_bonus',
      description: 'Initial seed balance',
      executed_at: knex.fn.now(),
    }
  ]);

  console.log('Seed completed: 1 asset, 1 system account, 2 user accounts + initial balances created.');
};