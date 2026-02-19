/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function(knex) {
  // 1. assets
  await knex.schema.createTable('assets', (table) => {
    table.increments('id').primary();
    table.string('name', 100).notNullable().unique();
    table.string('code', 20).notNullable().unique();          // e.g. 'GOLD', 'DIA'
    table.text('description').nullable();
    table.timestamps(true, true);                             
  });

  // 2. accounts
  await knex.schema.createTable('accounts', (table) => {
    table.increments('id').primary();
    table.string('account_type').notNullable();               
    table.string('owner_id').nullable();                      // user identifier (e.g. 'Chakradhar'), null for system
    table.string('name').notNullable();                       
    table.integer('asset_id').notNullable().unsigned();
    // table.decimal('balance', 18, 2).notNullable().defaultTo(0);   Commenting out balance it is not optimal to store balance in a mutable way, we will calculate it from ledger entries
    table.foreign('asset_id').references('id').inTable('assets').onDelete('RESTRICT');
    table.unique(['owner_id', 'asset_id']);                   // one account per user per asset
    table.timestamps(true, true);
  });

  // 3. ledger_entries (immutable transaction log)
  await knex.schema.createTable('ledger_entries', (table) => {
    table.bigIncrements('id').primary();
    table.uuid('transaction_id').notNullable().index();       // same for debit + credit pair
    table.integer('debit_account_id').notNullable().unsigned();
    table.integer('credit_account_id').notNullable().unsigned();
    table.decimal('amount', 18, 2).notNullable();
    table.integer('asset_id').notNullable().unsigned();
    table.string('type').notNullable();                       // topup, bonus, spend, transfer, etc.
    table.string('description').nullable();
    table.uuid('idempotency_key').nullable().index();
    table.timestamp('executed_at').notNullable().defaultTo(knex.fn.now());
    table.foreign('debit_account_id').references('id').inTable('accounts');
    table.foreign('credit_account_id').references('id').inTable('accounts');
    table.foreign('asset_id').references('id').inTable('assets');
    table.index(['transaction_id', 'debit_account_id']);
    table.index(['transaction_id', 'credit_account_id']);
  });

  await knex.raw(`
    ALTER TABLE ledger_entries
    ADD CONSTRAINT amount_positive CHECK (amount > 0)
    `);

  // 4. idempotency_keys (to prevent duplicate processing)
  await knex.schema.createTable('idempotency_keys', (table) => {
    table.uuid('key').primary();
    table.string('operation_type').notNullable();             // topup, spend, bonus
    table.integer('account_id').nullable().unsigned();        // which account was affected
    table.uuid('transaction_id').nullable();
    table.string('status').notNullable().defaultTo('processed'); // processed / failed
    table.jsonb('response_payload').nullable();               // optional - store result
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('expires_at').nullable();                 // optional TTL
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('idempotency_keys');
  await knex.schema.dropTableIfExists('ledger_entries');
  await knex.schema.dropTableIfExists('accounts');
  await knex.schema.dropTableIfExists('assets');
};