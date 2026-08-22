import { resolve } from 'node:path';
import { DATA_FLOOR } from './api/types.ts';
import { LocalStore } from './store/local.ts';
import { addDays, crawlRange, todayIso } from './crawl.ts';

/**
 * Incremental sync.
 *
 *   sync.ts                 last 30 days   (~5 requests)  — run daily
 *   sync.ts --days 90       last 90 days
 *   sync.ts --full          entire history (~495 requests) — run weekly
 *
 * Why two modes: the daily pass catches new tickets quickly and cheaply. The
 * weekly full pass re-reads every window, which is how status changes on old
 * tickets get noticed — the upstream API exposes no "modified since" filter,
 * so re-reading is the only way to detect that a 2019 ticket was just closed.
 * Every change lands in ticket_observations, building the resolution-time
 * history the city never publishes.
 */

const DB_PATH = process.env.MYCLUJ_DB ?? 'data/mycluj.db';

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const full = argv.includes('--full');
  const daysIdx = argv.indexOf('--days');
  const days = daysIdx >= 0 ? Number(argv[daysIdx + 1] ?? 30) : 30;

  const to = todayIso();
  const from = full ? DATA_FLOOR : addDays(to, -Math.abs(days));

  const store = new LocalStore(DB_PATH);
  // Always force: sync exists precisely to re-read windows already crawled.
  const res = await crawlRange(store, {
    from, to, state: 'A', force: true,
    label: full ? 'full re-sweep' : `sync last ${days}d`,
  });

  const c = store.counts();
  console.log(`\n  records seen : ${res.records}`);
  console.log(`  new tickets  : ${res.inserted}`);
  console.log(`  changed      : ${res.changed}`);
  console.log(`  failures     : ${res.failures.length}`);
  console.log(`  db totals    : ${c.tickets} tickets, ${c.observations} observations`);
  store.close();

  if (res.failures.length > 0) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  await main();
}
