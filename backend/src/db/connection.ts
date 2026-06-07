import knex from 'knex'
import dotenv from 'dotenv'

dotenv.config()

const isRemote = !!(process.env.DB_HOST && process.env.DB_HOST !== 'localhost')

const db = knex({
  client: 'postgresql',
  connection: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME ?? 'loan_management',
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    ssl: isRemote ? { rejectUnauthorized: false } : false,
  },
  pool: { min: 2, max: 10 },
  acquireConnectionTimeout: 10000,
})

export default db
