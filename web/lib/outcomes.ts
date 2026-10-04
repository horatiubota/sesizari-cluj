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
 * The three sort keys the tables offer beyond volume. Each is a share of every
 * report in the window, open ones included, so it shares a denominator with the
 * strip beside it.
 *
 * "Transferate" replaced a rejected-only rate: since late 2021 rejections are
 * rarely recorded, so that column tied almost every row, while the share routed
 * to an operator does separate them. "Parțial sau respinse" deliberately leaves
 * out transfers: CTP and CAS reports are routed to the operator wholesale, and
 * counting that as unfavourable would rank who answers, not what was decided.
 */
export const RATES = {
  nefav: { label: 'parțial sau respinse', of: (c: Counts) => (c[0] ? (c[2] + c[4]) / c[0] : 0) },
  transferat: { label: 'transferate', of: (c: Counts) => (c[0] ? c[3] / c[0] : 0) },
  deschise: { label: 'încă deschise', of: (c: Counts) => (c[0] ? c[5] / c[0] : 0) },
} as const;

export type RateKey = keyof typeof RATES;
