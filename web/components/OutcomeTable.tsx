'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Delta } from '@/components/charts';
import OutcomeBar, { OutcomeKey } from '@/components/OutcomeBar';
import type { Counts } from '@/lib/dashboard';
import { nf, RATES, sesizari, shareOrCount, type RateKey } from '@/lib/outcomes';

export interface TableRow {
  key: string;
  label: string;
  /** Category colour, so the row matches its pins on the map; absent for cartiere. */
  color?: string;
  href: string;
  /** Rolling 7 days, the 7 before, and the same 7 a year (364 days) earlier. */
  cur: number; prev: number; ly: number;
  /** Outcome composition over the 13-week window. */
  o: Counts;
}

type SortKey = 'volum' | RateKey;
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'volum', label: 'volum' },
  { key: 'deschise', label: RATES.deschise.label },
  { key: 'transferat', label: RATES.transferat.label },
  { key: 'nefav', label: RATES.nefav.label },
];

/**
 * A ranked breakdown that can be re-ranked by outcome, not only by volume --
 * "which cartiere get rejected most" is a question the volume order cannot
 * answer, and finding it by eye across 26 rows is not a reasonable ask.
 *
 * The order lives in the URL under `param`, so a sorted view can be linked.
 * Rows link into the map with the same selection and 7-day window, so a number
 * here and the map behind it always describe the same reports.
 *
 * Two layouts from one row list: a table from `md` up, stacked rows below it.
 * A seven-column table on a phone is a table you scroll sideways to read one
 * row of, which is how the previous version lost its outcome columns
 * off-screen.
 */
export default function OutcomeTable({
  rows, param, nameHeader, weeks, csvName,
}: {
  rows: TableRow[];
  param: string;
  nameHeader: string;
  weeks: number;
  csvName: string;
}) {
  const sp = useSearchParams();
  const raw = sp.get(param);
  const sort: SortKey = SORTS.some((s) => s.key === raw) ? (raw as SortKey) : 'volum';

  const setSort = (key: SortKey) => {
    const next = new URLSearchParams(window.location.search);
    if (key === 'volum') next.delete(param); else next.set(param, key);
    const qs = next.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  };

  const sorted = [...rows].sort((a, b) =>
    sort === 'volum'
      ? b.cur - a.cur || b.o[0] - a.o[0]
      : RATES[sort].of(b.o) - RATES[sort].of(a.o) || b.o[0] - a.o[0]);

  const download = () => {
    const head = ['nume', 'ultimele_7_zile', '7_zile_anterioare', 'aceleasi_7_zile_anul_trecut',
      `total_${weeks}_saptamani`, 'favorabil', 'partial', 'transferata', 'respinsa_nefavorabil', 'inca_deschisa'];
    const esc = (v: string | number) => (typeof v === 'number' ? String(v) : `"${v.replace(/"/g, '""')}"`);
    const lines = [head.join(','), ...sorted.map((r) =>
      [r.label, r.cur, r.prev, r.ly, ...r.o].map(esc).join(','))];
    // BOM so spreadsheet apps read the diacritics as UTF-8.
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = csvName;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Ordonează după" className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-ink-3">Ordonează după</span>
          {SORTS.map((s) => (
            <button key={s.key} type="button" aria-pressed={sort === s.key} onClick={() => setSort(s.key)}
              className={`h-11 rounded-md border px-3.5 text-sm ${
                sort === s.key
                  ? 'border-ink bg-ink font-medium text-surface'
                  : 'border-line-strong bg-surface text-ink-2 hover:border-ink hover:text-ink'
              }`}>
              {s.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={download}
          className="h-11 rounded-md px-1 text-sm text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink">
          Descarcă CSV
        </button>
      </div>
      <p className="mt-3 max-w-[68ch] text-xs leading-relaxed text-ink-3">
        {sort === 'volum'
          ? <>Ordonat după sesizările din ultimele 7 zile.</>
          : <>Ordonat după procentul „{RATES[sort].label}”; la egalitate, după numărul de sesizări din ultimele {weeks} săptămâni.</>}{' '}
        Din noiembrie 2021 platforma consemnează foarte rar „Parțial” sau „Respinsă”, așa că
        coloana „parțial sau respinse” e aproape peste tot 0% — vezi <a href="#lunar" className="underline underline-offset-2 hover:text-ink">graficul lunar</a>.
      </p>
      <OutcomeKey className="mt-3" />

      {/* md and up: a table. */}
      <table className="mt-4 hidden w-full text-sm md:table">
        <caption className="sr-only">
          {nameHeader}: sesizări în ultimele 7 zile și cum s-au închis cele din ultimele {weeks} săptămâni
        </caption>
        <thead>
          <tr className="border-b border-line text-left text-xs text-ink-3">
            <th scope="col" className="py-2 pr-4 font-medium">{nameHeader}</th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">7 zile</th>
            <th scope="col" className="py-2 pr-6 text-right font-medium">față de anul trecut</th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">{weeks} săpt.</th>
            <th scope="col" className="w-[26%] py-2 pr-4 font-medium">cum s-au închis</th>
            {SORTS.slice(1).map((s) => (
              <th key={s.key} scope="col" aria-sort={sort === s.key ? 'descending' : undefined}
                className={`py-2 pl-2 text-right font-medium ${sort === s.key ? 'text-ink' : ''}`}>
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.key} className="border-b border-line last:border-0 hover:bg-sunken/60">
              <th scope="row" className="py-2.5 pr-4 text-left font-normal">
                <RowName row={r} />
              </th>
              <td className={`py-2.5 pr-4 text-right tabular-nums ${sort === 'volum' ? 'font-semibold' : ''}`}>{nf.format(r.cur)}</td>
              <td className="py-2.5 pr-6 text-right text-[13px]"><Delta cur={r.cur} base={r.ly} /></td>
              <td className="py-2.5 pr-4 text-right tabular-nums text-ink-2">{nf.format(r.o[0])}</td>
              <td className="py-2.5 pr-4 align-middle"><OutcomeBar counts={r.o} label={r.label} /></td>
              {SORTS.slice(1).map((s) => (
                <td key={s.key}
                  className={`py-2.5 pl-2 text-right tabular-nums ${
                    isZero(r.o, s.key as RateKey) ? 'text-ink-3' : sort === s.key ? 'font-semibold text-ink' : 'text-ink-2'}`}>
                  {rate(r.o, s.key as RateKey)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Below md: one stacked block per row. */}
      <ul className="mt-3 divide-y divide-line border-y border-line md:hidden">
        {sorted.map((r) => (
          <li key={r.key} className="py-3">
            <div className="flex items-baseline justify-between gap-3">
              <RowName row={r} />
              <span className="shrink-0 text-sm tabular-nums">
                <span className={sort === 'volum' ? 'font-semibold' : ''}>{nf.format(r.cur)}</span>
                <span className="text-ink-3"> în 7 zile </span>
                <Delta cur={r.cur} base={r.ly} />
              </span>
            </div>
            <div className="mt-2"><OutcomeBar counts={r.o} label={r.label} /></div>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-ink-3">
              {SORTS.slice(1).map((s) => (
                <div key={s.key} className="contents">
                  <dt>{s.label}</dt>
                  <dd className={`tabular-nums ${
                    isZero(r.o, s.key as RateKey) ? '' : sort === s.key ? 'font-semibold text-ink' : 'text-ink-2'}`}>
                    {rate(r.o, s.key as RateKey)}
                  </dd>
                </div>
              ))}
              <div className="contents"><dt>în {weeks} săptămâni</dt><dd className="tabular-nums text-ink-2">{sesizari(r.o[0])}</dd></div>
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A row's rate as printed. Observed zeros print as "0%" in a muted tone -- most
 * rows record no partial or rejected outcome at all since late 2021, and the
 * few that do should stand out without the zeros pretending to be missing
 * data. Small rows print counts, like the picker.
 */
function rate(o: Counts, key: RateKey): string {
  return shareOrCount(Math.round(RATES[key].of(o) * o[0]), o[0]);
}
const isZero = (o: Counts, key: RateKey) => o[0] > 0 && RATES[key].of(o) === 0;

function RowName({ row }: { row: TableRow }) {
  return (
    <Link href={row.href} className="group inline-flex min-w-0 items-center gap-2 py-1 text-[15px] md:text-sm">
      {row.color && (
        <span aria-hidden="true" className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: row.color }} />
      )}
      <span className="truncate underline decoration-line-strong underline-offset-4 group-hover:decoration-ink">
        {row.label}
      </span>
      <span className="sr-only">, vezi pe hartă</span>
    </Link>
  );
}
