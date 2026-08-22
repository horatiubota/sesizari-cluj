'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// MapLibre 6 ships named exports only; there is no default export.
import { AttributionControl, Map as MLMap, NavigationControl, type GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { CATEGORIES, CATEGORY_BY_ID, CLUJ_BOUNDS, CLUJ_CENTER, OUTCOMES, OUTCOME_LABEL } from '@/lib/categories';

/**
 * Map-first explorer.
 *
 * The server decides whether to return aggregated grid cells or individual
 * tickets based on how many match, so panning at city scale transfers kilobytes
 * while street scale gives full detail. The client just renders what it gets.
 */

const BASEMAP = 'https://tiles.openfreemap.org/styles/positron';

interface Cell { lat: number; lon: number; n: number; top_category: number; pct_favorabil: number }
interface Point {
  ticket_number: string; lat: number; lon: number; category_id: number;
  status_code: string; status_label: string; created_at: string;
  neighborhood: string | null;
}
interface Detail {
  ticket_number: string; description: string | null; resolve_reason: string | null;
  status_label: string; created_at: string; neighborhood: string | null; category: string;
}
interface MapResponse {
  mode: 'cells' | 'points'; total: number;
  cells?: Cell[]; points?: Point[];
}
interface Term { word: string; n: number; ratio: number }

export default function MapExplorer() {
  const mapNode = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);

  const [cats, setCats] = useState<number[]>([]);
  const [outcome, setOutcome] = useState<string>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  const [qLive, setQLive] = useState('');

  const [data, setData] = useState<MapResponse | null>(null);
  const [terms, setTerms] = useState<Term[]>([]);
  const [selected, setSelected] = useState<Detail | null>(null);
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
    return p;
  }, [cats, outcome, from, to, q]);

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
    m.addControl(new NavigationControl({ showCompass: false }), 'top-right');
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
        'circle-stroke-width': 1,
        'circle-stroke-color': 'rgba(255,255,255,0.85)',
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
        void fetch(`/api/ticket/${tn}`)
          .then((r) => (r.ok ? (r.json() as Promise<Detail>) : null))
          .then(setSelected);
      }
    });
    m.on('mouseenter', 'tickets-circles', () => { m.getCanvas().style.cursor = 'pointer'; });
    m.on('mouseleave', 'tickets-circles', () => { m.getCanvas().style.cursor = ''; });
  }, [data, ready]);

  const toggleCat = (id: number): void =>
    setCats((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  return (
    <div className="flex h-dvh w-full flex-col-reverse md:flex-row">
      <aside className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto border-t border-neutral-200 bg-white p-4 md:h-full md:w-96 md:border-r md:border-t-0 dark:border-neutral-800 dark:bg-neutral-950">
        <header>
          <h1 className="text-lg font-semibold tracking-tight">Sesizări Cluj</h1>
          <p className="mt-1 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
            210.721 sesizări publice din martie 2017 până azi, preluate din platforma
            My Cluj a Primăriei Cluj-Napoca.
          </p>
          <a href="/recurente" className="mt-2 inline-block text-xs underline underline-offset-4">
            Probleme recurente →
          </a>
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

        <label className="block">
          <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Caută în text</span>
          <input
            value={qLive}
            onChange={(e) => setQLive(e.target.value)}
            placeholder="ex. groapă, iluminat, ambrozie"
            className="mt-1 w-full rounded border border-neutral-300 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">De la</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="mt-1 w-full rounded border border-neutral-300 bg-transparent px-2 py-1.5 text-sm dark:border-neutral-700" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Până la</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="mt-1 w-full rounded border border-neutral-300 bg-transparent px-2 py-1.5 text-sm dark:border-neutral-700" />
          </label>
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
                <button key={c.id} onClick={() => toggleCat(c.id)}
                  className={`rounded-full border px-2 py-0.5 text-[11px] transition ${
                    on ? 'border-transparent text-white' : 'border-neutral-300 text-neutral-700 dark:border-neutral-700 dark:text-neutral-300'
                  }`}
                  style={on ? { backgroundColor: c.color } : undefined}>
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

        {selected && (
          <div className="rounded-md border border-neutral-300 p-3 text-sm dark:border-neutral-700">
            <div className="flex items-start justify-between gap-2">
              <span className="font-mono text-xs">{selected.ticket_number}</span>
              <button onClick={() => setSelected(null)} className="text-xs text-neutral-500">închide</button>
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              {selected.category} ·{' '}
              {OUTCOME_LABEL[selected.status_label] ?? selected.status_label}
              {selected.neighborhood ? ` · ${selected.neighborhood}` : ''}
              {' · '}
              {new Date(selected.created_at).toLocaleDateString('ro-RO')}
            </p>
            <p className="mt-2 max-h-40 overflow-y-auto text-xs leading-relaxed whitespace-pre-line">
              {selected.description ?? '(fără descriere)'}
            </p>
            {selected.resolve_reason && (
              <div className="mt-2 border-l-2 border-neutral-300 pl-2 dark:border-neutral-700">
                <span className="text-[11px] font-medium text-neutral-500">Răspuns oficial</span>
                <p className="max-h-32 overflow-y-auto text-xs leading-relaxed whitespace-pre-line">
                  {selected.resolve_reason}
                </p>
              </div>
            )}
            <a href={`https://mycluj.e-primariaclujnapoca.ro/?c=${selected.ticket_number}`}
              target="_blank" rel="noreferrer"
              className="mt-2 inline-block text-xs underline underline-offset-2">
              Vezi pe platforma oficială
            </a>
          </div>
        )}
      </aside>

      <div ref={mapNode} className="h-full min-h-[50dvh] w-full flex-1" />
    </div>
  );
}
