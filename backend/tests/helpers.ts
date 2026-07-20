import db from '../src/db/connection'
import { generateCustomerCode } from '../src/utils/helpers'

const DATA_TABLES = [
  'payments', 'loan_installments', 'loan_rollovers', 'cash_transactions',
  'audit_logs', 'bad_debts', 'monthly_snapshots', 'loans', 'customers', 'users',
]

export async function resetDb() {
  await db.raw(`TRUNCATE TABLE ${DATA_TABLES.join(', ')} RESTART IDENTITY CASCADE`)
}

export async function createTestCustomer(overrides: Partial<Record<string, unknown>> = {}) {
  const code = await generateCustomerCode()
  const [customer] = await db('customers')
    .insert({
      code,
      first_name: 'ทดสอบ',
      last_name: 'ระบบ',
      phone: '090-000-0000',
      risk_level: 'normal',
      ...overrides,
    })
    .returning('*')
  return customer
}
