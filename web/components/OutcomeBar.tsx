import type { Counts } from '@/lib/dashboard';
import { BANDS, MIN_FOR_SHARE, pct, shareOrCount } from '@/lib/outcomes';

/**
 * How a set of reports was closed: a 100% strip in the five outcome bands.
 *
 * Replaces the hover-card strip. That card was the only route to the numbers,
 * which made them unreachable on touch without a precise tap and put one tab
 * stop per table row in front of keyboard users. Here the strip is a picture
 * with its numbers in its accessible name, and wherever the numbers matter to a
 * sighted reader they are printed beside it (`legend`), not hidden behind it.
 *
 * Under MIN_FOR_SHARE reports the strip gets a dashed outline: twelve reports
 * make a strip as confident-looking as twelve thousand, and it should not look
 * that way. Fading it instead made favourable read as the partial swatch.
 */
export default function OutcomeBar({
  counts, label, size = 'sm', legend = false,
}: {
  counts: Counts;
  label: string;
  size?: 'sm' | 'lg';
  legend?: boolean;
}) {
  const total = counts[0];
  const thin = total < MIN_FOR_SHARE;
  const summary = total
    ? `${label}: ${BANDS.filter((b) => counts[b.idx] > 0)
        .map((b) => `${b.label} ${shareOrCount(counts[b.idx], total)}`).join(', ')}`
    : `${label}: nicio sesizare`;

  return (
    <div className="min-w-0">
      <div role="img" aria-label={summary}
        title={thin ? `Doar ${total} sesizări: proporțiile sunt orientative` : undefined}
        className={`flex w-full overflow-hidden rounded-[3px] bg-sunken ${size === 'lg' ? 'h-4' : 'h-2.5'} ${
          thin ? 'outline-1 outline-offset-2 outline-ink-3 outline-dashed' : ''}`}>
        {total > 0 && BANDS.map((b) => {
          const n = counts[b.idx];
          if (!n) return null;
          return <span key={b.key} className={`${b.cls} h-full`} style={{ width: `${(n / total) * 100}%` }} />;
        })}
      </div>
      {legend && total > 0 && (
        <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-5" aria-hidden="true">
          {BANDS.map((b) => (
            <li key={b.key} className="min-w-0" title={b.label}>
              <span className="flex items-center gap-1.5 text-xs text-ink-3">
                <span className={`${b.cls} inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]`} />
                <span className="truncate">{b.short}</span>
              </span>
              <span className="mt-0.5 block font-cond text-xl font-bold tabular-nums">
                {thin ? counts[b.idx] : pct(counts[b.idx], total)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The five bands as a compact key, for placing beside strips that print no numbers. */
export function OutcomeKey({ className = '' }: { className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-3 ${className}`}>
      {BANDS.map((b) => (
        <li key={b.key} className="flex items-center gap-1.5">
          <span className={`${b.cls} inline-block h-2.5 w-2.5 rounded-[2px]`} aria-hidden="true" />
          {b.label}
        </li>
      ))}
    </ul>
  );
}
