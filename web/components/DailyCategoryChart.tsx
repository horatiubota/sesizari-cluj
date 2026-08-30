'use client';

import { useMemo, useRef, useState } from 'react';
import { CATEGORIES, CATEGORY_BY_ID } from '@/lib/categories';

/**
 * Daily report volume, as two panels over one shared time axis.
 *
 *   top     how many reports arrived that day (line)
 *   bottom  what share each category took of that day (stacked to 1)
 *
 * Two panels rather than one stacked-count chart because the two questions have
 * different scales and answering both from one set of bars means reading
 * absolute height and relative height off the same mark, which nobody does
 * reliably. Splitting them also makes the share panel legible on quiet days: a
 * 20-report Sunday and a 150-report Tuesday now occupy the same height, so a
 * category's share is comparable across the whole window instead of being
 * squashed wherever volume was low.
 *
 * A client component because of the tooltip; everything else on the dashboard
 * stays server-rendered. Hit-testing is done once on the container from the
 * pointer's x offset rather than by attaching handlers to ~180 x 16 segments,
 * which keeps the DOM to one rect per segment and no listeners on any of them.
 */

export interface Day {
  day: string;
  total: number;
  /** category_id -> count, only the categories present that day. */
  byCat: Record<number, number>;
}

const DATE_FULL = new Intl.DateTimeFormat('ro-RO', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});
const MONTH_SHORT = new Intl.DateTimeFormat('ro-RO', { month: 'short' });

/** Panel heights in user units; the viewBox is scaled to the rendered height. */
const LINE_H = 100;
const SHARE_H = 100;

export default function DailyCategoryChart({ data, order }: { data: Day[]; order: number[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const max = useMemo(() => Math.max(...data.map((d) => d.total), 1), [data]);
  const n = data.length;

  /**
   * Polyline through the daily totals, sampled at each column's centre.
   *
   * The last day is split off and drawn dashed. It is the day the sync ran, so
   * it is always partial, and as a bar that read as a short bar -- as a line it
   * reads as a collapse in reporting that did not happen. The figures under the
   * chart already say the day may be incomplete; the line has to say it too.
   */
  const { solid, tail } = useMemo(() => {
    const pt = (d: Day, i: number): string =>
      `${i + 0.5},${LINE_H - (d.total / max) * LINE_H}`;
    return {
      solid: data.slice(0, -1).map(pt).join(' '),
      tail: data.length > 1
        ? [pt(data[data.length - 2]!, data.length - 2), pt(data[data.length - 1]!, data.length - 1)].join(' ')
        : '',
    };
  }, [data, max]);

  // One tick per month rather than per day: 180-odd labels cannot be read, and
  // the month boundary is the only x position a reader actually looks for.
  const monthTicks = useMemo(
    () => data.flatMap((d, i) => (d.day.slice(8) === '01'
      ? [{ i, label: MONTH_SHORT.format(new Date(`${d.day}T12:00:00`)) }]
      : [])),
    [data],
  );

  const onMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const el = wrap.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const i = Math.floor(((e.clientX - rect.left) / rect.width) * n);
    setHover(i >= 0 && i < n ? i : null);
  };

  const active = hover === null ? null : data[hover];
  const rows = active
    ? [...new Set(order)]
      .filter((c) => (active.byCat[c] ?? 0) > 0)
      .sort((a, b) => (active.byCat[b] ?? 0) - (active.byCat[a] ?? 0))
    : [];
  // A busy day touches most of the 16 categories. One column would run taller
  // than the chart itself and cover the figures underneath it, so past eight
  // entries the list wraps into two columns instead of growing downwards.
  const twoCol = rows.length > 8;
  // Anchor the tooltip to the hovered column and flip it before it runs off the
  // right edge, so it never needs to be clipped or scrolled to.
  const leftPct = hover === null ? 0 : ((hover + 0.5) / n) * 100;
  const flip = leftPct > 60;

  return (
    <div className="relative">
      <div
        ref={wrap}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        className="relative touch-pan-y"
      >
        {/* ---- panel 1: how many ---------------------------------------- */}
        <div className="flex items-baseline justify-between text-xs text-neutral-500">
          <span>Total pe zi</span>
          <span className="font-mono tabular-nums">{max} max</span>
        </div>
        <svg viewBox={`0 0 ${n} ${LINE_H}`} preserveAspectRatio="none" className="mt-1 block h-28 w-full"
          role="img" aria-label={`Număr de sesizări pe zi, ${n} zile, maxim ${max} într-o zi`}>
          {/* Recessive reference lines: the peak and the floor, nothing between. */}
          <line x1={0} x2={n} y1={0.5} y2={0.5}
            className="stroke-neutral-200 dark:stroke-neutral-800"
            strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <line x1={0} x2={n} y1={LINE_H - 0.5} y2={LINE_H - 0.5}
            className="stroke-neutral-200 dark:stroke-neutral-800"
            strokeWidth={1} vectorEffect="non-scaling-stroke" />
          {/*
            non-scaling-stroke is required, not cosmetic: preserveAspectRatio
            "none" scales x and y by different factors, so without it the stroke
            would render thick on the flat runs and thin on the steep ones.
          */}
          <polyline points={solid} fill="none"
            className="stroke-neutral-800 dark:stroke-neutral-100"
            strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round"
            vectorEffect="non-scaling-stroke" />
          {tail && (
            <polyline points={tail} fill="none"
              className="stroke-neutral-400 dark:stroke-neutral-500"
              strokeWidth={1.5} strokeDasharray="3 3" strokeLinecap="round"
              vectorEffect="non-scaling-stroke" />
          )}
        </svg>

        {/* ---- panel 2: what kind --------------------------------------- */}
        <div className="mt-4 text-xs text-neutral-500">Pondere pe categorii</div>
        <svg viewBox={`0 0 ${n} ${SHARE_H}`} preserveAspectRatio="none" className="mt-1 block h-40 w-full"
          role="img" aria-label={`Ponderea fiecărei categorii din sesizările fiecărei zile, ${n} zile`}>
          {data.map((d, i) => {
            if (!d.total) return null;
            let acc = 0;
            return (
              <g key={d.day} opacity={hover === null || hover === i ? 1 : 0.45}>
                {order.map((catId) => {
                  const v = d.byCat[catId] ?? 0;
                  if (!v) return null;
                  // Share of that day, not of the window: every column fills the
                  // panel exactly once, so height reads as percent directly.
                  const h = (v / d.total) * SHARE_H;
                  const y = SHARE_H - acc - h;
                  acc += h;
                  return (
                    <rect key={catId} x={i} y={y} width={1.02} height={h}
                      fill={CATEGORY_BY_ID.get(catId)?.color ?? '#888'} />
                  );
                })}
              </g>
            );
          })}
        </svg>

        {/* Month rule under the shared axis. */}
        <div className="relative mt-1 h-4">
          {monthTicks.map((t) => (
            <span key={t.i}
              className="absolute top-0 -translate-x-1/2 text-[10px] text-neutral-400 dark:text-neutral-500"
              style={{ left: `${((t.i + 0.5) / n) * 100}%` }}>
              {t.label}
            </span>
          ))}
        </div>

        {active && (
          <div
            className="pointer-events-none absolute top-0 bottom-0 w-px bg-neutral-900/40 dark:bg-neutral-100/40"
            style={{ left: `${leftPct}%` }}
          />
        )}
      </div>

      {/*
        The share panel is unreadable without a key: on a quiet day one category
        can own half the column, and there is no way to name it without hovering
        every day. Ordered exactly as the stack, so the legend reads top-down the
        way the column does.
      */}
      <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-neutral-500 dark:text-neutral-400">
        {CATEGORIES.map((c) => (
          <li key={c.id} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: c.color }} />
            {c.short}
          </li>
        ))}
      </ul>

      {active && (
        <div
          role="tooltip"
          className={`pointer-events-none absolute top-2 z-20 rounded-md border border-neutral-300 bg-white p-2.5 text-xs shadow-lg dark:border-neutral-700 dark:bg-neutral-950 ${
            twoCol ? 'w-[26rem]' : 'w-60'
          }`}
          style={flip
            ? { right: `${100 - leftPct}%`, marginRight: '0.5rem' }
            : { left: `${leftPct}%`, marginLeft: '0.5rem' }}
        >
          <div className="flex items-baseline justify-between gap-2 border-b border-neutral-200 pb-1.5 dark:border-neutral-800">
            <span className="font-medium">{DATE_FULL.format(new Date(`${active.day}T12:00:00`))}</span>
            <span className="font-mono tabular-nums">{active.total}</span>
          </div>
          <ul className={`mt-1.5 gap-x-4 gap-y-0.5 ${twoCol ? 'grid grid-cols-2' : 'space-y-0.5'}`}>
            {rows
              .map((c) => {
                const v = active.byCat[c] ?? 0;
                const cat = CATEGORY_BY_ID.get(c);
                return (
                  <li key={c} className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: cat?.color ?? '#888' }} />
                    <span className="min-w-0 flex-1 truncate text-neutral-700 dark:text-neutral-300">
                      {cat?.short ?? c}
                    </span>
                    <span className="font-mono tabular-nums">{v}</span>
                    <span className="w-9 text-right font-mono tabular-nums text-neutral-500">
                      {Math.round((v / active.total) * 100)}%
                    </span>
                  </li>
                );
              })}
          </ul>
        </div>
      )}
    </div>
  );
}
