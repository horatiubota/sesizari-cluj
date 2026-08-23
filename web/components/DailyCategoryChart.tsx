'use client';

import { useMemo, useRef, useState } from 'react';
import { CATEGORY_BY_ID } from '@/lib/categories';

/**
 * Daily report volume, stacked by category, with a hover breakdown.
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

export default function DailyCategoryChart({ data, order }: { data: Day[]; order: number[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const max = useMemo(() => Math.max(...data.map((d) => d.total), 1), [data]);
  const n = data.length;

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
        <svg viewBox={`0 0 ${n} 100`} preserveAspectRatio="none" className="block h-56 w-full"
          role="img" aria-label={`Sesizări pe zi, pe categorii, ${n} zile, maxim ${max} într-o zi`}>
          {data.map((d, i) => {
            let acc = 0;
            return (
              <g key={d.day} opacity={hover === null || hover === i ? 1 : 0.45}>
                {order.map((catId) => {
                  const v = d.byCat[catId] ?? 0;
                  if (!v) return null;
                  const h = (v / max) * 100;
                  const y = 100 - acc - h;
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

        {active && (
          <div
            className="pointer-events-none absolute top-0 bottom-0 w-px bg-neutral-900/40 dark:bg-neutral-100/40"
            style={{ left: `${leftPct}%` }}
          />
        )}
      </div>

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
