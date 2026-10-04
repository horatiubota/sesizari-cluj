'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Delta } from '@/components/charts';
import OutcomeBar, { OutcomeKey } from '@/components/OutcomeBar';
import type { Counts } from '@/lib/dashboard';
import { nf, RATES, rateOf, sesizari, shareOrCount, type RateKey } from '@/lib/outcomes';

export interface TableRow {
  key: string;
  label: string;
  href: string;
  /** Rolling 7 days, the 7 before, and the same 7 a year (364 days) earlier. */
  cur: number; prev: number; ly: number;
  /** Outcome composition over the 13-week window. */
  o: Counts;
  /** [template replies, Favorabil with no stated fix] over the same window. */
  x: [number, number];
}

type SortKey = 'volum' | RateKey;
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'volum', label: 'volum' },
  { key: 'templated', label: RATES.templated.label },
  { key: 'nofix', label: RATES.nofix.label },
  { key: 'deschise', label: RATES.deschise.label },
];

/**
 * A ranked breakdown that can be re-ranked by what the replies say, not only by
 * volume -- "where do reports get a template answer" is a question the volume
 * order cannot answer, and finding it by eye across 26 rows is not a reasonable
 * ask.
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
      : rateOf(RATES[sort], b.o, b.x) - rateOf(RATES[sort], a.o, a.x) || b.o[0] - a.o[0]);

  const download = () => {
    const head = ['nume', 'ultimele_7_zile', '7_zile_anterioare', 'aceleasi_7_zile_anul_trecut',
      `total_${weeks}_saptamani`, 'favorabil', 'partial', 'transferata', 'respinsa_nefavorabil', 'inca_deschisa',
      'inchise_cu_raspuns_sablon', 'favorabil_fara_rezolvare_declarata'];
    const esc = (v: string | number) => (typeof v === 'number' ? String(v) : `"${v.replace(/"/g, '""')}"`);
    const lines = [head.join(','), ...sorted.map((r) =>
      [r.label, r.cur, r.prev, r.ly, ...r.o, ...r.x].map(esc).join(','))];
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
          : <>Ordonat după „{RATES[sort].label}”; la egalitate, după numărul de sesizări din ultimele {weeks} săptămâni.</>}{' '}
        „Răspuns șablon” se raportează la sesizările închise, „favorabil fără rezolvare” la cele
        închise „Favorabil”, „încă deschise” la toate — vezi <a href="#metoda" className="underline underline-offset-2 hover:text-ink">metoda</a>.
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
            <th scope="col" className="py-2 pr-4 text-right font-medium">față de săpt. trecută</th>
            <th scope="col" className="py-2 pr-6 text-right font-medium">față de anul trecut</th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">{weeks} săpt.</th>
            <th scope="col" className="w-[18%] py-2 pr-4 font-medium">eticheta oficială</th>
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
              <td className="py-2.5 pr-4 text-right text-[13px]"><Delta cur={r.cur} base={r.prev} /></td>
              <td className="py-2.5 pr-6 text-right text-[13px]"><Delta cur={r.cur} base={r.ly} /></td>
              <td className="py-2.5 pr-4 text-right tabular-nums text-ink-2">{nf.format(r.o[0])}</td>
              <td className="py-2.5 pr-4 align-middle"><OutcomeBar counts={r.o} label={r.label} /></td>
              {SORTS.slice(1).map((s) => (
                <td key={s.key}
                  className={`py-2.5 pl-2 text-right tabular-nums ${
                    isZero(r, s.key as RateKey) ? 'text-ink-3' : sort === s.key ? 'font-semibold text-ink' : 'text-ink-2'}`}>
                  {rate(r, s.key as RateKey)}
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
                <Delta cur={r.cur} base={r.prev} />
              </span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div className="min-w-0 flex-1"><OutcomeBar counts={r.o} label={r.label} /></div>
              <span className="shrink-0 text-xs text-ink-3 tabular-nums">{sesizari(r.o[0])} / {weeks} săpt.</span>
            </div>
            <dl className="mt-2 grid grid-cols-3 gap-x-3 text-xs">
              {SORTS.slice(1).map((s) => (
                <div key={s.key} className="min-w-0">
                  <dt className="truncate text-ink-3">{s.label}</dt>
                  <dd className={`tabular-nums ${
                    isZero(r, s.key as RateKey) ? 'text-ink-3' : sort === s.key ? 'font-semibold text-ink' : 'text-ink-2'}`}>
                    {rate(r, s.key as RateKey)}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A row's rate as printed, over that rate's own denominator. Observed zeros
 * print as "0%" in a muted tone rather than as missing data; small bases print
 * counts, like the picker.
 */
function rate(r: TableRow, key: RateKey): string {
  return shareOrCount(RATES[key].num(r.o, r.x), RATES[key].den(r.o));
}
const isZero = (r: TableRow, key: RateKey) => RATES[key].den(r.o) > 0 && RATES[key].num(r.o, r.x) === 0;

function RowName({ row }: { row: TableRow }) {
  return (
    <Link href={row.href} className="group inline-flex min-w-0 items-center gap-2 py-1 text-[15px] md:text-sm pointer-coarse:min-h-11">
      <span className="truncate underline decoration-line-strong underline-offset-4 group-hover:decoration-ink">
        {row.label}
      </span>
      <span className="sr-only">, vezi pe hartă</span>
    </Link>
  );
}
