import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('payments', (t) => {
    t.decimal('fine_paid', 12, 2).notNullable().defaultTo(0)
  })
  // Backfill: existing rows keep 0 (no fines before this feature)
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('payments', (t) => {
    t.dropColumn('fine_paid')
  })
}
