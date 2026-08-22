import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

/** Full detail for one ticket, fetched on click so the map payload stays lean. */
export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  if (!/^CAS-\d{4,10}$/.test(id)) {
    return NextResponse.json({ error: 'invalid ticket number' }, { status: 400 });
  }
  const rows = await query<Record<string, unknown>>(
    `select t.ticket_number, t.description, t.resolve_reason, t.status_code, t.status_label,
            t.created_at, t.neighborhood, t.lat, t.lon, c.name as category
     from public.tickets t join public.categories c on c.id = t.category_id
     where t.ticket_number = $1`,
    [id],
  );
  if (!rows.length) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(rows[0], {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  });
}
