'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Outcome composition for one table row: a 100% stacked strip with a breakdown
 * that opens instantly on hover.
 *
 * Replaces a native `title`, which took about a second to appear, arrived as one
 * unstyled run of text, and could not show the band colours the strip is read
 * by. This is the only route to the per-outcome numbers now that the percentage
 * columns are gone, so it had to stop being an afterthought.
 *
 * The card is `position: fixed` rather than absolutely positioned inside the
 * cell. The table scrolls horizontally on narrow screens, and `overflow-x: auto`
 * makes the vertical axis a clipping context too, so an absolutely positioned
 * card would be cut off by the row that owns it. Fixed positioning is relative
 * to the viewport and escapes that -- no ancestor here has a transform, which is
 * the one thing that would re-anchor it.
 *
 * This is the dashboard's only interactive island; everything around it stays
 * server-rendered.
 */

interface Band { key: string; color: string; label: string }

const nf = new Intl.NumberFormat('ro-RO');

/** Romanian takes "de" before the noun when the last two digits are 0 or 20-99. */
function sesizari(n: number): string {
  if (n === 1) return '1 sesizare';
  const t = n % 100;
  return `${nf.format(n)} ${t === 0 || t >= 20 ? 'de ' : ''}sesizări`;
}

/**
 * Zero is nothing to report, not 0.0% -- an outcome this row never produced. A
 * share that is real but rounds to nothing gets a threshold instead, so the two
 * stay distinguishable.
 */
function share(n: number, total: number): string {
  if (n === 0 || total === 0) return '—';
  const p = (n / total) * 100;
  return p < 0.05 ? '<0.1%' : `${p.toFixed(1)}%`;
}

let seq = 0;

export default function OutcomeStrip({
  values, bands, label, windowDays,
}: {
  values: Record<string, number>;
  bands: Band[];
  label: string;
  windowDays: number;
}) {
  const total = bands.reduce((s, b) => s + (values[b.key] ?? 0), 0);
  const strip = useRef<HTMLSpanElement>(null);
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
  // Which band the pointer is over, so the card can pick that line out.
  const [hot, setHot] = useState<string | null>(null);
  const [id] = useState(() => `outcome-card-${++seq}`);

  const CARD_W = 260;

  const open = useCallback(() => {
    const el = strip.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Rough height, used only to choose a side; the card sizes itself.
    const h = 44 + bands.length * 20;
    const below = r.bottom + 10 + h < window.innerHeight;
    setAt({
      left: Math.min(Math.max(8, r.left), Math.max(8, window.innerWidth - CARD_W - 8)),
      top: below ? r.bottom + 10 : Math.max(8, r.top - h - 10),
    });
  }, [bands.length]);

  const close = useCallback(() => { setAt(null); setHot(null); }, []);

  useEffect(() => {
    if (!at) return;
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') close(); };
    // Touch has no pointerleave to rely on, so a press anywhere else dismisses.
    const onDown = (e: PointerEvent): void => {
      if (!strip.current?.contains(e.target as Node)) close();
    };
    // A fixed card does not travel with the row, so any scroll retires it rather
    // than leaving it pointing at whatever slid underneath.
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown, true);
    };
  }, [at, close]);

  if (!total) return null;

  return (
    <span className="relative block">
      <span
        ref={strip}
        tabIndex={0}
        role="button"
        aria-expanded={at ? true : false}
        aria-describedby={at ? id : undefined}
        aria-label={`Cum s-au închis: ${label}, ${sesizari(total)} în ultimele ${windowDays} de zile`}
        onPointerEnter={open}
        onPointerLeave={close}
        onFocus={open}
        onBlur={close}
        // Tap opens it too: `title` never worked on touch, and these numbers have
        // nowhere else to be read from. Deliberately not a toggle -- a tap fires
        // pointerenter first, which has already opened the card, so toggling here
        // would close it again on the same tap. Tapping elsewhere dismisses it.
        onClick={open}
        className="flex h-1.5 w-full overflow-hidden rounded-sm bg-neutral-200 outline-offset-4 dark:bg-neutral-800"
      >
        {bands.map((b) => {
          const p = ((values[b.key] ?? 0) / total) * 100;
          // Skipped rather than drawn at hairline width: a sliver too thin to
          // read still eats a pixel of the band beside it and shifts every seam.
          return p > 0.4 ? (
            <span key={b.key} onPointerEnter={() => setHot(b.key)}
              style={{ width: `${p}%`, backgroundColor: b.color }} />
          ) : null;
        })}
      </span>

      {at && (
        <span
          id={id}
          role="tooltip"
          style={{ left: at.left, top: at.top, width: CARD_W }}
          className="pointer-events-none fixed z-50 block rounded-md border border-neutral-300 bg-white p-2.5 text-xs shadow-lg dark:border-neutral-700 dark:bg-neutral-950"
        >
          <span className="block font-medium">{label}</span>
          <span className="mt-0.5 block text-neutral-500">
            {sesizari(total)} în ultimele {windowDays} de zile
          </span>
          <span className="mt-2 block border-t border-neutral-200 pt-1.5 dark:border-neutral-800">
            {bands.map((b) => {
              const n = values[b.key] ?? 0;
              return (
                <span key={b.key}
                  className={`flex items-baseline gap-1.5 py-0.5 ${
                    hot === b.key ? 'font-medium text-neutral-900 dark:text-neutral-100'
                      : 'text-neutral-600 dark:text-neutral-400'}`}>
                  <span aria-hidden="true"
                    className="mt-[3px] h-2 w-2 shrink-0 rounded-[2px]"
                    style={{ backgroundColor: b.color }} />
                  <span className="flex-1 truncate">{b.label}</span>
                  <span className="font-mono tabular-nums">{nf.format(n)}</span>
                  <span className="w-12 text-right font-mono tabular-nums">
                    {share(n, total)}
                  </span>
                </span>
              );
            })}
          </span>
        </span>
      )}
    </span>
  );
}
