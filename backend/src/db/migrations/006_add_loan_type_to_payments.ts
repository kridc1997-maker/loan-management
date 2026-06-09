import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // 1. Add loan_type column to payments
  await knex.schema.alterTable('payments', (t) => {
    t.enu('loan_type', ['single', 'installment', 'flexible', 'daily']).nullable()
  })

  // 2. Backfill from loans table
  await knex.raw(`
    UPDATE payments p
    SET loan_type = l.loan_type
    FROM loans l
    WHERE p.loan_id = l.id
  `)
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('payments', (t) => {
    t.dropColumn('loan_type')
  })
}
