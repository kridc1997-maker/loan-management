import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // roles
  await knex.schema.createTable('roles', (t) => {
    t.increments('id').primary()
    t.string('name', 50).notNullable().unique()
    t.jsonb('permissions').notNullable().defaultTo('{}')
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })

  // users
  await knex.schema.createTable('users', (t) => {
    t.increments('id').primary()
    t.integer('role_id').notNullable().references('id').inTable('roles').onDelete('RESTRICT')
    t.string('username', 50).notNullable().unique()
    t.string('password_hash', 255).notNullable()
    t.string('full_name', 100).notNullable()
    t.boolean('is_active').notNullable().defaultTo(true)
    t.timestamp('last_login_at', { useTz: true })
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })

  await knex.raw('CREATE INDEX idx_users_username ON users(username)')
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('users')
  await knex.schema.dropTableIfExists('roles')
}
