import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('customers', (t) => {
    t.increments('id').primary()
    t.string('code', 20).notNullable().unique()
    t.string('first_name', 100).notNullable()
    t.string('last_name', 100).notNullable()
    t.string('phone', 20).notNullable()
    t.string('id_card', 20)
    t.text('address')
    t.string('occupation', 100)
    t.string('line_id', 100)
    t.enu('risk_level', ['low', 'normal', 'high', 'blacklist']).notNullable().defaultTo('normal')
    t.text('note')
    t.boolean('is_active').notNullable().defaultTo(true)
    t.integer('created_by').references('id').inTable('users').onDelete('SET NULL')
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })

  await knex.raw('CREATE INDEX idx_customers_phone ON customers(phone)')
  await knex.raw('CREATE INDEX idx_customers_code ON customers(code)')
  await knex.raw('CREATE INDEX idx_customers_name ON customers(first_name, last_name)')
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('customers')
}
