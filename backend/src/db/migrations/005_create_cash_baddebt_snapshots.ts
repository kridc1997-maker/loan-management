import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // cash_transactions
  await knex.schema.createTable('cash_transactions', (t) => {
    t.increments('id').primary()
    t.string('txn_number', 30).notNullable().unique()
    t.enu('txn_type', ['loan_out', 'interest_in', 'principal_in', 'expense', 'capital_in', 'capital_out'])
      .notNullable()
    t.enu('direction', ['in', 'out']).notNullable()
    t.decimal('amount', 12, 2).notNullable()
    t.decimal('balance_after', 12, 2).notNullable()
    t.integer('loan_id').references('id').inTable('loans').onDelete('SET NULL')
    t.integer('payment_id').references('id').inTable('payments').onDelete('SET NULL')
    t.text('description')
    t.date('txn_date').notNullable()
    t.integer('created_by').references('id').inTable('users').onDelete('SET NULL')
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })

  await knex.raw('CREATE INDEX idx_cash_txn_date ON cash_transactions(txn_date)')
  await knex.raw('CREATE INDEX idx_cash_txn_type ON cash_transactions(txn_type)')

  // loan_rollovers
  await knex.schema.createTable('loan_rollovers', (t) => {
    t.increments('id').primary()
    t.integer('original_loan_id').notNullable().references('id').inTable('loans').onDelete('RESTRICT')
    t.integer('new_loan_id').notNullable().references('id').inTable('loans').onDelete('RESTRICT')
    t.date('rollover_date').notNullable()
    t.decimal('interest_collected', 12, 2).notNullable()
    t.decimal('carried_principal', 12, 2).notNullable()
    t.text('note')
    t.integer('created_by').references('id').inTable('users').onDelete('SET NULL')
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })

  // bad_debts
  await knex.schema.createTable('bad_debts', (t) => {
    t.increments('id').primary()
    t.integer('loan_id').notNullable().references('id').inTable('loans').onDelete('RESTRICT').unique()
    t.integer('customer_id').notNullable().references('id').inTable('customers').onDelete('RESTRICT')
    t.decimal('principal_lost', 12, 2).notNullable()
    t.decimal('interest_lost', 12, 2).notNullable()
    t.date('marked_date').notNullable()
    t.text('reason')
    t.boolean('is_recovered').notNullable().defaultTo(false)
    t.decimal('recovered_amount', 12, 2).defaultTo(0)
    t.date('recovered_date')
    t.integer('created_by').references('id').inTable('users').onDelete('SET NULL')
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })

  // Computed total_lost
  await knex.raw(`
    ALTER TABLE bad_debts
    ADD COLUMN total_lost DECIMAL(12,2) GENERATED ALWAYS AS (principal_lost + interest_lost) STORED
  `)

  await knex.raw('CREATE INDEX idx_bad_debts_customer ON bad_debts(customer_id)')

  // monthly_snapshots
  await knex.schema.createTable('monthly_snapshots', (t) => {
    t.increments('id').primary()
    t.date('snapshot_month').notNullable().unique()
    t.decimal('opening_cash', 12, 2).notNullable()
    t.decimal('closing_cash', 12, 2).notNullable()
    t.decimal('total_loan_out', 12, 2).notNullable()
    t.decimal('total_collected', 12, 2).notNullable()
    t.decimal('interest_collected', 12, 2).notNullable()
    t.decimal('principal_collected', 12, 2).notNullable()
    t.decimal('outstanding_principal', 12, 2).notNullable()
    t.decimal('new_bad_debt', 12, 2).notNullable().defaultTo(0)
    t.decimal('net_profit', 12, 2).notNullable()
    t.integer('active_loans_count').notNullable()
    t.integer('new_loans_count').notNullable()
    t.integer('closed_loans_count').notNullable()
    t.decimal('collection_rate', 6, 4)
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })

  // audit_logs
  await knex.schema.createTable('audit_logs', (t) => {
    t.bigIncrements('id').primary()
    t.integer('user_id').references('id').inTable('users').onDelete('SET NULL')
    t.string('action', 50).notNullable()
    t.string('entity_type', 50).notNullable()
    t.integer('entity_id')
    t.jsonb('old_data')
    t.jsonb('new_data')
    t.string('ip_address', 45)
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })

  await knex.raw('CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id)')
  await knex.raw('CREATE INDEX idx_audit_date ON audit_logs(created_at)')

  // settings
  await knex.schema.createTable('settings', (t) => {
    t.string('key', 100).primary()
    t.text('value').notNullable()
    t.text('description')
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('settings')
  await knex.schema.dropTableIfExists('audit_logs')
  await knex.schema.dropTableIfExists('monthly_snapshots')
  await knex.schema.dropTableIfExists('bad_debts')
  await knex.schema.dropTableIfExists('loan_rollovers')
  await knex.schema.dropTableIfExists('cash_transactions')
}
