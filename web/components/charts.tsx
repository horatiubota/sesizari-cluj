/**
 * Small SVG chart primitives.
 *
 * Deliberately dependency-free and server-rendered: the dashboard is a static
 * read, so shipping a charting library would add weight for no interaction.
 *
 * Each chart uses a viewBox sized in data units with `preserveAspectRatio="none"`
 * so it stretches to the container. Strokes carry `vector-effect="non-scaling-stroke"`
 * to survive that stretch, and no text lives inside the SVG — labels are HTML,
 * which also keeps them selectable and correctly sized.
 */

interface Band { key: string; color: string; label: string }

/** Daily counts as bars, with a 7-day trailing mean drawn over them. */
export function DailyBars({
  data, height = 'h-44',
}: {
  data: { day: string; total: number }[];
  height?: string;
}) {
  if (!data.length) return null;
  const n = data.length;
  const max = Math.max(...data.map((d) => d.total), 1);
  const y = (v: number) => 100 - (v / max) * 100;

  // Trailing mean, so the line never uses days that had not happened yet.
  const mean = data.map((_, i) => {
    const from = Math.max(0, i - 6);
    const win = data.slice(from, i + 1);
    return win.reduce((s, d) => s + d.total, 0) / win.length;
  });
  const path = mean.map((v, i) => `${i === 0 ? 'M' : 'L'}${i + 0.5},${y(v)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${n} 100`} preserveAspectRatio="none"
      className={`w-full ${height}`} role="img"
      aria-label={`Sesizări pe zi, ${n} zile, maxim ${max}`}>
      {data.map((d, i) => (
        <rect key={d.day} x={i + 0.1} y={y(d.total)} width={0.8} height={100 - y(d.total)}
          className="fill-neutral-300 dark:fill-neutral-700" />
      ))}
      <path d={path} fill="none" strokeWidth={1.5} vectorEffect="non-scaling-stroke"
        className="stroke-neutral-900 dark:stroke-neutral-100" />
    </svg>
  );
}

/** Composition over time as 100%-stacked columns. */
export function StackedBars({
  data, bands, height = 'h-40',
}: {
  data: { label: string; values: Record<string, number> }[];
  bands: Band[];
  height?: string;
}) {
  if (!data.length) return null;
  const n = data.length;
  return (
    <svg viewBox={`0 0 ${n} 100`} preserveAspectRatio="none"
      className={`w-full ${height}`} role="img"
      aria-label={`Compoziție pe ${n} intervale`}>
      {data.map((row, i) => {
        const total = bands.reduce((s, b) => s + (row.values[b.key] ?? 0), 0) || 1;
        let acc = 0;
        return bands.map((b) => {
          const h = ((row.values[b.key] ?? 0) / total) * 100;
          const rect = (
            <rect key={`${i}-${b.key}`} x={i} y={acc} width={1.02} height={h} fill={b.color} />
          );
          acc += h;
          return rect;
        });
      })}
    </svg>
  );
}

/** Inline trend line for a table row. */
export function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const path = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${i},${20 - (v / max) * 18}`)
    .join(' ');
  return (
    <svg viewBox={`0 0 ${values.length - 1} 20`} preserveAspectRatio="none"
      className="h-5 w-20" aria-hidden="true">
      <path d={path} fill="none" stroke={color} strokeWidth={1.5}
        vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Proportional bar used in the ranked tables. */
export function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <span className="block h-1.5 w-full rounded-sm bg-neutral-200 dark:bg-neutral-800">
      <span className="block h-full rounded-sm"
        style={{ width: `${pct}%`, backgroundColor: color }} />
    </span>
  );
}

/** Signed change, coloured only by direction — no judgement about which is good. */
export function Delta({ cur, base, suffix }: { cur: number; base: number; suffix?: string }) {
  if (base === 0) return <span className="text-neutral-400">—</span>;
  const pct = Math.round(((cur - base) / base) * 100);
  const sign = pct > 0 ? '+' : '';
  const tone =
    pct === 0 ? 'text-neutral-500'
      : pct > 0 ? 'text-amber-700 dark:text-amber-500'
        : 'text-teal-700 dark:text-teal-500';
  return (
    <span className={`tabular-nums ${tone}`}>
      {sign}{pct}%{suffix ? ` ${suffix}` : ''}
    </span>
  );
}
