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
    // Not only the TCP/TLS connect: pg-pool applies this same limit to a query
    // waiting in line for a free client, and reports both as "timeout exceeded
    // when trying to connect". The dashboard fires 12 queries at once over these
    // 4 clients, so the queued ones wait for the first ones to finish. At 10s,
    // from 2026-11-11 onward, that wait expired on every rebuild of `/` as the
    // table grew, and Next kept serving the 2026-11-10 render indefinitely.
    // Kept below the page's maxDuration (app/page.tsx) so a slow render fails
    // with a logged error rather than being killed silently by the platform.
    connectionTimeoutMillis: 45_000,
  });

if (process.env.NODE_ENV !== 'production') globalForDb.pool = pool;

export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool.query(sql, params);
  return res.rows as T[];
}
