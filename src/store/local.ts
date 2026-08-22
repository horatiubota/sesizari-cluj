import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { RawTicket } from '../api/types.ts';

/**
 * Local landing zone for the crawl.
 *
 * The crawl is the only expensive, rate-limit-exposed step, so it writes here
 * first and Postgres is loaded from this file afterwards. A schema change then
 * costs a re-load (seconds) instead of a re-crawl (~500 requests against a
 * municipal server).
 */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS tickets_raw (
  ticket_number TEXT PRIMARY KEY,
  payload       TEXT NOT NULL,          -- verbatim JSON as returned
  content_hash  TEXT NOT NULL,          -- hash of mutable fields, for change detection
  first_seen_at TEXT NOT NULL,
  last_seen_at  TEXT NOT NULL
);

-- Append-only observation log: every time a ticket's mutable content changes,
-- one row lands here. This is the history the city's API does not expose.
CREATE TABLE IF NOT EXISTS ticket_observations (
  ticket_number TEXT NOT NULL,
  observed_at   TEXT NOT NULL,
  status        TEXT,
  resolvereason TEXT,
  content_hash  TEXT NOT NULL,
  PRIMARY KEY (ticket_number, content_hash)
);

-- Completed crawl windows, so an interrupted backfill resumes instead of restarting.
CREATE TABLE IF NOT EXISTS fetch_log (
  window_from  TEXT NOT NULL,
  window_to    TEXT NOT NULL,
  state        TEXT NOT NULL,
  fetched_at   TEXT NOT NULL,
  record_count INTEGER NOT NULL,
  PRIMARY KEY (window_from, window_to, state)
);

CREATE INDEX IF NOT EXISTS idx_obs_ticket ON ticket_observations(ticket_number);
`;

/** Fields that can change after creation. Hashing only these avoids false churn. */
function contentHash(t: RawTicket): string {
  const material = JSON.stringify([
    t.description ?? '',
    t.status ?? '',
    t.resolvereason ?? '',
    t.category ?? '',
    t.latitude ?? '',
    t.longitude ?? '',
    t.isedited ?? '',
  ]);
  return createHash('sha256').update(material).digest('hex').slice(0, 32);
}

export interface UpsertStats {
  inserted: number;
  changed: number;
  unchanged: number;
}

export class LocalStore {
  #db: DatabaseSync;

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.#db = new DatabaseSync(path);
    this.#db.exec('PRAGMA journal_mode = WAL');
    this.#db.exec('PRAGMA synchronous = NORMAL');
    this.#db.exec(SCHEMA);
  }

  close(): void {
    this.#db.close();
  }

  isWindowDone(from: string, to: string, state: string): boolean {
    const row = this.#db
      .prepare('SELECT 1 FROM fetch_log WHERE window_from=? AND window_to=? AND state=?')
      .get(from, to, state);
    return row !== undefined;
  }

  markWindowDone(from: string, to: string, state: string, count: number): void {
    this.#db
      .prepare(
        `INSERT INTO fetch_log (window_from, window_to, state, fetched_at, record_count)
         VALUES (?,?,?,?,?)
         ON CONFLICT(window_from, window_to, state) DO UPDATE SET
           fetched_at=excluded.fetched_at, record_count=excluded.record_count`,
      )
      .run(from, to, state, new Date().toISOString(), count);
  }

  upsertMany(tickets: RawTicket[]): UpsertStats {
    const now = new Date().toISOString();
    const stats: UpsertStats = { inserted: 0, changed: 0, unchanged: 0 };

    const selectHash = this.#db.prepare('SELECT content_hash FROM tickets_raw WHERE ticket_number=?');
    const insertTicket = this.#db.prepare(
      `INSERT INTO tickets_raw (ticket_number, payload, content_hash, first_seen_at, last_seen_at)
       VALUES (?,?,?,?,?)
       ON CONFLICT(ticket_number) DO UPDATE SET
         payload=excluded.payload,
         content_hash=excluded.content_hash,
         last_seen_at=excluded.last_seen_at`,
    );
    const insertObs = this.#db.prepare(
      `INSERT INTO ticket_observations (ticket_number, observed_at, status, resolvereason, content_hash)
       VALUES (?,?,?,?,?)
       ON CONFLICT(ticket_number, content_hash) DO NOTHING`,
    );

    this.#db.exec('BEGIN');
    try {
      for (const t of tickets) {
        if (!t.ticketnumber) continue;
        const hash = contentHash(t);
        const prev = selectHash.get(t.ticketnumber) as { content_hash: string } | undefined;

        if (!prev) stats.inserted++;
        else if (prev.content_hash !== hash) stats.changed++;
        else stats.unchanged++;

        insertTicket.run(t.ticketnumber, JSON.stringify(t), hash, now, now);
        insertObs.run(t.ticketnumber, now, t.status ?? null, t.resolvereason ?? null, hash);
      }
      this.#db.exec('COMMIT');
    } catch (err) {
      this.#db.exec('ROLLBACK');
      throw err;
    }
    return stats;
  }

  counts(): { tickets: number; observations: number; windows: number } {
    const one = (sql: string): number =>
      (this.#db.prepare(sql).get() as { n: number }).n;
    return {
      tickets: one('SELECT COUNT(*) AS n FROM tickets_raw'),
      observations: one('SELECT COUNT(*) AS n FROM ticket_observations'),
      windows: one('SELECT COUNT(*) AS n FROM fetch_log'),
    };
  }

  *iterateTickets(batchSize = 5000): Generator<RawTicket[]> {
    const stmt = this.#db.prepare(
      'SELECT payload FROM tickets_raw ORDER BY ticket_number LIMIT ? OFFSET ?',
    );
    for (let offset = 0; ; offset += batchSize) {
      const rows = stmt.all(batchSize, offset) as { payload: string }[];
      if (rows.length === 0) return;
      yield rows.map((r) => JSON.parse(r.payload) as RawTicket);
    }
  }
}
