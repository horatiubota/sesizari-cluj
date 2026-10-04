import type { Counts } from '@/lib/dashboard';
import { BANDS } from '@/lib/outcomes';

/**
 * Small chart primitives.
 *
 * Deliberately dependency-free and server-rendered: the dashboard is a static
 * read, so shipping a charting library would add weight for no interaction.
 *
 * Line charts use a viewBox sized in data units with `preserveAspectRatio="none"`
 * so they stretch to the container; strokes carry `vector-effect="non-scaling-stroke"`
 * to survive that stretch. No text lives inside an SVG -- labels are HTML, which
 * keeps them selectable and correctly sized. Composition charts are HTML columns
 * instead: a stretched SVG distorts the hatch that marks "transferred", and HTML
 * columns reuse the exact fill classes of the outcome strips, so one legend
 * reads both.
 */

/** Composition over time as 100%-stacked columns, one per period. */
export function StackedColumns({
  data, label, height = 'h-44',
}: {
  data: { label: string; o: Counts }[];
  label: string;
  height?: string;
}) {
  if (!data.length) return null;
  return (
    <div role="img" aria-label={label} className={`flex w-full items-stretch gap-px ${height}`}>
      {data.map((row) => {
        const total = row.o[0] || 1;
        return (
          <div key={row.label} className="flex min-w-0 flex-1 flex-col-reverse overflow-hidden">
            {BANDS.map((b) => {
              const n = row.o[b.idx];
              return n ? <span key={b.key} className={b.cls} style={{ height: `${(n / total) * 100}%` }} /> : null;
            })}
          </div>
        );
      })}
    </div>
  );
}

/** Inline trend line for a table row. */
export function Sparkline({ values, color, className = 'h-6 w-24' }: {
  values: number[]; color: string; className?: string;
}) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const path = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${i},${20 - (v / max) * 18}`)
    .join(' ');
  return (
    <svg viewBox={`0 0 ${values.length - 1} 20`} preserveAspectRatio="none"
      className={className} aria-hidden="true">
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round"
        vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Proportional bar. */
export function Bar({ value, max, className = 'bg-o-fav' }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <span className="block h-2 w-full rounded-[2px] bg-sunken">
      <span className={`block h-full rounded-[2px] ${className}`} style={{ width: `${pct}%` }} />
    </span>
  );
}

/**
 * Below this base a percentage change is noise dressed as a trend: one report
 * last year and six this year prints "+500%". Such rows show the two counts.
 */
const MIN_DELTA_BASE = 10;

/** Signed change, coloured only by direction — no judgement about which is good. */
export function Delta({ cur, base, suffix }: { cur: number; base: number; suffix?: string }) {
  if (base < MIN_DELTA_BASE) {
    return (
      <span className="tabular-nums text-ink-3" title="Bază prea mică pentru un procent">
        {base} → {cur}
      </span>
    );
  }
  const pct = Math.round(((cur - base) / base) * 100);
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : '';
  const tone = pct === 0 ? 'text-ink-3' : pct > 0 ? 'text-up' : 'text-down';
  return (
    <span className={`tabular-nums ${tone}`}>
      {sign}{Math.abs(pct)}%{suffix ? ` ${suffix}` : ''}
    </span>
  );
}

/**
 * Cumulative step curve, drawn on a fixed 0-100% scale.
 *
 * The scale is deliberately not fitted to the data: this plots a share of a
 * whole, and letting the top of the curve touch the top of the frame would make
 * "under half" look like "all of them". The 50% rule is drawn heavier than the
 * others because it is the one that carries a claim -- once the curve crosses it,
 * the median is inside the observed window and can be named.
 */
export function StepCurve({
  points, height = 'h-48',
}: {
  points: { day: number; pct: number }[];
  height?: string;
}) {
  if (!points.length) return null;
  const n = points.at(-1)!.day;

  // A step, not a join: nothing is known about what happens *inside* a day, so
  // sloping between the points would draw an interpolation the data cannot support.
  let line = 'M0,100';
  let prev = 100;
  for (const p of points) {
    const y = 100 - p.pct;
    line += ` L${p.day},${prev} L${p.day},${y}`;
    prev = y;
  }

  return (
    <svg viewBox={`0 0 ${n} 100`} preserveAspectRatio="none"
      className={`w-full ${height}`} role="img"
      aria-label={`Procent închis, cumulat pe ${n} zile, ${String(points.at(-1)!.pct).replace('.', ',')}% la final`}>
      {[25, 75].map((v) => (
        <line key={v} x1={0} x2={n} y1={100 - v} y2={100 - v} strokeWidth={1}
          vectorEffect="non-scaling-stroke" stroke="var(--line)" />
      ))}
      <line x1={0} x2={n} y1={50} y2={50} strokeWidth={1} strokeDasharray="4 3"
        vectorEffect="non-scaling-stroke" stroke="var(--line-strong)" />
      <line x1={0} x2={n} y1={100} y2={100} strokeWidth={1}
        vectorEffect="non-scaling-stroke" stroke="var(--line-strong)" />
      <path d={`${line} L${n},100 Z`} fill="var(--o-fav)" opacity={0.1} stroke="none" />
      <path d={line} fill="none" stroke="var(--o-fav)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
