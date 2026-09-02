'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * The watchlist, stored in the visitor's own browser.
 *
 * Deliberately localStorage rather than a table: the site has no accounts, no
 * cookies and no visitor identifier -- the analytics choice in layout.tsx turns
 * on exactly that -- and a favourites feature is the first thing that would ask
 * "who are you". Keeping the list client-side buys the feature without the site
 * learning anything about anybody. The cost is that it is per-browser, which the
 * share link on /urmarite softens.
 *
 * `starredAt` is the load-bearing field, not the ticket number. "Was it solved?"
 * is only answerable against a baseline: public.ticket_events records every
 * transition with an observed_at, so the question the API can actually answer is
 * "what happened to this ticket after that instant".
 */

const KEY = 'sesizari-cluj:watch:v1';

/**
 * Bounds the share link and the batch query alike. 200 tickets is far more than
 * anyone hand-picks, and the API refuses more, so the cap belongs on both sides.
 */
export const CAP = 200;

export const TICKET_RE = /^CAS-\d{4,10}$/;

export interface Watched {
  ticket: string;
  /** ISO instant the ticket was added. The baseline every diff is measured from. */
  starredAt: string;
  /** status_label at that moment, so the page can say what it changed *from*. */
  statusAtStar?: string;
}

/**
 * The snapshot handed to subscribers, cached deliberately.
 *
 * useSyncExternalStore compares snapshots by identity. Re-reading and re-parsing
 * localStorage on every call returns a fresh array each time, which React reads
 * as "changed" on every render and loops forever. The cache is invalidated by
 * the two things that can actually change the value: our own writes, and another
 * tab's.
 */
let cache: Watched[] | null = null;
const EMPTY: Watched[] = [];

function read(): Watched[] {
  if (cache) return cache;
  let items: Watched[] = EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { v?: number; items?: unknown };
      // Anything not written by this version is discarded rather than migrated:
      // there is no v0, and a hand-edited or foreign value is not worth trusting.
      if (parsed?.v === 1 && Array.isArray(parsed.items)) {
        items = (parsed.items as Watched[])
          .filter(
            (f) =>
              f && typeof f.ticket === 'string' && TICKET_RE.test(f.ticket)
              && typeof f.starredAt === 'string' && !Number.isNaN(Date.parse(f.starredAt)),
          )
          .slice(0, CAP);
      }
    }
  } catch {
    // Private mode, disabled site data, or corrupt JSON. An empty watchlist is
    // the right answer to all three -- never let storage break the page.
    items = EMPTY;
  }
  cache = items;
  return items;
}

const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function write(next: Watched[]): void {
  cache = next.slice(0, CAP);
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, items: cache }));
  } catch {
    /* Quota or private mode: the in-memory list still works for this session. */
  }
  emit();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  // `storage` fires only in *other* tabs, which is exactly the case our own
  // writes do not cover. Starring on the map updates an open /urmarite tab.
  const onStorage = (e: StorageEvent): void => {
    if (e.key === KEY || e.key === null) {
      cache = null;
      emit();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener('storage', onStorage);
  };
}

/** Server render and first hydration pass see an empty list; localStorage is
 *  client-only, and guessing otherwise would mismatch. */
const serverSnapshot = (): Watched[] => EMPTY;

export interface WatchlistApi {
  items: Watched[];
  has: (ticket: string) => boolean;
  add: (ticket: string, statusAtStar?: string) => void;
  remove: (ticket: string) => void;
  toggle: (ticket: string, statusAtStar?: string) => void;
  clear: () => void;
  /** Merge in a shared list. Existing entries keep their own, older baseline. */
  merge: (incoming: Watched[]) => number;
}

export function useWatchlist(): WatchlistApi {
  const items = useSyncExternalStore(subscribe, read, serverSnapshot);

  const has = useCallback((ticket: string) => items.some((f) => f.ticket === ticket), [items]);

  const add = useCallback((ticket: string, statusAtStar?: string) => {
    if (!TICKET_RE.test(ticket)) return;
    const cur = read();
    if (cur.some((f) => f.ticket === ticket)) return;
    // Newest first: the list is read top-down and the freshest addition is the
    // one being thought about.
    write([{ ticket, starredAt: new Date().toISOString(), statusAtStar }, ...cur]);
  }, []);

  const remove = useCallback((ticket: string) => {
    write(read().filter((f) => f.ticket !== ticket));
  }, []);

  const toggle = useCallback((ticket: string, statusAtStar?: string) => {
    if (read().some((f) => f.ticket === ticket)) remove(ticket);
    else add(ticket, statusAtStar);
  }, [add, remove]);

  const clear = useCallback(() => write([]), []);

  const merge = useCallback((incoming: Watched[]) => {
    const cur = read();
    const seen = new Set(cur.map((f) => f.ticket));
    const fresh = incoming.filter((f) => TICKET_RE.test(f.ticket) && !seen.has(f.ticket));
    if (fresh.length) write([...cur, ...fresh]);
    return fresh.length;
  }, []);

  return { items, has, add, remove, toggle, clear, merge };
}

/**
 * Share-link encoding: `CAS-0213702~2026-09-02,CAS-0198441~2026-08-30`.
 *
 * The date rides along because a list without baselines is much less useful --
 * every ticket would look freshly starred and every past change would read as
 * new. A bare ticket number is still accepted, and dated from the import.
 */
export function encodeShare(items: Watched[]): string {
  return items.map((f) => `${f.ticket}~${f.starredAt.slice(0, 10)}`).join(',');
}

export function decodeShare(param: string): Watched[] {
  const out: Watched[] = [];
  const seen = new Set<string>();
  for (const chunk of param.split(',').slice(0, CAP)) {
    const [ticket, day] = chunk.trim().split('~');
    if (!ticket || !TICKET_RE.test(ticket) || seen.has(ticket)) continue;
    seen.add(ticket);
    const parsed = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? Date.parse(`${day}T00:00:00Z`) : NaN;
    out.push({
      ticket,
      starredAt: Number.isNaN(parsed) ? new Date().toISOString() : new Date(parsed).toISOString(),
    });
  }
  return out;
}
