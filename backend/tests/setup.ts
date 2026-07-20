import dotenv from 'dotenv'
import path from 'path'

// Must run before any test file imports src/db/connection.ts (or anything that
// transitively imports it) — override:true guarantees this wins even if the
// process already has DATABASE_URL set from somewhere else (e.g. an inherited
// shell env), so tests can never end up pointed at the real Supabase database.
dotenv.config({ path: path.resolve(__dirname, '../.env.test'), override: true })

if (process.env.NODE_ENV !== 'test' || process.env.DB_NAME !== 'loan_management_test') {
  throw new Error(
    `Refusing to run tests: expected NODE_ENV=test and DB_NAME=loan_management_test, got NODE_ENV=${process.env.NODE_ENV} DB_NAME=${process.env.DB_NAME}. ` +
    `Check backend/.env.test.`
  )
}
if (process.env.DATABASE_URL) {
  throw new Error('Refusing to run tests: DATABASE_URL is set, which would point tests at a remote database.')
}
