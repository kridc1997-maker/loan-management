import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('customers', (t) => {
    t.string('portal_token', 64).unique()
  })
  await knex.raw('CREATE INDEX idx_customers_portal_token ON customers(portal_token)')
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS idx_customers_portal_token')
  await knex.schema.alterTable('customers', (t) => {
    t.dropColumn('portal_token')
  })
}
