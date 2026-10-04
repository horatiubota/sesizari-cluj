'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import OutcomeBar from '@/components/OutcomeBar';
import { CATEGORIES } from '@/lib/categories';
import type { MatrixCell, OutcomeMatrix } from '@/lib/dashboard';
import { MIN_FOR_SHARE, nf, sesizari } from '@/lib/outcomes';

const NELOC = '(nelocalizat)';
const DATE = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short' });
const fmt = (iso: string) => DATE.format(new Date(`${iso}T12:00:00`));

export interface PickerProps {
  matrix: OutcomeMatrix;
  /** Last day the window covers, for the caption and the map link. */
  to: string;
}

/**
 * "What happens to reports like this, here?" -- the question the dashboard
 * exists to answer, as two selects and an answer.
 *
 * The choice lives in the URL (`?cat=&cartier=`) so a view can be linked and
 * cited. It is written with history.replaceState, which Next's router observes,
 * so choosing does not navigate, refetch, or grow the back stack.
 *
 * Deliberately absent: a time-to-close per pair. The resolution estimate needs
 * hundreds of observed closures to hold still, and most pairs have a handful;
 * the city-wide curve below is the only honest version of that number.
 */
export default function Picker(props: PickerProps) {
  const sp = useSearchParams();
  const [copied, setCopied] = useState(false);

  const set = (key: 'cat' | 'cartier', value: string) => {
    const next = new URLSearchParams(window.location.search);
    if (value === '*') next.delete(key); else next.set(key, value);
    const qs = next.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
    setCopied(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <PickerView {...props} cat={sp.get('cat') ?? '*'} cartier={sp.get('cartier') ?? '*'}
      onChange={set} onCopy={copy} copied={copied} />
  );
}

/**
 * The picker without the URL: renders a given selection. Used as the Suspense
 * fallback with the city-wide default, so the prerendered page already shows a
 * real answer and nothing jumps when the client takes over.
 */
export function PickerView({
  matrix, to, cat, cartier, onChange, onCopy, copied,
}: PickerProps & {
  cat: string;
  cartier: string;
  onChange?: (key: 'cat' | 'cartier', value: string) => void;
  onCopy?: () => void;
  copied?: boolean;
}) {
  const cartiere = Object.keys(matrix.cells)
    .filter((k) => k.startsWith('*|') && k !== '*|*')
    .map((k) => k.slice(2))
    .sort((a, b) => (a === NELOC ? 1 : b === NELOC ? -1 : a.localeCompare(b, 'ro')));

  // A pair absent from the matrix simply had no reports in the window.
  const validCat = cat === '*' || CATEGORIES.some((c) => String(c.id) === cat) ? cat : '*';
  const validNb = cartier === '*' || cartiere.includes(cartier) ? cartier : '*';
  const empty: MatrixCell = { o: [0, 0, 0, 0, 0, 0], w: Array(matrix.weeks.length).fill(0) };
  const cell = matrix.cells[`${validCat}|${validNb}`] ?? empty;

  const catName = CATEGORIES.find((c) => String(c.id) === validCat)?.name;
  const place = validNb === '*' ? 'tot orașul' : validNb === NELOC ? 'sesizări fără locație' : validNb;
  const title = `${catName ?? 'Toate categoriile'} · ${place}`;
  const from = matrix.weeks[0] ?? to;

  const mapQs = new URLSearchParams({ from, to });
  if (validCat !== '*') mapQs.set('cat', validCat);
  if (validNb !== '*' && validNb !== NELOC) mapQs.set('cartier', validNb);

  const disabled = !onChange;
  const select = 'h-11 w-full min-w-0 rounded-md border border-line-strong bg-surface px-3 text-[15px] text-ink disabled:opacity-60';

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block min-w-0">
          <span className="mb-1.5 block text-xs font-medium text-ink-2">Categorie</span>
          <select className={select} value={validCat} disabled={disabled}
            onChange={(e) => onChange?.('cat', e.target.value)}>
            <option value="*">Toate categoriile</option>
            {CATEGORIES.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
          </select>
        </label>
        <label className="block min-w-0">
          <span className="mb-1.5 block text-xs font-medium text-ink-2">Cartier</span>
          <select className={select} value={validNb} disabled={disabled}
            onChange={(e) => onChange?.('cartier', e.target.value)}>
            <option value="*">Tot orașul</option>
            {cartiere.map((n) => (
              <option key={n} value={n}>{n === NELOC ? 'Fără locație (nelocalizat)' : n}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6" aria-live="polite">
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>
        <p className="mt-1 text-sm text-ink-2">
          {cell.o[0]
            ? <>{sesizari(cell.o[0])} depuse între {fmt(from)} și {fmt(to)}, după cum s-au închis până acum:</>
            : <>Nicio sesizare depusă între {fmt(from)} și {fmt(to)} pentru această combinație.</>}
        </p>

        {cell.o[0] > 0 && (
          <div className="mt-4">
            <OutcomeBar counts={cell.o} label={title} size="lg" legend />
            {cell.o[0] < MIN_FOR_SHARE && (
              <p className="mt-3 text-sm text-ink-2">
                Prea puține sesizări pentru procente care să spună ceva; sunt afișate numerele.
              </p>
            )}
          </div>
        )}

        <WeeklyVolume weeks={matrix.weeks} values={cell.w} />

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <Link href={`/harta?${mapQs}`} className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
            Vezi aceste sesizări pe hartă
          </Link>
          {onCopy && (
            <button type="button" onClick={onCopy}
              className="text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink">
              {copied ? 'Link copiat' : 'Copiază linkul acestei selecții'}
            </button>
          )}
          <a href="#inchidere" className="text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink">
            Cât de repede se închid (tot orașul)
          </a>
        </div>
      </div>
    </div>
  );
}

/** Thirteen weekly columns; the label row names only the ends, the values are in the name. */
function WeeklyVolume({ weeks, values }: { weeks: string[]; values: number[] }) {
  const max = Math.max(...values, 1);
  const total = values.reduce((s, v) => s + v, 0);
  if (!total) return null;
  return (
    <figure className="mt-6">
      <figcaption className="text-xs text-ink-2">
        <span className="font-medium">Sesizări pe săptămână</span>
        <span className="text-ink-3"> · ultima săptămână evidențiată</span>
      </figcaption>
      <div role="img"
        aria-label={`Sesizări pe săptămână, ${weeks.map((w, i) => `${fmt(w)}: ${values[i]}`).join('; ')}`}
        className="mt-2 flex h-16 items-end gap-1">
        {values.map((v, i) => (
          <span key={weeks[i] ?? i}
            className={`flex-1 rounded-t-[2px] ${i === values.length - 1 ? 'bg-ink' : 'bg-line-strong'}`}
            style={{ height: `${Math.max((v / max) * 100, v ? 4 : 1)}%`, opacity: v ? 1 : 0.4 }} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-ink-3 tabular-nums" aria-hidden="true">
        <span>{weeks[0] ? fmt(weeks[0]) : ''}</span>
        <span>max {nf.format(max)}</span>
        <span>{weeks.at(-1) ? fmt(weeks.at(-1)!) : ''}</span>
      </div>
    </figure>
  );
}
