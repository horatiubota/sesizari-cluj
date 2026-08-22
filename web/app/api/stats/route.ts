import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { buildWhere, parseFilters } from '@/lib/filters';

/**
 * Dashboard aggregates for the current filter selection.
 *
 * Led by disposition mix rather than opened-vs-closed: 99% of tickets are
 * closed, so that ratio is a flat line. What varies -- and what the council's
 * headline number conceals -- is *how* they close.
 */

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const filters = parseFilters(req.nextUrl.searchParams);
  const { clause, params } = buildWhere(filters);

  const [totals] = await query<Record<string, string>>(
    `select count(*)::text as total,
            count(*) filter (where t.status_code = 'O')::text as open,
            count(*) filter (where t.status_label = 'Favorabil')::text as favorabil,
            count(*) filter (where t.status_label = 'Transferata operatorului')::text as transferat,
            count(*) filter (where t.status_label = 'Partial')::text as partial,
            count(*) filter (where t.status_label in ('Respinsa','Nefavorabil'))::text as respins
     from public.tickets t where ${clause}`,
    params,
  );

  const byMonth = await query(
    `select to_char(date_trunc('month', t.created_at at time zone 'Europe/Bucharest'), 'YYYY-MM') as month,
            count(*)::int as total,
            count(*) filter (where t.status_label = 'Favorabil')::int as favorabil,
            count(*) filter (where t.status_label = 'Transferata operatorului')::int as transferat
     from public.tickets t where ${clause} group by 1 order by 1`,
    params,
  );

  const byCategory = await query(
    `select c.id, c.name, count(*)::int as total,
            round(100.0 * count(*) filter (where t.status_label='Favorabil') / count(*))::int as pct_favorabil,
            round(100.0 * count(*) filter (where t.status_label='Transferata operatorului') / count(*))::int as pct_transferat
     from public.tickets t join public.categories c on c.id = t.category_id
     where ${clause} group by 1,2 order by 3 desc`,
    params,
  );

  const byNeighborhood = await query(
    `select coalesce(t.neighborhood, '(nemarcat)') as name, count(*)::int as total,
            round(100.0 * count(*) filter (where t.status_label='Favorabil') / count(*))::int as pct_favorabil
     from public.tickets t where ${clause} and t.is_default_pin = false
     group by 1 order by 2 desc`,
    params,
  );

  return NextResponse.json({
    totals: Object.fromEntries(Object.entries(totals ?? {}).map(([k, v]) => [k, Number(v)])),
    byMonth, byCategory, byNeighborhood,
  });
}
