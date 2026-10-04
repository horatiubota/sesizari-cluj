'use client';

import { useRef, useState } from 'react';
import { nf, sesizari } from '@/lib/outcomes';

const DATE = new Intl.DateTimeFormat('ro-RO', { weekday: 'short', day: 'numeric', month: 'short' });
const MONTH = new Intl.DateTimeFormat('ro-RO', { month: 'short' });
const fmt = (iso: string) => DATE.format(new Date(`${iso}T12:00:00`));

/**
 * Reports per day, with a 7-day trailing mean over them.
 *
 * Replaces the 100%-stacked category chart, whose sixteen colours read as
 * confetti on a phone and could only be read with a mouse ("treci cu mausul").
 * Totals carry the trend; categories get their own rows below it.
 *
 * Every day is readable three ways: pointer (hover or drag), tap, and the arrow
 * keys once the chart has focus. The readout above the chart is always visible
 * and announced politely, so nothing depends on a hover card.
 *
 * The newest day may be partial -- the sync runs mid-day and reports keep
 * arriving after it -- so it is drawn faint and labelled as such.
 */
export default function DailyVolume({ days, partialDay }: {
  days: { day: string; total: number }[];
  partialDay: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const lastFull = days.findLastIndex((d) => d.day !== partialDay);
  const [active, setActive] = useState(Math.max(lastFull, 0));
  if (!days.length) return null;

  const n = days.length;
  const max = Math.max(...days.map((d) => d.total), 1);
  const mean = days.map((_, i) => {
    const win = days.slice(Math.max(0, i - 6), i + 1);
    return win.reduce((s, d) => s + d.total, 0) / win.length;
  });
  const y = (v: number) => 100 - (v / max) * 100;
  const path = mean.map((v, i) => `${i === 0 ? 'M' : 'L'}${i + 0.5},${y(v)}`).join(' ');

  const pick = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setActive(Math.min(n - 1, Math.max(0, Math.floor(((clientX - r.left) / r.width) * n))));
  };
  const onKey = (e: React.KeyboardEvent) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, PageUp: -7, PageDown: 7 }[e.key];
    if (step) { e.preventDefault(); setActive((a) => Math.min(n - 1, Math.max(0, a + step))); }
    if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    if (e.key === 'End') { e.preventDefault(); setActive(n - 1); }
  };

  const d = days[active]!;
  // Month ticks: the first day of each month that the window shows in full.
  const ticks = days
    .map((x, i) => ({ i, day: x.day }))
    .filter(({ day, i }) => day.endsWith('-01') && i > 0);

  return (
    <figure>
      <p aria-live="polite" className="flex flex-wrap items-baseline gap-x-3 text-sm">
        <span className="font-medium capitalize">{fmt(d.day)}</span>
        <span className="tabular-nums">{sesizari(d.total)}</span>
        <span className="text-ink-3 tabular-nums">media pe 7 zile {nf.format(Math.round(mean[active]!))}</span>
        {d.day === partialDay && <span className="text-ink-3">· zi posibil incompletă</span>}
      </p>
      <div ref={box} tabIndex={0} role="slider"
        aria-label="Sesizări pe zi; folosește săgețile pentru a alege ziua"
        aria-valuemin={0} aria-valuemax={n - 1} aria-valuenow={active}
        aria-valuetext={`${fmt(d.day)}: ${sesizari(d.total)}`}
        onKeyDown={onKey}
        onPointerDown={(e) => pick(e.clientX)}
        onPointerMove={(e) => { if (e.pointerType === 'mouse' || e.buttons) pick(e.clientX); }}
        className="relative mt-3 h-44 touch-pan-y select-none">
        <div className="absolute inset-0 flex items-end gap-px">
          {days.map((x, i) => (
            <span key={x.day}
              className={`flex-1 ${i === active ? 'bg-ink' : 'bg-chart/70'}`}
              style={{ height: `${100 - y(x.total)}%`, opacity: x.day === partialDay ? 0.4 : 1 }} />
          ))}
        </div>
        <svg viewBox={`0 0 ${n} 100`} preserveAspectRatio="none" aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
          <path d={path} fill="none" stroke="var(--ink)" strokeWidth={1.75} strokeLinejoin="round"
            vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="relative mt-1.5 h-4 text-xs text-ink-3" aria-hidden="true">
        {ticks.map(({ i, day }) => (
          <span key={day} className="absolute -translate-x-1/2" style={{ left: `${((i + 0.5) / n) * 100}%` }}>
            {MONTH.format(new Date(`${day}T12:00:00`)).replace('.', '')}
          </span>
        ))}
      </div>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 bg-chart/70" aria-hidden="true" />
          sesizări în ziua respectivă
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded-full bg-ink" aria-hidden="true" />
          media ultimelor 7 zile
        </span>
        <span>maxim {nf.format(max)}/zi</span>
      </figcaption>
    </figure>
  );
}
