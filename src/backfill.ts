import { resolve } from 'node:path';
import { DATA_FLOOR } from './api/types.ts';
import { LocalStore } from './store/local.ts';
import { crawlRange, todayIso } from './crawl.ts';

/**
 * One-time historical crawl: DATA_FLOOR (2017-03) to today, ~495 weekly windows.
 * Resumable — completed windows are recorded, so re-running skips them.
 *
 *   backfill.ts                       full history
 *   backfill.ts 2024-01-01 2024-12-31 a specific range
 */

const DB_PATH = process.env.MYCLUJ_DB ?? 'data/mycluj.db';

async function main(): Promise<void> {
  const store = new LocalStore(DB_PATH);
  const res = await crawlRange(store, {
    from: process.argv[2] ?? DATA_FLOOR,
    to: process.argv[3] ?? todayIso(),
    state: 'A',
    label: 'backfill',
  });

  const c = store.counts();
  console.log(`\n  fetched     : ${res.records} records across ${res.windows} windows`);
  console.log(`  new/changed : ${res.inserted} inserted, ${res.changed} changed`);
  console.log(`  failures    : ${res.failures.length}`);
  console.log(`  db totals   : ${c.tickets} tickets, ${c.observations} observations, ${c.windows} windows`);
  store.close();
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  await main();
}
