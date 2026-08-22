import { RESULT_CAP, type IncidentState, type RawTicket } from './types.ts';

const ENDPOINT = 'https://report.e-primariaclujnapoca.ro/IncidentRP.aspx';
const ORIGIN = 'https://mycluj.e-primariaclujnapoca.ro';

/**
 * Bare numeric bodies the endpoint returns instead of JSON on failure.
 * Taken verbatim from the site's own client (`ajaxCalls.js`: `var errors = "1 2 4 5 9 10"`).
 */
const ERROR_BODIES = new Set(['1', '2', '4', '5', '9', '10']);

export class MyClujError extends Error {
  readonly retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = 'MyClujError';
    this.retryable = retryable;
  }
}

/** Thrown when a window returns exactly RESULT_CAP records and is therefore incomplete. */
export class ResultCapError extends Error {
  readonly from: string;
  readonly to: string;
  constructor(from: string, to: string) {
    super(
      `Window ${from}..${to} returned ${RESULT_CAP} records — the server cap. ` +
        `Results are silently truncated to the earliest ${RESULT_CAP} by date. Narrow the window.`,
    );
    this.name = 'ResultCapError';
    this.from = from;
    this.to = to;
  }
}

/** "2026-08-22" -> "22/08/2026", the only format the endpoint accepts. */
export function toApiDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Expected YYYY-MM-DD, got "${iso}"`);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/**
 * The endpoint nests records that share identical coordinates into a sub-array
 * instead of emitting them flat. The city's own map does `data.forEach(addMarkers)`
 * and therefore silently drops every nested record. We flatten so nothing is lost.
 */
export function flattenTickets(parsed: unknown): RawTicket[] {
  const out: RawTicket[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
    } else if (node && typeof node === 'object' && 'ticketnumber' in node) {
      out.push(node as RawTicket);
    }
  };
  walk(parsed);
  return out;
}

export interface FetchOptions {
  state?: IncidentState;
  /** Category ids to filter to. Empty/omitted means all categories. */
  categoryIds?: number[];
  /** Look up a single ticket by number. When set, the date range is ignored. */
  incidentNo?: string;
  signal?: AbortSignal;
}

async function postOnce(body: URLSearchParams, signal?: AbortSignal): Promise<string> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Origin: ORIGIN,
        Referer: `${ORIGIN}/`,
        Accept: '*/*',
        'User-Agent': 'mycluj-mirror/0.1 (civic transparency mirror; contact via repository)',
      },
      body,
      signal,
    });
  } catch (cause) {
    throw new MyClujError(`Network failure: ${(cause as Error).message}`, true);
  }

  if (res.status >= 500 || res.status === 429) {
    throw new MyClujError(`HTTP ${res.status}`, true);
  }
  if (!res.ok) {
    throw new MyClujError(`HTTP ${res.status}`, false);
  }
  return res.text();
}

/**
 * Fetch one window. Returns every ticket, nested records included.
 *
 * Throws ResultCapError when the window is too wide — the server truncates
 * silently, so a caller that ignored this would build a quietly incomplete dataset.
 */
export async function fetchWindow(
  fromIso: string,
  toIso: string,
  opts: FetchOptions = {},
): Promise<RawTicket[]> {
  const isLookup = Boolean(opts.incidentNo);
  const body = new URLSearchParams({
    categorycodelist: (opts.categoryIds ?? []).join(','),
    state: opts.state ?? 'A',
    incidentfromdate: isLookup ? '' : toApiDate(fromIso),
    incidenttodate: isLookup ? '' : toApiDate(toIso),
    incidentno: opts.incidentNo ?? '',
    calltype: 'P', // Ignored server-side; sent to match the official client exactly.
  });

  const maxRetries = Number(process.env.MYCLUJ_MAX_RETRIES ?? 4);
  let lastErr: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const text = await postOnce(body, opts.signal);
      const trimmed = text.trim();

      if (ERROR_BODIES.has(trimmed)) {
        throw new MyClujError(`Server returned error code "${trimmed}"`, true);
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        throw new MyClujError(
          `Unparseable response (${trimmed.length} bytes): ${trimmed.slice(0, 120)}`,
          true,
        );
      }

      const tickets = flattenTickets(parsed);
      if (!isLookup && tickets.length >= RESULT_CAP) {
        throw new ResultCapError(fromIso, toIso); // Not retryable — the window itself is wrong.
      }
      return tickets;
    } catch (err) {
      if (err instanceof ResultCapError) throw err;
      lastErr = err;
      const retryable = err instanceof MyClujError ? err.retryable : false;
      if (!retryable || attempt === maxRetries) break;
      const backoff = Math.min(30_000, 800 * 2 ** attempt) + Math.floor(Math.random() * 400);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw lastErr;
}

/** Fetch a single ticket by number, or null if it does not exist. */
export async function fetchTicket(ticketNumber: string): Promise<RawTicket | null> {
  const rows = await fetchWindow('', '', { incidentNo: ticketNumber });
  return rows[0] ?? null;
}
