import { resolve } from 'node:path';
import { DATA_FLOOR } from './api/types.ts';
import { LocalStore } from './store/local.ts';
import { addDays, crawlRange, todayIso } from './crawl.ts';

/**
 * Incremental sync.
 *
 *   sync.ts                 last 30 days        (~5 requests)   — run daily
 *   sync.ts --days 90       last 90 days
 *   sync.ts --full          newest 10k tickets  (~20 requests)  — run weekly
 *   sync.ts --full --sweep 50000     a deeper sweep, same shape
 *   sync.ts --full --sweep all       every window back to 2017
 *
 * Why two modes: the daily pass catches new tickets quickly and cheaply. The
 * weekly pass re-reads windows already crawled, which is how status changes get
 * noticed — the upstream API exposes no "modified since" filter, so re-reading
 * is the only way to detect that an old ticket was just closed. Every change
 * lands in ticket_observations, building the resolution-time history the city
 * never publishes.
 *
 * The weekly pass walks newest window first and stops once it has seen
 * SWEEP_TICKETS records, rather than re-reading all ~213k every Sunday. That is
 * roughly the last four months at current volume, against about 500 windows for
 * the whole corpus.
 *
 * The cost of the bound: a ticket that changes status after it has fallen out
 * of the sweep window is never picked up again. Tickets are resolved well
 * inside four months as a rule, but a long-open one that closes late will keep
 * whatever status it last had here. Raise SWEEP_TICKETS, or run `--sweep all`
 * occasionally, if that starts to matter.
 */

const DB_PATH = process.env.MYCLUJ_DB ?? 'data/mycluj.db';

/** Records the weekly sweep re-reads before stopping. */
const SWEEP_TICKETS = 10_000;

/**
 * `--sweep <n>` or MYCLUJ_SWEEP_TICKETS overrides the default; `all` restores
 * the unbounded re-read. Anything else is rejected rather than quietly coerced,
 * since a NaN budget would silently sweep nothing at all.
 */
function parseSweep(argv: string[]): number | undefined {
  const idx = argv.indexOf('--sweep');
  const raw = (idx >= 0 ? argv[idx + 1] : process.env.MYCLUJ_SWEEP_TICKETS) ?? String(SWEEP_TICKETS);
  if (raw === 'all') return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`--sweep expects a positive number or "all", got "${raw}"`);
  }
  return Math.floor(n);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const full = argv.includes('--full');
  const daysIdx = argv.indexOf('--days');
  const days = daysIdx >= 0 ? Number(argv[daysIdx + 1] ?? 30) : 30;

  const budget = full ? parseSweep(argv) : undefined;

  const to = todayIso();
  const from = full ? DATA_FLOOR : addDays(to, -Math.abs(days));

  const store = new LocalStore(DB_PATH);
  // Always force: sync exists precisely to re-read windows already crawled.
  const res = await crawlRange(store, {
    from, to, state: 'A', force: true,
    newestFirst: full,
    budget,
    label: full
      ? budget === undefined
        ? 'full re-sweep'
        : `weekly sweep (newest ${budget} records)`
      : `sync last ${days}d`,
  });

  const c = store.counts();
  console.log(`\n  records seen : ${res.records}`);
  console.log(`  new tickets  : ${res.inserted}`);
  console.log(`  changed      : ${res.changed}`);
  console.log(`  failures     : ${res.failures.length}`);
  if (full) console.log(`  reached back : ${res.oldest ?? 'nothing fetched'}`);
  console.log(`  db totals    : ${c.tickets} tickets, ${c.observations} observations`);
  store.close();

  if (res.failures.length > 0) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  await main();
}
