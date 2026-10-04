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
    // This bounds the wait for a free pooled client as well as a new connection.
    // The dashboard fans out ~11 queries across these four clients, and through
    // the session pooler a fresh connection alone can take 2s; under two
    // overlapping renders a 10s budget ran out and failed the prerender. A page
    // rendered on a schedule can afford to wait.
    connectionTimeoutMillis: 30_000,
  });

if (process.env.NODE_ENV !== 'production') globalForDb.pool = pool;

/**
 * One retry, and only for failing to obtain a connection -- never for a query
 * that ran and errored, which would repeat work or mask a real bug. A transient
 * pooler stall should not cost a whole page render.
 */
export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  try {
    return (await pool.query(sql, params)).rows as T[];
  } catch (e) {
    if (!(e instanceof Error) || !/timeout exceeded when trying to connect|Connection terminated unexpectedly/.test(e.message)) throw e;
    await new Promise((r) => setTimeout(r, 1_000));
    return (await pool.query(sql, params)).rows as T[];
  }
}
