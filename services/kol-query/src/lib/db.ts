import { Pool } from 'pg'

let pool: Pool | null = null

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes('railway.app') || process.env.DATABASE_URL?.includes('railway.internal')
        ? { rejectUnauthorized: false }
        : false,
      max: 10,
      idleTimeoutMillis: 30000,
    })
    pool.on('error', (err) => console.error('[db] Pool error:', err))
  }
  return pool
}
