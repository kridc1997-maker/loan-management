import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('loans', (t) => {
    t.integer('term_days').nullable()
  })
  // Backfill existing rows from due_date - issued_date
  await knex.raw(`UPDATE loans SET term_days = (due_date::date - issued_date::date) WHERE term_days IS NULL`)
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('loans', (t) => {
    t.dropColumn('term_days')
  })
}
