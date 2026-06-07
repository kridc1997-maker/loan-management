import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('loans', (t) => {
    t.increments('id').primary()
    t.string('loan_number', 30).notNullable().unique()
    t.integer('customer_id').notNullable().references('id').inTable('customers').onDelete('RESTRICT')
    t.integer('parent_loan_id').references('id').inTable('loans').onDelete('SET NULL')

    // Amount fields
    t.decimal('principal_amount', 12, 2).notNullable()
    t.decimal('total_amount', 12, 2).notNullable()
    t.decimal('interest_rate', 6, 4).notNullable()
    t.enu('loan_type', ['single', 'installment']).notNullable().defaultTo('single')
    t.integer('total_installments').notNullable().defaultTo(1)
    t.decimal('installment_amount', 12, 2)

    // Dates
    t.date('issued_date').notNullable()
    t.date('due_date').notNullable()
    t.date('closed_date')

    // Progress tracking
    t.decimal('paid_principal', 12, 2).notNullable().defaultTo(0)
    t.decimal('paid_interest', 12, 2).notNullable().defaultTo(0)
    t.integer('paid_installments').notNullable().defaultTo(0)

    t.enu('status', ['active', 'completed', 'overdue', 'bad_debt', 'written_off'])
      .notNullable().defaultTo('active')

    t.text('note')
    t.integer('created_by').references('id').inTable('users').onDelete('SET NULL')
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })

  // Computed column: interest_amount
  await knex.raw(`
    ALTER TABLE loans
    ADD COLUMN interest_amount DECIMAL(12,2) GENERATED ALWAYS AS (total_amount - principal_amount) STORED
  `)

  await knex.raw('CREATE INDEX idx_loans_customer_id ON loans(customer_id)')
  await knex.raw('CREATE INDEX idx_loans_status ON loans(status)')
  await knex.raw('CREATE INDEX idx_loans_due_date ON loans(due_date)')
  await knex.raw('CREATE INDEX idx_loans_issued_date ON loans(issued_date)')
  await knex.raw('CREATE INDEX idx_loans_loan_number ON loans(loan_number)')
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('loans')
}
