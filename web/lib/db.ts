import { Pool } from 'pg';

/**
 * Shared Postgres pool.
 *
 * Serverless invocations are short-lived and can be numerous, so the pool is
 * deliberately small and cached on globalThis to survive hot reloads in dev.
 * Connections go through Supabase's session pooler, which is also the only
 * IPv4-reachable endpoint for this project.
 */

const globalForDb = globalThis as unknown as { pool?: Pool };

export const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
    max: 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

if (process.env.NODE_ENV !== 'production') globalForDb.pool = pool;

export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool.query(sql, params);
  return res.rows as T[];
}
