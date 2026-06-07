import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // loan_installments
  await knex.schema.createTable('loan_installments', (t) => {
    t.increments('id').primary()
    t.integer('loan_id').notNullable().references('id').inTable('loans').onDelete('CASCADE')
    t.integer('installment_no').notNullable()
    t.date('due_date').notNullable()
    t.decimal('amount_due', 12, 2).notNullable()
    t.decimal('principal_portion', 12, 2).notNullable().defaultTo(0)
    t.decimal('interest_portion', 12, 2).notNullable().defaultTo(0)
    t.decimal('paid_amount', 12, 2).notNullable().defaultTo(0)
    t.date('paid_date')
    t.enu('status', ['pending', 'paid', 'partial', 'overdue', 'skipped'])
      .notNullable().defaultTo('pending')
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    t.unique(['loan_id', 'installment_no'])
  })

  await knex.raw('CREATE INDEX idx_installments_loan_id ON loan_installments(loan_id)')
  await knex.raw('CREATE INDEX idx_installments_due_date ON loan_installments(due_date)')
  await knex.raw('CREATE INDEX idx_installments_status ON loan_installments(status)')

  // payments
  await knex.schema.createTable('payments', (t) => {
    t.increments('id').primary()
    t.string('payment_number', 30).notNullable().unique()
    t.integer('loan_id').notNullable().references('id').inTable('loans').onDelete('RESTRICT')
    t.integer('installment_id').references('id').inTable('loan_installments').onDelete('SET NULL')
    t.decimal('amount', 12, 2).notNullable()
    t.decimal('principal_paid', 12, 2).notNullable().defaultTo(0)
    t.decimal('interest_paid', 12, 2).notNullable().defaultTo(0)
    t.decimal('over_payment', 12, 2).notNullable().defaultTo(0)
    t.date('payment_date').notNullable()
    t.enu('payment_type', ['normal', 'partial', 'rollover', 'full', 'bad_debt_recover'])
      .notNullable().defaultTo('normal')
    t.enu('payment_method', ['cash', 'transfer', 'other']).notNullable().defaultTo('cash')
    t.text('note')
    t.integer('created_by').references('id').inTable('users').onDelete('SET NULL')
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })

  await knex.raw('CREATE INDEX idx_payments_loan_id ON payments(loan_id)')
  await knex.raw('CREATE INDEX idx_payments_date ON payments(payment_date)')
  await knex.raw('CREATE INDEX idx_payments_type ON payments(payment_type)')
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('payments')
  await knex.schema.dropTableIfExists('loan_installments')
}
