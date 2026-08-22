import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { buildWhere, parseFilters } from '@/lib/filters';

/**
 * Map data for the current viewport.
 *
 * 208k points cannot be shipped to the browser, so the server aggregates onto a
 * grid whose precision follows the zoom level, and only returns individual
 * tickets once the selection is small enough to draw. The client therefore
 * transfers kilobytes at city scale and full detail at street scale.
 */

export const runtime = 'nodejs';

/** Decimal places to round coordinates to, by zoom. 3dp ~ 110 m, 4dp ~ 11 m. */
function precisionFor(zoom: number): number {
  if (zoom >= 17) return 5;
  if (zoom >= 15) return 4;
  if (zoom >= 13) return 3;
  if (zoom >= 11) return 2;
  return 2;
}

const POINT_LIMIT = 3000;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const sp = req.nextUrl.searchParams;
  const filters = parseFilters(sp);
  const zoom = Math.min(20, Math.max(0, Number(sp.get('z') ?? 12)));
  const { clause, params } = buildWhere(filters, { spatial: true });

  const [{ n }] = await query<{ n: string }>(
    `select count(*)::text n from public.tickets t where ${clause}`,
    params,
  );
  const total = Number(n);

  // Small enough to draw individually: send real tickets.
  if (total <= POINT_LIMIT) {
    const points = await query<Record<string, unknown>>(
      `select t.ticket_number, t.lat, t.lon, t.category_id, t.status_code,
              t.status_label, t.created_at, t.neighborhood,
              left(coalesce(t.description,''), 160) as excerpt
       from public.tickets t where ${clause}
       order by t.created_at desc limit ${POINT_LIMIT}`,
      params,
    );
    return NextResponse.json({ mode: 'points', total, points });
  }

  // Otherwise aggregate onto a grid sized for the current zoom.
  const p = precisionFor(zoom);
  const cells = await query<Record<string, unknown>>(
    `select round(t.lat::numeric, ${p})::float8 lat,
            round(t.lon::numeric, ${p})::float8 lon,
            count(*)::int n,
            mode() within group (order by t.category_id) top_category,
            round(100.0 * count(*) filter (where t.status_label = 'Favorabil') / count(*))::int pct_favorabil
     from public.tickets t where ${clause}
     group by 1, 2 order by n desc limit 6000`,
    params,
  );
  return NextResponse.json({ mode: 'cells', total, precision: p, cells });
}
