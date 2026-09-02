'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
// MapLibre 6 ships named exports only; there is no default export.
import {
  AttributionControl, Map as MLMap, NavigationControl, setWorkerUrl,
  type GeoJSONSource,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  CATEGORIES, CATEGORY_BY_ID, CLUJ_BOUNDS, CLUJ_CENTER, OUTCOMES, OUTCOME_LABEL, readableOn,
} from '@/lib/categories';
import { useWatchlist } from '@/lib/watchlist';

/**
 * Map-first explorer.
 *
 * The server decides whether to return aggregated grid cells or individual
 * tickets based on how many match, so panning at city scale transfers kilobytes
 * while street scale gives full detail. The client just renders what it gets.
 */

const BASEMAP = 'https://tiles.openfreemap.org/styles/positron';

/**
 * Circle outline, as a data expression keyed on the open ticket.
 *
 * Selection is drawn on the map itself rather than only in the panel, so it stays
 * obvious which of several nearby pins is the one being read. Repainting via
 * setPaintProperty keeps the source data untouched -- re-setting the GeoJSON
 * would throw away the layer's render state on every click.
 */
const isSelected = (id: string | null) => ['==', ['get', 'ticket'], id ?? ''] as const;
const STROKE_WIDTH = (id: string | null) => ['case', isSelected(id), 3, 1] as unknown as never;
const STROKE_COLOR = (id: string | null) =>
  ['case', isSelected(id), '#111111', 'rgba(255,255,255,0.85)'] as unknown as never;

// MapLibre 6 loads its worker from a separate file and resolves the path from
// `import.meta.url`. Turbopack rewrites that to something unusable: the URL
// collapses to an empty string, the browser resolves it against the document,
// and the worker load fails with "non-JavaScript MIME type of text/html".
// Nothing renders when that happens — tile parsing lives entirely in the
// worker, so the basemap stays blank and `load` never fires, which also means
// the ticket layer is never requested. scripts/copy-maplibre-worker.mjs places
// the worker under public/ so we can name it explicitly.
setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');

interface Cell { lat: number; lon: number; n: number; top_category: number; pct_favorabil: number }
interface Point {
  ticket_number: string; lat: number; lon: number; category_id: number;
  status_code: string; status_label: string; created_at: string;
  neighborhood: string | null;
}
interface Detail {
  ticket_number: string; description: string | null; resolve_reason: string | null;
  status_label: string; created_at: string; neighborhood: string | null;
  category: string; category_id: number; lat: number | null; lon: number | null;
}
interface MapResponse {
  mode: 'cells' | 'points'; total: number;
  cells?: Cell[]; points?: Point[];
}
interface Term { word: string; n: number; ratio: number }

type RangeKey = '7d' | '30d' | '90d' | 'ytd' | 'custom';

const RANGES: { key: RangeKey; label: string }[] = [
  { key: '7d',     label: '7 zile' },
  { key: '30d',    label: '30 de zile' },
  { key: '90d',    label: '90 de zile' },
  { key: 'ytd',    label: 'Anul curent' },
  { key: 'custom', label: 'Interval propriu' },
];

/**
 * Today as YYYY-MM-DD in Europe/Bucharest, matching how the server buckets days.
 * Using the browser's own timezone would shift the boundary for anyone abroad.
 */
const BUCHAREST_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit',
});

function shiftDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

/** Never notifies: the client/server answer flips once, at hydration. */
const subscribeNever = (): (() => void) => () => {};

/** Presets are inclusive of today, so "7 zile" spans today and the six before it. */
function resolveRange(key: RangeKey, customFrom: string, customTo: string):
{ from: string; to: string } {
  if (key === 'custom') return { from: customFrom, to: customTo };
  const today = BUCHAREST_DAY.format(new Date());
  if (key === 'ytd') return { from: `${today.slice(0, 4)}-01-01`, to: today };
  const span = key === '7d' ? 7 : key === '30d' ? 30 : 90;
  return { from: shiftDays(today, -(span - 1)), to: today };
}

export default function MapExplorer() {
  // The dashboard links here with a filter already chosen, so the map has to be
  // able to open in that state rather than only reaching it by clicking.
  const params = useSearchParams();
  const router = useRouter();
  const initial = useMemo(() => {
    const cat = (params.get('cat') ?? '')
      .split(',').map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 16);
    const iso = (v: string | null): string =>
      /^\d{4}-\d{2}-\d{2}$/.test(v ?? '') ? v! : '';
    const from = iso(params.get('from'));
    const to = iso(params.get('to'));
    const ticket = /^CAS-\d{4,10}$/.test(params.get('t') ?? '') ? params.get('t')! : '';
    return { cat, from, to, cartier: params.get('cartier') ?? '', ticket };
    // Read once: later filter changes are owned by this component's state, not
    // by the URL, so re-reading would fight the user's own edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const arrivedFiltered = Boolean(
    initial.cat.length || initial.cartier || initial.from || initial.to,
  );
  const didFit = useRef(false);

  const watch = useWatchlist();

  const mapNode = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);

  const [cats, setCats] = useState<number[]>(initial.cat);
  const [outcome, setOutcome] = useState<string>('');
  // An explicit range in the URL wins over the default preset.
  const [range, setRange] = useState<RangeKey>(initial.from || initial.to ? 'custom' : '7d');
  const [customFrom, setCustomFrom] = useState(initial.from);
  const [customTo, setCustomTo] = useState(initial.to);
  const [cartier, setCartier] = useState(initial.cartier);

  // The preset resolves against the current date, which the server render cannot
  // know: this route is prerendered at build time, so a date baked into the HTML
  // would be stale within a day and mismatch on hydration. Resolve on the client
  // only. useSyncExternalStore is the hydration-safe way to ask "am I client yet".
  const isClient = useSyncExternalStore(subscribeNever, () => true, () => false);
  const { from, to } = isClient
    ? resolveRange(range, customFrom, customTo)
    : { from: '', to: '' };
  const [q, setQ] = useState('');
  const [qLive, setQLive] = useState('');

  const [data, setData] = useState<MapResponse | null>(null);
  const [terms, setTerms] = useState<Term[]>([]);
  // `selectedId` opens the panel immediately on click; `selected` arrives when
  // the fetch lands. Splitting them avoids a dead beat between the two.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Detail | null>(null);
  const detailReq = useRef<AbortController | null>(null);
  const [loading, setLoading] = useState(false);

  // Debounce the free-text box so typing does not fire a query per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setQ(qLive), 400);
    return () => clearTimeout(t);
  }, [qLive]);

  const filterQS = useMemo(() => {
    const p = new URLSearchParams();
    if (cats.length) p.set('cat', cats.join(','));
    if (outcome) p.set('outcome', outcome);
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    if (q) p.set('q', q);
    if (cartier) p.set('cartier', cartier);
    return p;
  }, [cats, outcome, from, to, q, cartier]);

  const inflight = useRef<AbortController | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const m = map.current;
    if (!m) return;
    const b = m.getBounds();
    const p = new URLSearchParams(filterQS);
    p.set('bbox', [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].join(','));
    p.set('z', String(Math.round(m.getZoom())));

    setLoading(true);
    try {
      // The map response is what the user is waiting for, so it goes first and
      // renders on its own. Terms are supplementary and much more expensive, so
      // they are never allowed to hold up the map.
      const mapRes = await fetch(`/api/map?${p}`, { signal }).then(
        (r) => r.json() as Promise<MapResponse>,
      );
      if (signal?.aborted) return;
      setData(mapRes);

      fetch(`/api/terms?${p}`, { signal })
        .then((r) => r.json() as Promise<{ terms: Term[] }>)
        .then((t) => { if (!signal?.aborted) setTerms(t.terms ?? []); })
        .catch(() => { /* aborted or failed; the map is already usable */ });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') throw err;
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [filterQS]);

  // Initialise the map once.
  useEffect(() => {
    if (map.current || !mapNode.current) return;
    const m = new MLMap({
      container: mapNode.current,
      style: BASEMAP,
      center: CLUJ_CENTER,
      zoom: 12,
      maxBounds: [[23.2, 46.5], [24.0, 47.0]],
      attributionControl: false,
    });
    // Top-right belongs to the detail panel, which would otherwise cover the
    // zoom buttons exactly when you want to zoom while reading a report.
    m.addControl(new NavigationControl({ showCompass: false }), 'top-left');
    m.addControl(
      new AttributionControl({
        customAttribution:
          'Date: Primăria Cluj-Napoca (My Cluj) · Hartă: © OpenStreetMap, OpenFreeMap',
      }),
      'bottom-right',
    );
    m.on('load', () => {
      m.fitBounds(CLUJ_BOUNDS, { padding: 20, animate: false });
      setReady(true);
    });
    map.current = m;
  }, []);

  // Re-query on pan/zoom.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;

    let timer: ReturnType<typeof setTimeout>;
    const run = (): void => {
      inflight.current?.abort();
      const ac = new AbortController();
      inflight.current = ac;
      void refresh(ac.signal);
    };
    // A single drag emits many moveend events; querying on each one is what
    // exhausted the database's shared CPU.
    const handler = (): void => {
      clearTimeout(timer);
      timer = setTimeout(run, 450);
    };

    m.on('moveend', handler);
    run();
    return () => {
      clearTimeout(timer);
      inflight.current?.abort();
      m.off('moveend', handler);
    };
  }, [ready, refresh]);

  // Draw whatever the server returned.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !data) return;

    const features =
      data.mode === 'cells'
        ? (data.cells ?? []).map((c) => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [c.lon, c.lat] },
            properties: {
              n: c.n,
              color: CATEGORY_BY_ID.get(c.top_category)?.color ?? '#888',
              pct: c.pct_favorabil,
              kind: 'cell',
            },
          }))
        : (data.points ?? []).map((p) => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] },
            properties: {
              n: 1,
              color: CATEGORY_BY_ID.get(p.category_id)?.color ?? '#888',
              kind: 'point',
              ticket: p.ticket_number,
            },
          }));

    const geojson = { type: 'FeatureCollection' as const, features };

    // Arriving from a dashboard link, the default city view may not be where the
    // selection is. Frame the results once, then leave the camera to the user.
    if (!didFit.current && arrivedFiltered && features.length) {
      didFit.current = true;
      // Reduce rather than Math.min(...coords): a points response can carry 6,000
      // features, which is enough spread arguments to overflow the stack.
      const b = features.reduce(
        (acc, f) => {
          const [lon, lat] = f.geometry.coordinates;
          return [
            Math.min(acc[0], lon), Math.min(acc[1], lat),
            Math.max(acc[2], lon), Math.max(acc[3], lat),
          ] as [number, number, number, number];
        },
        [180, 90, -180, -90] as [number, number, number, number],
      );
      m.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 60, animate: false, maxZoom: 15 });
    }

    const src = m.getSource('tickets') as GeoJSONSource | undefined;
    if (src) {
      src.setData(geojson);
      return;
    }

    m.addSource('tickets', { type: 'geojson', data: geojson });
    m.addLayer({
      id: 'tickets-circles',
      type: 'circle',
      source: 'tickets',
      paint: {
        'circle-color': ['get', 'color'],
        'circle-opacity': 0.72,
        'circle-stroke-width': STROKE_WIDTH(null),
        'circle-stroke-color': STROKE_COLOR(null),
        'circle-radius': [
          'interpolate', ['linear'], ['get', 'n'],
          1, 5, 10, 9, 50, 15, 200, 22, 1000, 32,
        ],
      },
    });
    m.addLayer({
      id: 'tickets-count',
      type: 'symbol',
      source: 'tickets',
      filter: ['>', ['get', 'n'], 9],
      layout: { 'text-field': ['to-string', ['get', 'n']], 'text-size': 11 },
      paint: { 'text-color': '#fff', 'text-halo-color': 'rgba(0,0,0,.45)', 'text-halo-width': 1 },
    });

    m.on('click', 'tickets-circles', (e) => {
      const f = e.features?.[0];
      if (!f) return;
      if (f.properties?.kind === 'cell') {
        const coords = (f.geometry as { coordinates: [number, number] }).coordinates;
        m.easeTo({ center: coords, zoom: m.getZoom() + 2 });
      } else {
        const tn = f.properties?.ticket as string;
        detailReq.current?.abort();
        const ac = new AbortController();
        detailReq.current = ac;
        setSelectedId(tn);
        setSelected(null);
        void fetch(`/api/ticket/${tn}`, { signal: ac.signal })
          .then((r) => (r.ok ? (r.json() as Promise<Detail>) : null))
          .then((d) => { if (!ac.signal.aborted) setSelected(d); })
          .catch(() => { /* superseded by a newer click, or offline */ });
      }
    });
    m.on('mouseenter', 'tickets-circles', () => { m.getCanvas().style.cursor = 'pointer'; });
    m.on('mouseleave', 'tickets-circles', () => { m.getCanvas().style.cursor = ''; });
  }, [data, ready, arrivedFiltered]);

  // Arriving from the watchlist as /harta?t=CAS-…: open that ticket and centre on
  // it. The panel is driven by the detail fetch rather than by the map layer, so
  // it works even when the ticket falls outside the active filters -- which it
  // usually does, the default range being the last seven days. The pin itself
  // only draws if the filters happen to include it.
  const deepLinked = useRef(false);
  useEffect(() => {
    const tn = initial.ticket;
    if (!tn || !ready || deepLinked.current) return;
    deepLinked.current = true;
    detailReq.current?.abort();
    const ac = new AbortController();
    detailReq.current = ac;
    setSelectedId(tn);
    setSelected(null);
    void fetch(`/api/ticket/${tn}`, { signal: ac.signal })
      .then((r) => (r.ok ? (r.json() as Promise<Detail>) : null))
      .then((d) => {
        if (ac.signal.aborted || !d) return;
        setSelected(d);
        if (d.lat != null && d.lon != null) {
          // Claim the camera before the draw effect's fit-to-results can take it.
          didFit.current = true;
          map.current?.flyTo({ center: [d.lon, d.lat], zoom: 16, animate: false });
        }
      })
      .catch(() => { /* offline, or a ticket number that no longer resolves */ });
  }, [ready, initial.ticket]);

  const closeDetail = useCallback((): void => {
    detailReq.current?.abort();
    setSelectedId(null);
    setSelected(null);
  }, []);

  // Escape closes the panel, the convention for anything overlaying content.
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') closeDetail(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, closeDetail]);

  const cat = selected ? CATEGORY_BY_ID.get(selected.category_id) : undefined;

  // Re-paint the outline when the selection changes. Guarded on the layer
  // existing: it is added by the draw effect, which may not have run yet.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !m.getLayer('tickets-circles')) return;
    m.setPaintProperty('tickets-circles', 'circle-stroke-width', STROKE_WIDTH(selectedId));
    m.setPaintProperty('tickets-circles', 'circle-stroke-color', STROKE_COLOR(selectedId));
  }, [selectedId, ready, data]);

  const toggleCat = (id: number): void =>
    setCats((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col-reverse md:flex-row">
      <aside className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto border-t border-neutral-200 bg-white p-4 md:min-h-0 md:w-96 md:border-r md:border-t-0 dark:border-neutral-800 dark:bg-neutral-950">
        <header>
          {/* The visible title lives in the site header; this keeps the page a
              labelled document without repeating the brand inside the filters. */}
          <h1 className="sr-only">Hartă</h1>
          <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
            Sesizările publice din martie 2017 până azi, preluate din platforma
            My Cluj a Primăriei Cluj-Napoca.
          </p>
        </header>

        <div className="rounded-md border border-neutral-200 p-3 text-sm dark:border-neutral-800">
          <div className="flex items-baseline justify-between">
            <span className="text-neutral-600 dark:text-neutral-400">În zona afișată</span>
            <span className="font-mono text-base font-semibold tabular-nums">
              {loading ? '…' : (data?.total ?? 0).toLocaleString('ro-RO')}
            </span>
          </div>
          {data?.mode === 'cells' && (
            <p className="mt-1 text-xs text-neutral-500">
              Grupate pe zone. Apasă pe un cerc pentru detalii.
            </p>
          )}
        </div>

        {cartier && (
          <div className="flex items-center gap-2 rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs dark:border-neutral-700">
            <span className="text-neutral-500">Cartier</span>
            <span className="truncate font-medium">{cartier}</span>
            <button
              onClick={() => {
                setCartier('');
                // Drop it from the address bar too, so a refresh or a shared link
                // does not silently bring the filter back.
                router.replace('/harta', { scroll: false });
              }}
              aria-label={`Elimină filtrul de cartier ${cartier}`}
              className="ml-auto shrink-0 rounded p-0.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-900 dark:hover:text-neutral-100">
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5"
                  strokeLinecap="round" fill="none" />
              </svg>
            </button>
          </div>
        )}

        <label className="block">
          <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Caută în text</span>
          <input
            value={qLive}
            onChange={(e) => setQLive(e.target.value)}
            placeholder="ex. groapă, iluminat, ambrozie"
            className="mt-1 w-full rounded border border-neutral-300 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700"
          />
        </label>

        <div>
          <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Perioadă</span>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {RANGES.map((r) => (
              <button key={r.key} type="button" onClick={() => setRange(r.key)}
                aria-pressed={range === r.key}
                className={`rounded-full border px-2 py-0.5 text-[11px] transition ${
                  range === r.key
                    ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
                    : 'border-neutral-300 text-neutral-600 hover:border-neutral-500 dark:border-neutral-700 dark:text-neutral-400'
                }`}>
                {r.label}
              </button>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="block">
              <span className={`text-xs font-medium ${range === 'custom'
                ? 'text-neutral-700 dark:text-neutral-300' : 'text-neutral-400 dark:text-neutral-600'}`}>
                De la
              </span>
              <input type="date" value={range === 'custom' ? customFrom : from}
                disabled={range !== 'custom'}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="mt-1 w-full rounded border border-neutral-300 bg-transparent px-2 py-1.5 text-sm disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-400 dark:border-neutral-700 dark:disabled:border-neutral-800 dark:disabled:text-neutral-600" />
            </label>
            <label className="block">
              <span className={`text-xs font-medium ${range === 'custom'
                ? 'text-neutral-700 dark:text-neutral-300' : 'text-neutral-400 dark:text-neutral-600'}`}>
                Până la
              </span>
              <input type="date" value={range === 'custom' ? customTo : to}
                disabled={range !== 'custom'}
                onChange={(e) => setCustomTo(e.target.value)}
                className="mt-1 w-full rounded border border-neutral-300 bg-transparent px-2 py-1.5 text-sm disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-400 dark:border-neutral-700 dark:disabled:border-neutral-800 dark:disabled:text-neutral-600" />
            </label>
          </div>
          {range === 'custom' && !customFrom && !customTo && (
            <p className="mt-1 text-[11px] text-neutral-500">
              Fără date completate: toate sesizările, din martie 2017.
            </p>
          )}
        </div>

        <label className="block">
          <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Rezoluție</span>
          <select value={outcome} onChange={(e) => setOutcome(e.target.value)}
            className="mt-1 w-full rounded border border-neutral-300 bg-transparent px-2 py-1.5 text-sm dark:border-neutral-700">
            <option value="">Toate</option>
            {OUTCOMES.map((o) => (
              <option key={o} value={o}>{OUTCOME_LABEL[o] ?? o}</option>
            ))}
          </select>
        </label>

        <div>
          <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Categorii</span>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {CATEGORIES.map((c) => {
              const on = cats.includes(c.id);
              return (
                <button key={c.id} onClick={() => toggleCat(c.id)} aria-pressed={on}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] transition ${
                    on
                      ? 'border-transparent'
                      : 'border-neutral-300 text-neutral-700 hover:border-neutral-500 dark:border-neutral-700 dark:text-neutral-300'
                  }`}
                  style={on ? { backgroundColor: c.color, color: readableOn(c.color) } : undefined}>
                  {/* Same colour as this category's pins, so the list doubles as
                      the map legend. Kept in both states so toggling a chip does
                      not change its width and reflow the wrapped rows. When the
                      chip is filled the dot goes solid contrast rather than
                      ringed: a ringed dot reads as an *unchecked* radio, which is
                      the opposite of what a selected chip should signal. */}
                  <span aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: on ? readableOn(c.color) : c.color }} />
                  {c.short}
                </button>
              );
            })}
          </div>
        </div>

        {terms.length > 0 && (
          <div>
            <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
              Specific acestei zone
            </span>
            <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">
              Cuvinte mai frecvente aici decât în restul orașului.
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {terms.slice(0, 14).map((t) => (
                <span key={t.word} title={`${t.ratio.toFixed(1)}× față de media orașului`}
                  className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] dark:bg-neutral-900">
                  {t.word}
                  <span className="ml-1 text-neutral-500 tabular-nums">{t.ratio.toFixed(1)}×</span>
                </span>
              ))}
            </div>
          </div>
        )}

      </aside>

      {/* The map and its overlay share a positioning context so the detail panel
          can sit on top of the map rather than pushing the layout around. */}
      <div className="relative flex min-h-[50dvh] w-full flex-1">
        {/* Sized by flex, not by percentage or absolute positioning. `h-full`
            resolves to 0 because no ancestor has a definite height (the shell is
            min-h-dvh), and `absolute inset-0` loses to maplibre-gl.css's
            `.maplibregl-map { position: relative }`, whose stylesheet loads after
            Tailwind's. Stretching a flex item gives a real box in both cases. */}
        <div ref={mapNode} className="min-h-0 w-full flex-1" />

        {selectedId && (
          <aside
            role="dialog" aria-modal="false" aria-label={`Detalii sesizarea ${selectedId}`}
            className="absolute inset-x-2 top-2 z-10 flex max-h-[calc(100%-1rem)] flex-col overflow-hidden rounded-md border border-neutral-300 bg-white shadow-lg md:inset-x-auto md:top-3 md:right-3 md:max-h-[calc(100%-1.5rem)] md:w-[22rem] dark:border-neutral-700 dark:bg-neutral-950"
          >
            <header className="flex items-start justify-between gap-2 border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
              <div className="min-w-0">
                <span className="block font-mono text-xs text-neutral-500">{selectedId}</span>
                {cat && (
                  <span className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-medium">
                    <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: cat.color }} />
                    <span className="truncate">{cat.short}</span>
                  </span>
                )}
              </div>
              <button onClick={closeDetail} aria-label="Închide detaliile"
                className="-mr-1 shrink-0 rounded p-1 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-900 dark:hover:text-neutral-100">
                <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5"
                    strokeLinecap="round" fill="none" />
                </svg>
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              {!selected ? (
                <div className="space-y-2" aria-live="polite">
                  <span className="sr-only">Se încarcă</span>
                  <div className="h-3 w-2/3 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
                  <div className="h-3 w-full animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
                  <div className="h-3 w-5/6 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
                </div>
              ) : (
                <>
                  <p className="text-xs text-neutral-500">
                    {OUTCOME_LABEL[selected.status_label] ?? selected.status_label}
                    {selected.neighborhood ? ` · ${selected.neighborhood}` : ''}
                    {' · '}
                    {new Date(selected.created_at).toLocaleDateString('ro-RO')}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed whitespace-pre-line">
                    {selected.description ?? '(fără descriere)'}
                  </p>
                  {selected.resolve_reason && (
                    <div className="mt-3 border-l-2 border-neutral-300 pl-2 dark:border-neutral-700">
                      <span className="text-[11px] font-medium text-neutral-500">Răspuns oficial</span>
                      <p className="text-sm leading-relaxed whitespace-pre-line">
                        {selected.resolve_reason}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            <footer className="flex items-center justify-between gap-2 border-t border-neutral-200 px-3 py-2 dark:border-neutral-800">
              {/* The status at this moment is stored alongside the ticket so
                  /urmarite can say what it changed *from*. */}
              <button
                onClick={() => watch.toggle(selectedId, selected?.status_label)}
                aria-pressed={watch.has(selectedId)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
                  watch.has(selectedId)
                    ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
                    : 'border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900'
                }`}>
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true"
                  fill={watch.has(selectedId) ? 'currentColor' : 'none'}
                  stroke="currentColor" strokeWidth="1.3">
                  <path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z"
                    strokeLinejoin="round" />
                </svg>
                {watch.has(selectedId) ? 'Urmărită' : 'Urmărește'}
              </button>
              <a href={`https://mycluj.e-primariaclujnapoca.ro/?c=${selectedId}`}
                target="_blank" rel="noreferrer"
                className="text-xs underline underline-offset-2">
                Platforma oficială →
              </a>
            </footer>
          </aside>
        )}
      </div>
    </div>
  );
}
