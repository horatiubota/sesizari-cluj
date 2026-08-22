import { fetchWindow, ResultCapError } from './api/client.ts';
import type { IncidentState, RawTicket } from './api/types.ts';
import type { LocalStore } from './store/local.ts';

/** Shared crawl engine used by both the historical backfill and the daily sync. */

export const DELAY_MS = Number(process.env.MYCLUJ_DELAY_MS ?? 350);

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const todayIso = (): string => new Date().toISOString().slice(0, 10);

/** Inclusive weekly windows covering [start, end]. */
export function weeklyWindows(start: string, end: string): Array<{ from: string; to: string }> {
  const out: Array<{ from: string; to: string }> = [];
  let cursor = start;
  while (cursor <= end) {
    const to = addDays(cursor, 6);
    out.push({ from: cursor, to: to > end ? end : to });
    cursor = addDays(cursor, 7);
  }
  return out;
}

/**
 * Fetch a window, halving it if the server silently truncates at its 1500-record
 * cap. Weekly windows sat at 196-620 records across 2017-2026, so this is a
 * safety net rather than the normal path.
 */
export async function fetchAdaptive(
  from: string,
  to: string,
  state: IncidentState,
  depth = 0,
): Promise<RawTicket[]> {
  try {
    return await fetchWindow(from, to, { state });
  } catch (err) {
    if (!(err instanceof ResultCapError) || from === to || depth > 6) throw err;
    const spanDays = Math.round(
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
    );
    const mid = addDays(from, Math.max(0, Math.floor(spanDays / 2)));
    console.log(`\n    ! cap hit on ${from}..${to} — splitting at ${mid}`);
    const left = await fetchAdaptive(from, mid, state, depth + 1);
    await sleep(DELAY_MS);
    const right = await fetchAdaptive(addDays(mid, 1), to, state, depth + 1);
    return [...left, ...right];
  }
}

export interface CrawlOptions {
  from: string;
  to: string;
  state?: IncidentState;
  /** Re-fetch windows already recorded in the fetch log. */
  force?: boolean;
  label?: string;
}

export interface CrawlResult {
  windows: number;
  records: number;
  inserted: number;
  changed: number;
  failures: Array<{ from: string; to: string; error: string }>;
}

let aborted = false;
export const isAborted = (): boolean => aborted;

process.on('SIGINT', () => {
  if (aborted) process.exit(130);
  aborted = true;
  console.log('\n  interrupt received — finishing current window, then stopping cleanly.');
  console.log('  progress is saved; re-run to resume.');
});

export async function crawlRange(store: LocalStore, opts: CrawlOptions): Promise<CrawlResult> {
  const state = opts.state ?? 'A';
  const all = weeklyWindows(opts.from, opts.to);
  const pending = opts.force ? all : all.filter((w) => !store.isWindowDone(w.from, w.to, state));

  console.log(`${opts.label ?? 'crawl'} ${opts.from} -> ${opts.to} (state=${state})`);
  console.log(
    `  ${all.length} weekly windows, ${pending.length} pending, ${all.length - pending.length} already done\n`,
  );

  const result: CrawlResult = { windows: 0, records: 0, inserted: 0, changed: 0, failures: [] };
  const started = Date.now();

  for (const w of pending) {
    if (aborted) break;
    try {
      const tickets = await fetchAdaptive(w.from, w.to, state);
      const stats = store.upsertMany(tickets);
      store.markWindowDone(w.from, w.to, state, tickets.length);

      result.windows++;
      result.records += tickets.length;
      result.inserted += stats.inserted;
      result.changed += stats.changed;

      const pct = ((result.windows / pending.length) * 100).toFixed(1);
      const elapsed = (Date.now() - started) / 1000;
      const eta = ((elapsed / result.windows) * (pending.length - result.windows)) / 60;
      process.stdout.write(
        `\r  [${pct.padStart(5)}%] ${String(result.windows).padStart(4)}/${pending.length}  ` +
          `${w.from}  +${String(tickets.length).padStart(4)}  ` +
          `new ${result.inserted} chg ${result.changed}  eta ${eta.toFixed(1)}m   `,
      );
    } catch (err) {
      const msg = (err as Error).message;
      console.error(`\n  FAILED ${w.from}..${w.to}: ${msg}`);
      result.failures.push({ from: w.from, to: w.to, error: msg });
    }
    await sleep(DELAY_MS);
  }

  console.log(`\n  finished in ${((Date.now() - started) / 60000).toFixed(1)}m`);
  return result;
}
