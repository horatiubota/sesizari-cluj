import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * Recurring problems: the same category reported repeatedly within ~11 m.
 *
 * Defaults to infrastructure categories. Raw ranking is dominated by illegal
 * parking (538 reports at one spot over 8 years), but a car parked illegally
 * again is a new event, not a repair that failed -- so the largest numbers are
 * the weakest evidence. `meaning` lets the caller ask for the categories where
 * repetition actually says something about the fix.
 */

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const sp = req.nextUrl.searchParams;
  const meaning = ['infrastructura', 'comportament', 'mixt', 'toate'].includes(sp.get('meaning') ?? '')
    ? sp.get('meaning')!
    : 'infrastructura';
  const minYears = Math.min(9, Math.max(1, Number(sp.get('ani') ?? 3)));
  const minCount = Math.min(100, Math.max(5, Number(sp.get('min') ?? 5)));
  const cartier = sp.get('cartier')?.slice(0, 60) || null;
  const limit = Math.min(200, Math.max(1, Number(sp.get('limit') ?? 50)));

  const params: unknown[] = [minYears, minCount];
  let extra = '';
  if (meaning !== 'toate') {
    params.push(meaning);
    extra += ` and cat.recurrence_meaning = $${params.length}`;
  }
  if (cartier) {
    params.push(cartier);
    extra += ` and rc.neighborhood = $${params.length}`;
  }

  const clusters = await query(
    `select rc.cluster_id, rc.lat, rc.lon, rc.n, rc.years_spanned,
            rc.pct_favorabil, rc.n_open, rc.neighborhood, rc.recent_tickets,
            rc.first_at, rc.last_at,
            cat.name as category, cat.id as category_id, cat.recurrence_meaning
     from public.recurrence_clusters rc
     join public.categories cat on cat.id = rc.category_id
     where rc.years_spanned >= $1 and rc.n >= $2 ${extra}
     order by rc.n desc, rc.years_spanned desc
     limit ${limit}`,
    params,
  );

  return NextResponse.json({ meaning, minYears, minCount, clusters });
}
