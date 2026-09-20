import { createHash, timingSafeEqual } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

/**
 * On-demand ISR revalidation, called by the sync workflow after each load.
 *
 * Both dashboard pages are statically rendered with a time-based `revalidate`,
 * and Next only regenerates those on request: on a low-traffic site the first
 * visitor after the window expires is served the stale copy and merely triggers
 * the rebuild for whoever comes next. That is how the dashboard came to advertise
 * a three-day-old date range while the database was current.
 *
 * Note what this route does and does not do: `revalidatePath` marks the pages
 * invalid, it does not render them. Calling it on a site with no traffic leaves
 * the old copy in place for the next visitor, which is exactly the failure above
 * and it recurred on 2026-09-20 with this route answering 200 every day. The
 * sync workflow therefore fetches both pages after calling this, so that the
 * rebuild happens in CI rather than in front of whoever arrives first.
 *
 * /harta is not listed: it is a client component whose data comes from
 * /api/map, which is cached by Cache-Control rather than by ISR.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PATHS = ['/', '/recurente'];

/**
 * Compares digests rather than the raw strings: timingSafeEqual throws on a
 * length mismatch, which would itself leak the secret's length.
 */
function secretMatches(offered: string, expected: string): boolean {
  const a = createHash('sha256').update(offered).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: Request): Promise<NextResponse> {
  const expected = process.env.REVALIDATE_SECRET;

  // Without a configured secret the route would be an open cache-buster, so it
  // refuses to run at all rather than falling back to accepting anything.
  if (!expected) {
    return NextResponse.json(
      { ok: false, problem: 'REVALIDATE_SECRET is not set in this environment' },
      { status: 503 },
    );
  }

  const offered = request.headers.get('x-revalidate-secret') ?? '';
  if (!offered || !secretMatches(offered, expected)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  for (const path of PATHS) revalidatePath(path);

  return NextResponse.json({ ok: true, revalidated: PATHS, at: new Date().toISOString() });
}
