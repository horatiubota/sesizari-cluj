import type { Counts } from '@/lib/dashboard';

/**
 * The five outcome bands, in reading order, with everything a renderer needs.
 *
 * `idx` points into a Counts tuple (index 0 is the total). `cls` paints an HTML
 * strip segment; `svg` is the matching SVG fill, where "transferred" uses the
 * hatch pattern each chart defines as `#o-hatch`. Shared so that every panel
 * draws and names outcomes identically -- two panels disagreeing would be read
 * as a finding rather than as a typo.
 */
export const BANDS = [
  { key: 'favorabil',  idx: 1, label: 'Favorabil',               short: 'Favorabil',   cls: 'bg-o-fav',      svg: 'var(--o-fav)' },
  { key: 'partial',    idx: 2, label: 'Parțial',                 short: 'Parțial',     cls: 'bg-o-part',     svg: 'var(--o-part)' },
  { key: 'transferat', idx: 3, label: 'Transferată operatorului', short: 'Transferată', cls: 'fill-o-transf', svg: 'url(#o-hatch)' },
  { key: 'respins',    idx: 4, label: 'Respinsă / nefavorabil',  short: 'Respinsă',    cls: 'bg-o-resp',     svg: 'var(--o-resp)' },
  { key: 'deschise',   idx: 5, label: 'Încă deschisă',           short: 'Deschisă',    cls: 'fill-o-open',   svg: 'var(--o-open)' },
] as const;

export type BandKey = (typeof BANDS)[number]['key'];

/**
 * Below this many reports a share is shown as a count instead. Twelve reports
 * split 11/1 print as "92%/8%", which reads as a measured rate; "11 din 12"
 * reads as what it is.
 */
export const MIN_FOR_SHARE = 20;

export const nf = new Intl.NumberFormat('ro-RO');
const pf = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** "86,9%" -- the ro-RO decimal comma, which toFixed() silently drops. */
export function pct(n: number, total: number): string {
  if (total === 0) return '—';
  if (n === 0) return '0%';
  const p = (n / total) * 100;
  if (n > 0 && p < 0.05) return '<0,1%';
  return `${pf.format(p)}%`;
}

/**
 * A share, or the raw count when the base is too small for a share to mean
 * much. An observed zero is "0%" -- "—" is kept for "no reports at all", since
 * in a table a dash reads as missing data.
 */
export function shareOrCount(n: number, total: number): string {
  if (total === 0) return '—';
  return total < MIN_FOR_SHARE ? `${nf.format(n)} din ${nf.format(total)}` : pct(n, total);
}

/** Romanian takes "de" before the noun when the last two digits are 0 or 20-99. */
export function sesizari(n: number): string {
  if (n === 1) return '1 sesizare';
  const t = n % 100;
  return `${nf.format(n)} ${t === 0 || t >= 20 ? 'de ' : ''}sesizări`;
}

/**
 * The three rates the picker and tables lead with, beyond volume. Each has its
 * own denominator, and the label says it:
 *
 *   templated -- closed reports whose reply is a template (lib/replies.ts),
 *                over all closed reports;
 *   nofix     -- Favorabil closures with no stated fix, over all Favorabil;
 *   deschise  -- reports still open, over all reports in the window.
 *
 * `x` is MatrixCell.x: [templated, nofix].
 */
type X = [number, number];
interface Rate { label: string; num: (o: Counts, x: X) => number; den: (o: Counts) => number }
export const RATES = {
  templated: { label: 'răspuns șablon', num: (_, x) => x[0], den: (o) => o[0] - o[5] },
  nofix: { label: 'favorabil fără rezolvare', num: (_, x) => x[1], den: (o) => o[1] },
  deschise: { label: 'încă deschise', num: (o) => o[5], den: (o) => o[0] },
} satisfies Record<string, Rate>;

/** A rate as a fraction, 0 when its denominator is empty. */
export const rateOf = (r: Rate, o: Counts, x: X) => (r.den(o) ? r.num(o, x) / r.den(o) : 0);

export type RateKey = keyof typeof RATES;

/** "peste 1 din 4" for 0.274: the largest k with 1/k still below the share. */
export function oneIn(p: number): string {
  if (p <= 0) return '0';
  if (p >= 0.5) return `${Math.round(p * 100)}%`;
  const k = Math.ceil(1 / p);
  return 1 / k === p ? `1 din ${k}` : `peste 1 din ${k}`;
}
