import knex from 'knex'
import dotenv from 'dotenv'

dotenv.config()

const isRemote = !!(process.env.DATABASE_URL || (process.env.DB_HOST && process.env.DB_HOST !== 'localhost'))

const db = knex({
  client: 'postgresql',
  connection: process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        host: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? 5432),
        database: process.env.DB_NAME ?? 'loan_management',
        user: process.env.DB_USER ?? 'postgres',
        password: process.env.DB_PASSWORD ?? 'postgres',
        ssl: isRemote ? { rejectUnauthorized: false } : false,
      },
  // min kept low enough to leave headroom under Supabase's 15-connection pool cap
  // (shared with Studio/migrations); idleTimeoutMillis raised from pg's 10s default
  // so connections survive normal gaps between page navigations instead of reconnecting
  // (each reconnect to the remote DB costs ~1.3s).
  pool: { min: 4, max: 10, idleTimeoutMillis: 300000 },
  acquireConnectionTimeout: 10000,
})

export default db
