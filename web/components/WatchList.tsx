'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CATEGORY_BY_ID, OUTCOME_LABEL } from '@/lib/categories';
import { decodeShare, encodeShare, useWatchlist, type Watched } from '@/lib/watchlist';

/**
 * The watchlist page.
 *
 * Everything here is client-side because the list itself is: it lives in
 * localStorage (see lib/watchlist.ts), so there is nothing for the server to
 * render until the browser says what it holds. The one server round trip is
 * POST /api/watch, which answers "what happened to these tickets since each was
 * starred" in a single query.
 */

interface Event {
  observed_at: string;
  status_code: string | null;
  status_label: string | null;
  previous_resolve_reason: string | null;
}

interface Followup {
  ticket_number: string;
  created_at: string;
  status_label: string;
  description: string | null;
}

interface Row {
  ticket_number: string;
  description: string | null;
  resolve_reason: string | null;
  status_code: string;
  status_label: string;
  created_at: string;
  closed_at: string | null;
  neighborhood: string | null;
  category_id: number;
  category: string;
  recurrence_meaning: string;
  starred_at: string;
  events: Event[];
  followups: Followup[];
  followup_count: number;
}

type Bucket = 'rezolvate' | 'actualizate' | 'neschimbate';

const BUCKETS: { key: Bucket; title: string; note: string }[] = [
  {
    key: 'rezolvate',
    title: 'Rezolvate',
    note: 'Închise de când le urmărești.',
  },
  {
    key: 'actualizate',
    title: 'Actualizate',
    note: 'Răspunsul s-a schimbat, sesizarea a fost redeschisă, sau au apărut raportări noi în același loc.',
  },
  {
    key: 'neschimbate',
    title: 'Neschimbate',
    note: 'Nimic nou de când le-ai adăugat.',
  },
];

const dt = (s: string): string =>
  new Date(s).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' });

const days = (from: string, to: string | number = Date.now()): number =>
  Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000));

/**
 * Day counts in Romanian: the numeral is wrong for one ("1 zile"), and a zero is
 * wrong in both directions -- a ticket filed this morning has not been open "0
 * zile", it has been open since today.
 */
const zile = (n: number): string => (n === 1 ? 'o zi' : `${n} zile`);
/** "open since ..." */
const de = (n: number): string => (n === 0 ? 'de azi' : `de ${zile(n)}`);
/** "... after you starred it" */
const dupa = (n: number): string =>
  (n === 0 ? 'în aceeași zi în care' : `la ${zile(n)} după ce`);

function classify(r: Row): Bucket {
  const closedSince = r.status_code === 'C' && r.events.some((e) => e.status_code === 'C');
  if (closedSince) return 'rezolvate';
  if (r.events.length > 0 || r.followup_count > 0) return 'actualizate';
  return 'neschimbate';
}

/**
 * How to phrase a new report at the same spot.
 *
 * Uses the editorial distinction recorded in sql/010_recurrence_meaning.sql: for
 * infrastructure a repeat report is evidence about the repair, but for behaviour
 * it is simply a new event -- the council removing one illegally parked car says
 * nothing about a different car years later. Claiming otherwise would turn the
 * largest-looking numbers into the weakest evidence.
 */
function followupPhrase(meaning: string, n: number): string {
  const count = n === 1 ? 'O sesizare nouă' : `${n} sesizări noi`;
  if (meaning === 'infrastructura') {
    return `${count} în același loc — problema a reapărut după închidere.`;
  }
  if (meaning === 'comportament') {
    return `${count} în același loc — incidente noi, nu neapărat un semn că rezolvarea a eșuat.`;
  }
  return `${count} în același loc.`;
}

export default function WatchList() {
  const { items, remove, clear, merge } = useWatchlist();
  const params = useSearchParams();

  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  /*
    A shared link offers a list; it does not silently install one. Merging on
    mount would mean that opening someone's link quietly rewrites your own
    watchlist, which is both surprising and — since the list is the only thing
    this site keeps for you — the wrong default. Entries you already hold keep
    their own, older baseline.
  */
  const shared = params.get('t');
  const offered = useMemo<Watched[]>(() => (shared ? decodeShare(shared) : []), [shared]);
  const held = useMemo(() => new Set(items.map((f) => f.ticket)), [items]);
  const pending = offered.filter((f) => !held.has(f.ticket));

  // Identity of the *set*, not of the array: this is what decides a refetch, so
  // that re-renders which do not change the watchlist do not re-query.
  const key = useMemo(
    () => items.map((f) => `${f.ticket}@${f.starredAt}`).sort().join('|'),
    [items],
  );

  useEffect(() => {
    // Nothing to ask about, and the empty state renders without `rows` anyway.
    if (!items.length) return;
    const ac = new AbortController();
    fetch('/api/watch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
      signal: ac.signal,
    })
      .then((r) => (r.ok ? (r.json() as Promise<{ rows: Row[] }>) : Promise.reject(new Error(String(r.status)))))
      .then((d) => { setRows(d.rows); setError(null); })
      .catch((e: Error) => {
        if (e.name !== 'AbortError') setError('Nu am putut încărca starea sesizărilor.');
      });
    return () => ac.abort();
    // `key` stands in for `items`; see above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const share = useCallback(() => {
    const url = `${window.location.origin}/urmarite?t=${encodeShare(items)}`;
    void navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => { /* clipboard blocked; the button simply does nothing visible */ },
    );
  }, [items]);

  const grouped = useMemo(() => {
    const g: Record<Bucket, Row[]> = { rezolvate: [], actualizate: [], neschimbate: [] };
    for (const r of rows ?? []) g[classify(r)].push(r);
    // Most recently starred first inside each group.
    for (const k of Object.keys(g) as Bucket[]) {
      g[k].sort((a, b) => Date.parse(b.starred_at) - Date.parse(a.starred_at));
    }
    return g;
  }, [rows]);

  if (!items.length) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Sesizări urmărite</h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          Nu urmărești nicio sesizare încă.
        </p>

        {/* Someone arriving from a shared link with an empty list is the most
            likely first visitor here, so the offer has to appear in this state
            too -- not only once the list is non-empty. */}
        {pending.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700">
            <span>
              Linkul conține {pending.length === 1 ? 'o sesizare' : `${pending.length} sesizări`}.
            </span>
            <button onClick={() => merge(pending)}
              className="rounded-full border border-neutral-900 bg-neutral-900 px-3 py-1 text-xs text-white transition dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900">
              Adaugă în lista mea
            </button>
          </div>
        )}
        <div className="mt-6 rounded-md border border-neutral-300 p-4 text-sm leading-relaxed dark:border-neutral-700">
          <p className="text-neutral-700 dark:text-neutral-300">
            Deschide <Link href="/harta" className="underline underline-offset-2">harta</Link>,
            apasă pe o sesizare și apoi pe <strong>Urmărește</strong>. De atunci înainte,
            pagina asta îți arată dacă a fost închisă, dacă răspunsul oficial s-a
            schimbat și dacă au apărut sesizări noi în același loc.
          </p>
          <p className="mt-3 text-neutral-600 dark:text-neutral-400">
            Lista e păstrată doar în browserul tău. Nu are nevoie de cont și nu ajunge
            pe server — dar nu se sincronizează între dispozitive. Butonul „Copiază
            link” de aici îți dă o adresă care mută lista pe alt dispozitiv.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sesizări urmărite</h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {items.length === 1 ? 'O sesizare' : `${items.length} sesizări`} · păstrate în acest browser
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={share}
            className="rounded-full border border-neutral-300 px-3 py-1 text-sm transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900">
            {copied ? 'Link copiat' : 'Copiază link'}
          </button>
          <button
            onClick={() => { if (confirm('Ștergi toate sesizările urmărite?')) clear(); }}
            className="rounded-full border border-neutral-300 px-3 py-1 text-sm text-neutral-600 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-900">
            Golește
          </button>
        </div>
      </div>

      {pending.length > 0 && imported === null && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700">
          <span>
            Linkul conține {pending.length === 1 ? 'o sesizare' : `${pending.length} sesizări`} pe
            care nu le urmărești.
          </span>
          <button onClick={() => setImported(merge(pending))}
            className="rounded-full border border-neutral-900 bg-neutral-900 px-3 py-1 text-xs text-white transition dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900">
            Adaugă în lista mea
          </button>
        </div>
      )}

      {imported !== null && (
        <p className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700">
          {imported === 1 ? 'O sesizare adăugată' : `${imported} sesizări adăugate`} din link.
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700">
          {error}
        </p>
      )}

      {rows === null && !error && (
        <div className="mt-6 space-y-3" aria-busy="true">
          <span className="sr-only">Se încarcă</span>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-md bg-neutral-100 dark:bg-neutral-900" />
          ))}
        </div>
      )}

      {rows !== null && BUCKETS.map(({ key: b, title, note }) => {
        const list = grouped[b];
        if (!list.length) return null;
        return (
          <section key={b} className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {title} ({list.length})
            </h2>
            <p className="mt-1 text-xs text-neutral-500">{note}</p>
            <ul className="mt-3 space-y-3">
              {list.map((r) => <Card key={r.ticket_number} r={r} onRemove={remove} />)}
            </ul>
          </section>
        );
      })}

      <footer className="mt-10 border-t border-neutral-200 pt-4 text-xs leading-relaxed text-neutral-500 dark:border-neutral-800">
        Datele despre închidere provin din observațiile acestui proiect, nu de la
        platforma oficială: API-ul public expune doar starea curentă, niciodată data
        închiderii. „Închisă” înseamnă aici prima dată la care am văzut-o închisă.
      </footer>
    </main>
  );
}

function Card({ r, onRemove }: { r: Row; onRemove: (t: string) => void }) {
  const cat = CATEGORY_BY_ID.get(r.category_id);
  const closing = r.events.find((e) => e.status_code === 'C');
  const reopened = r.status_code === 'O' && r.events.some((e) => e.status_code === 'O');
  const answerChange = r.events.find((e) => e.previous_resolve_reason !== null);

  return (
    <li className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium">
            {cat && (
              <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: cat.color }} />
            )}
            <span className="truncate">{r.category}</span>
          </span>
          <p className="mt-0.5 font-mono text-xs text-neutral-500">
            {r.ticket_number}
            {r.neighborhood ? ` · ${r.neighborhood}` : ''}
            {` · raportată ${dt(r.created_at)}`}
          </p>
        </div>
        <button onClick={() => onRemove(r.ticket_number)}
          aria-label={`Nu mai urmări ${r.ticket_number}`}
          className="shrink-0 rounded p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-900 dark:hover:text-neutral-100">
          <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5"
              strokeLinecap="round" fill="none" />
          </svg>
        </button>
      </div>

      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
        {r.description ?? '(fără descriere)'}
      </p>

      <div className="mt-3 space-y-1.5 text-sm">
        {closing && (
          <p className="text-neutral-800 dark:text-neutral-200">
            <strong>Închisă</strong> ca „{OUTCOME_LABEL[closing.status_label ?? ''] ?? closing.status_label}”
            {' — '}observată pe {dt(closing.observed_at)},{' '}
            {dupa(days(r.starred_at, closing.observed_at))} ai adăugat-o.
          </p>
        )}

        {reopened && (
          <p className="text-neutral-800 dark:text-neutral-200">
            <strong>Redeschisă</strong> — este din nou „{OUTCOME_LABEL[r.status_label] ?? r.status_label}”.
          </p>
        )}

        {answerChange && (
          <details className="text-neutral-800 dark:text-neutral-200">
            <summary className="cursor-pointer"><strong>Răspunsul oficial s-a schimbat</strong></summary>
            <div className="mt-2 space-y-2 border-l-2 border-neutral-300 pl-2 text-sm dark:border-neutral-700">
              <div>
                <span className="text-[11px] font-medium text-neutral-500">Înainte</span>
                <p className="whitespace-pre-line text-neutral-600 dark:text-neutral-400">
                  {answerChange.previous_resolve_reason}
                </p>
              </div>
              <div>
                <span className="text-[11px] font-medium text-neutral-500">Acum</span>
                <p className="whitespace-pre-line">{r.resolve_reason ?? '(gol)'}</p>
              </div>
            </div>
          </details>
        )}

        {r.followup_count > 0 && (
          <details className="text-neutral-800 dark:text-neutral-200">
            <summary className="cursor-pointer">
              <strong>{followupPhrase(r.recurrence_meaning, r.followup_count)}</strong>
            </summary>
            <ul className="mt-2 space-y-1.5 border-l-2 border-neutral-300 pl-2 dark:border-neutral-700">
              {r.followups.map((f) => (
                <li key={f.ticket_number} className="text-sm">
                  <span className="font-mono text-xs text-neutral-500">
                    {f.ticket_number} · {dt(f.created_at)}
                  </span>
                  <p className="text-neutral-600 dark:text-neutral-400">{f.description ?? '—'}</p>
                </li>
              ))}
            </ul>
          </details>
        )}

        {!closing && !reopened && !answerChange && r.followup_count === 0 && (
          <p className="text-neutral-600 dark:text-neutral-400">
            {r.status_code === 'O'
              ? `Încă deschisă — „${OUTCOME_LABEL[r.status_label] ?? r.status_label}”, ${de(days(r.created_at))}.`
              : `Era deja închisă ca „${OUTCOME_LABEL[r.status_label] ?? r.status_label}” când ai adăugat-o.`}
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <Link href={`/harta?t=${r.ticket_number}`} className="underline underline-offset-2">
          Vezi pe hartă
        </Link>
        <a href={`https://mycluj.e-primariaclujnapoca.ro/?c=${r.ticket_number}`}
          target="_blank" rel="noreferrer" className="underline underline-offset-2">
          Platforma oficială →
        </a>
        <span className="text-neutral-400">urmărită din {dt(r.starred_at)}</span>
      </div>
    </li>
  );
}
