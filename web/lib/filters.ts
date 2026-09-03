/**
 * Shared filter parsing for every data endpoint.
 *
 * Values are turned into parameterised SQL fragments, never interpolated.
 * `is_default_pin = false` is applied to every spatial query as a matter of
 * course: 2,499 tickets share a handful of sentinel coordinates from the
 * upstream form's pre-placed marker and would fabricate hotspots.
 */

/**
 * Which text the free-text query runs against.
 *
 * Kept explicit rather than always searching both: the two answer different
 * questions. "groapă" over reports finds people asking about a pothole; over
 * responses it finds the council saying one was patched. Widening the default
 * silently would change what every existing result count means.
 */
export type QScope = 'sesizari' | 'raspunsuri' | 'ambele';

const Q_SCOPES: QScope[] = ['sesizari', 'raspunsuri', 'ambele'];

export interface Filters {
  categories: number[];
  status: string | null;      // 'O' | 'C' | null
  outcome: string | null;     // status_label, e.g. 'Favorabil'
  from: string | null;        // YYYY-MM-DD
  to: string | null;
  neighborhood: string | null;
  q: string | null;           // full-text query
  qScope: QScope;             // and which column it runs against
  bbox: [number, number, number, number] | null; // [minLon, minLat, maxLon, maxLat]
}

export function parseFilters(sp: URLSearchParams): Filters {
  const nums = (v: string | null): number[] =>
    (v ?? '').split(',').map((x) => Number(x)).filter((n) => Number.isInteger(n) && n >= 1 && n <= 16);

  const bboxRaw = (sp.get('bbox') ?? '').split(',').map(Number);
  const bbox =
    bboxRaw.length === 4 && bboxRaw.every((n) => Number.isFinite(n))
      ? ([bboxRaw[0]!, bboxRaw[1]!, bboxRaw[2]!, bboxRaw[3]!] as [number, number, number, number])
      : null;

  const iso = (v: string | null): string | null => (/^\d{4}-\d{2}-\d{2}$/.test(v ?? '') ? v : null);

  return {
    categories: nums(sp.get('cat')),
    status: ['O', 'C'].includes(sp.get('status') ?? '') ? sp.get('status') : null,
    outcome: sp.get('outcome')?.slice(0, 40) || null,
    from: iso(sp.get('from')),
    to: iso(sp.get('to')),
    neighborhood: sp.get('cartier')?.slice(0, 60) || null,
    q: sp.get('q')?.trim().slice(0, 120) || null,
    // Anything unrecognised falls back to the report text, which is what the
    // box meant before this parameter existed.
    qScope: Q_SCOPES.includes(sp.get('qin') as QScope) ? (sp.get('qin') as QScope) : 'sesizari',
    bbox,
  };
}

export interface SqlWhere {
  clause: string;
  params: unknown[];
}

/** Build a WHERE clause. `spatial` also excludes sentinel-coordinate tickets. */
export function buildWhere(f: Filters, opts: { spatial?: boolean } = {}): SqlWhere {
  const parts: string[] = ['1=1'];
  const params: unknown[] = [];
  const add = (sql: string, ...v: unknown[]): void => {
    params.push(...v);
    parts.push(sql);
  };

  if (opts.spatial) parts.push('t.is_default_pin = false', 't.lat is not null');
  if (f.categories.length) add(`t.category_id = any($${params.length + 1}::int[])`, f.categories);
  if (f.status) add(`t.status_code = $${params.length + 1}`, f.status);
  if (f.outcome) add(`t.status_label = $${params.length + 1}`, f.outcome);
  // Day boundaries are Europe/Bucharest, not the session's UTC. Upstream stamps
  // are local wall-clock, so a bare ::date comparison starts the day at 03:00
  // local and moves three hours of evening reports into the next day -- 68 vs 66
  // tickets on a sample day, and systematically wrong at both ends of a range.
  if (f.from)
    add(`t.created_at >= ($${params.length + 1}::date::timestamp at time zone 'Europe/Bucharest')`, f.from);
  if (f.to)
    add(`t.created_at < (($${params.length + 1}::date + 1)::timestamp at time zone 'Europe/Bucharest')`, f.to);
  if (f.neighborhood) add(`t.neighborhood = $${params.length + 1}`, f.neighborhood);
  if (f.q) {
    // One parameter referenced twice, so `add` (which appends a placeholder per
    // value) does not fit. The expressions must stay byte-identical to the two
    // indexes in sql/001_schema.sql and sql/016_reply_fts.sql, or neither is
    // used and the query becomes a 16-52 second sequential scan.
    params.push(f.q);
    const n = params.length;
    const inReport = `to_tsvector('romanian', coalesce(t.description,'')) @@ plainto_tsquery('romanian', $${n})`;
    const inReply = `to_tsvector('romanian', coalesce(t.resolve_reason,'')) @@ plainto_tsquery('romanian', $${n})`;
    parts.push(
      f.qScope === 'raspunsuri' ? inReply
        : f.qScope === 'ambele' ? `(${inReport} or ${inReply})`
          : inReport,
    );
  }
  if (f.bbox) {
    const [minLon, minLat, maxLon, maxLat] = f.bbox;
    add(
      `t.lon between $${params.length + 1} and $${params.length + 2} and t.lat between $${params.length + 3} and $${params.length + 4}`,
      minLon, maxLon, minLat, maxLat,
    );
  }
  return { clause: parts.join(' and '), params };
}
