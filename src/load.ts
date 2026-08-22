import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { DatabaseSync } from 'node:sqlite';
import { scrub } from './scrub/pii.ts';
import type { RawTicket } from './api/types.ts';

/**
 * Load the local SQLite crawl into Postgres (Supabase).
 *
 *   load.ts --schema     apply sql/001_schema.sql first
 *   load.ts              load tickets + events
 *   load.ts --limit 1000 load a subset (useful for a first smoke test)
 *
 * Requires SUPABASE_DB_URL. Uses the service role connection, which bypasses RLS
 * and is the only way to reach the `private` schema.
 *
 * Idempotent: re-running upserts rather than duplicating.
 */

const DB_PATH = process.env.MYCLUJ_DB ?? 'data/mycluj.db';
const BATCH = 1000;

function requireDbUrl(): string {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.error('SUPABASE_DB_URL is not set. Copy .env.example to .env.local and fill it in,');
    console.error('then run:  env $(grep -v "^#" .env.local | xargs) pnpm load');
    process.exit(1);
  }
  return url;
}

/** "20/08/2026 15:29:18" -> "2026-08-20 15:29:18" (naive; Postgres applies the zone). */
export function toSqlTimestamp(createdon: string | null | undefined): string | null {
  if (!createdon) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(createdon.trim());
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]} ${m[4]}:${m[5]}:${m[6]}`;
}

export interface Row {
  ticket_number: string;
  category_id: number;
  description: string | null;
  resolve_reason: string | null;
  status_code: string;
  status_label: string;
  is_edited: boolean;
  lat: number | null;
  lon: number | null;
  created_at: string | null;
  redactions: string;
  raw_description: string | null;
  raw_resolve: string | null;
}

export /**
 * Coordinates arrive as strings and are not always valid.
 *
 * `Number('')` is 0, not NaN — so a naive parse turns a missing longitude into a
 * real-looking coordinate in the Gulf of Guinea. Anything outside a generous box
 * around Cluj is treated as absent rather than plotted somewhere wrong.
 */
const CLUJ_BOUNDS = { latMin: 46.0, latMax: 47.5, lonMin: 22.5, lonMax: 24.5 };

function parseCoord(v: string | null | undefined, axis: 'lat' | 'lon'): number | null {
  if (v == null || v.trim() === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const [min, max] =
    axis === 'lat' ? [CLUJ_BOUNDS.latMin, CLUJ_BOUNDS.latMax] : [CLUJ_BOUNDS.lonMin, CLUJ_BOUNDS.lonMax];
  return n >= min && n <= max ? n : null;
}

export function toRow(t: RawTicket): Row | null {
  if (!t.ticketnumber) return null;

  const [codeRaw, ...labelParts] = (t.status ?? '').split('|');
  const status_code = codeRaw === 'C' ? 'C' : 'O';
  const status_label = labelParts.join('|') || 'Necunoscut';

  const desc = t.description ?? null;
  const resolveRaw = t.resolvereason || null;

  const scrubbedDesc = desc === null ? null : scrub(desc);
  const scrubbedResolve = resolveRaw === null ? null : scrub(resolveRaw);

  const redactions: Record<string, number> = {};
  for (const s of [scrubbedDesc, scrubbedResolve]) {
    if (!s) continue;
    for (const [k, v] of Object.entries(s.redactions)) {
      if (v > 0) redactions[k] = (redactions[k] ?? 0) + v;
    }
  }

  return {
    ticket_number: t.ticketnumber,
    category_id: Number(t.categoryid) || 13,
    description: scrubbedDesc?.text ?? null,
    resolve_reason: scrubbedResolve?.text ?? null,
    status_code,
    status_label,
    is_edited: t.isedited === '1',
    lat: parseCoord(t.latitude, 'lat'),
    lon: parseCoord(t.longitude, 'lon'),
    created_at: toSqlTimestamp(t.createdon),
    redactions: JSON.stringify(redactions),
    // Keep verbatim text only where scrubbing actually changed something.
    raw_description: scrubbedDesc && scrubbedDesc.text !== desc ? desc : null,
    raw_resolve: scrubbedResolve && scrubbedResolve.text !== resolveRaw ? resolveRaw : null,
  };
}

/** ticket_number, category_id, description, resolve_reason, status_code,
    status_label, is_edited, lat, lon, created_at, redactions */
const TICKET_COLS = 11;

async function loadTickets(client: pg.Client, rows: Row[]): Promise<void> {
  const values: unknown[] = [];
  const tuples: string[] = [];

  rows.forEach((r, i) => {
    const b = i * TICKET_COLS;
    tuples.push(
      `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},` +
        `$${b + 8}::double precision,$${b + 9}::double precision,` +
        // Upstream timestamps are wall-clock Europe/Bucharest with no offset.
        // Letting Postgres apply the zone handles DST correctly.
        `($${b + 10}::timestamp AT TIME ZONE 'Europe/Bucharest'),$${b + 11}::jsonb,now(),now())`,
    );
    values.push(
      r.ticket_number, r.category_id, r.description, r.resolve_reason,
      r.status_code, r.status_label, r.is_edited, r.lat, r.lon,
      r.created_at, r.redactions,
    );
  });

  await client.query(
    `INSERT INTO public.tickets
       (ticket_number, category_id, description, resolve_reason, status_code,
        status_label, is_edited, lat, lon, created_at, redactions,
        first_seen_at, last_seen_at)
     VALUES ${tuples.join(',')}
     ON CONFLICT (ticket_number) DO UPDATE SET
       category_id    = excluded.category_id,
       description    = excluded.description,
       resolve_reason = excluded.resolve_reason,
       status_code    = excluded.status_code,
       status_label   = excluded.status_label,
       is_edited      = excluded.is_edited,
       lat            = excluded.lat,
       lon            = excluded.lon,
       created_at     = excluded.created_at,
       redactions     = excluded.redactions,
       last_seen_at   = now(),
       -- Stamp the first time we observe a close; clear it if it reopens.
       closed_at      = case
                          when excluded.status_code = 'C' and public.tickets.closed_at is null
                            then now()
                          when excluded.status_code = 'O' then null
                          else public.tickets.closed_at
                        end`,
    values,
  );
}

async function loadRaw(client: pg.Client, rows: Row[]): Promise<number> {
  const withRaw = rows.filter((r) => r.raw_description !== null || r.raw_resolve !== null);
  if (withRaw.length === 0) return 0;
  const values: unknown[] = [];
  const tuples: string[] = [];
  withRaw.forEach((r, i) => {
    const b = i * 4;
    tuples.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4})`);
    values.push(r.ticket_number, r.raw_description, r.raw_resolve, 'loaded');
  });
  await client.query(
    `INSERT INTO private.ticket_raw
       (ticket_number, description_raw, resolve_reason_raw, content_hash)
     VALUES ${tuples.join(',')}
     ON CONFLICT (ticket_number) DO UPDATE SET
       description_raw    = excluded.description_raw,
       resolve_reason_raw = excluded.resolve_reason_raw`,
    values,
  );
  return withRaw.length;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const limitIdx = argv.indexOf('--limit');
  const limit = limitIdx >= 0 ? Number(argv[limitIdx + 1]) : Infinity;

  const client = new pg.Client({
    connectionString: requireDbUrl(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  if (argv.includes('--schema')) {
    console.log('applying sql/001_schema.sql ...');
    await client.query(readFileSync('sql/001_schema.sql', 'utf8'));
    console.log('  schema applied');
  }

  const sqlite = new DatabaseSync(DB_PATH);
  const total = Math.min(
    limit,
    (sqlite.prepare('SELECT COUNT(*) n FROM tickets_raw').get() as { n: number }).n,
  );
  console.log(`loading ${total} tickets from ${DB_PATH}`);

  const stmt = sqlite.prepare('SELECT payload FROM tickets_raw ORDER BY ticket_number LIMIT ? OFFSET ?');
  let done = 0;
  let rawKept = 0;
  const started = Date.now();

  for (let off = 0; off < total; off += BATCH) {
    const size = Math.min(BATCH, total - off);
    const batch = (stmt.all(size, off) as { payload: string }[])
      .map((r) => toRow(JSON.parse(r.payload) as RawTicket))
      .filter((r): r is Row => r !== null);
    if (batch.length === 0) continue;

    await client.query('BEGIN');
    try {
      await loadTickets(client, batch);
      rawKept += await loadRaw(client, batch);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

    done += batch.length;
    const rate = done / ((Date.now() - started) / 1000);
    process.stdout.write(
      `\r  ${done}/${total}  (${((100 * done) / total).toFixed(1)}%)  ${rate.toFixed(0)} rows/s   `,
    );
  }

  console.log(`\n  loaded ${done} tickets, ${rawKept} with verbatim text retained`);

  const size = await client.query<{ pretty: string }>(
    `SELECT pg_size_pretty(pg_database_size(current_database())) AS pretty`,
  );
  console.log(`  database size: ${size.rows[0]?.pretty}`);

  sqlite.close();
  await client.end();
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  await main();
}
