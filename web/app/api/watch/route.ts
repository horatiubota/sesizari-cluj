import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * What changed on a watchlist since each ticket was starred.
 *
 * POST, not GET, for two reasons: the list is the visitor's own and has no
 * business in a URL that Vercel logs and a CDN might key on, and a 200-entry
 * list overruns comfortable query-string length.
 *
 * The whole watchlist is answered by ONE query. The pool is `max: 4` across all
 * serverless invocations, so a per-ticket fetch would exhaust it the moment two
 * people opened the page with a few dozen tickets each.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Matches lib/watchlist.ts. Anything longer is a client bug or an abuse attempt. */
const CAP = 200;
const TICKET_RE = /^CAS-\d{4,10}$/;

/**
 * Half-width of the "same place" box, in degrees.
 *
 * "Same place" is a box of roughly 11 m a side, centred on the watched ticket.
 * A centred box rather than a rounded grid because a grid has edges: two reports
 * two metres apart can round into different cells and would never see each
 * other. 0.00005 lat is ~5.5 m; at Cluj's latitude 0.00007 lon is ~5.3 m.
 * Expressed as a range on the raw columns so idx_tickets_latlon still applies --
 * `round(lat,4) = round(lat,4)` would not use it.
 */
const LAT_EPS = 0.00005;
const LON_EPS = 0.00007;

interface Body {
  items?: { ticket?: unknown; starredAt?: unknown }[];
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  if (!Array.isArray(body.items)) {
    return NextResponse.json({ error: 'items must be an array' }, { status: 400 });
  }
  if (body.items.length > CAP) {
    return NextResponse.json({ error: `at most ${CAP} tickets` }, { status: 413 });
  }

  const tickets: string[] = [];
  const since: string[] = [];
  const seen = new Set<string>();
  for (const it of body.items) {
    const t = typeof it?.ticket === 'string' ? it.ticket : '';
    const s = typeof it?.starredAt === 'string' ? Date.parse(it.starredAt) : NaN;
    if (!TICKET_RE.test(t) || Number.isNaN(s) || seen.has(t)) continue;
    seen.add(t);
    tickets.push(t);
    since.push(new Date(s).toISOString());
  }

  if (!tickets.length) {
    return NextResponse.json({ rows: [] }, { headers: { 'Cache-Control': 'private, no-store' } });
  }

  // unnest pairs each ticket with its own baseline, so both laterals below can
  // filter on "after *this* ticket was starred" rather than one shared cutoff.
  const rows = await query<Record<string, unknown>>(
    `with watched as (
       select * from unnest($1::text[], $2::timestamptz[]) as w(ticket_number, starred_at)
     )
     select t.ticket_number, t.description, t.resolve_reason,
            t.status_code, t.status_label, t.created_at, t.closed_at,
            t.neighborhood, t.lat, t.lon, t.category_id,
            c.name as category, c.recurrence_meaning,
            w.starred_at,
            ev.events, fu.followups, fu.followup_count
     from watched w
     join public.tickets t on t.ticket_number = w.ticket_number
     join public.categories c on c.id = t.category_id
     left join lateral (
       -- Every transition observed since starring. The stored resolve_reason on
       -- an event is the text it SUPERSEDED (see sql/001_schema.sql), which is
       -- what makes a before/after of the official answer possible at all.
       --
       -- The earliest event of every ticket is its FIRST SIGHTING, not a change:
       -- the insert trigger appends one so the history starts somewhere. Left in,
       -- it reads as a transition, and an open ticket whose first sighting fell
       -- after the claimed baseline would be reported as "reopened". It is
       -- excluded by identity (the minimum) rather than by comparing timestamps,
       -- which is exact regardless of how close the two stamps are.
       select coalesce(json_agg(json_build_object(
                'observed_at',          e.observed_at,
                'status_code',          e.status_code,
                'status_label',         e.status_label,
                'previous_resolve_reason', e.resolve_reason
              ) order by e.observed_at), '[]'::json) as events
       from public.ticket_events e
       where e.ticket_number = t.ticket_number
         and e.observed_at > greatest(w.starred_at, t.first_seen_at)
         and e.observed_at > (
           select min(e2.observed_at) from public.ticket_events e2
           where e2.ticket_number = t.ticket_number
         )
     ) ev on true
     left join lateral (
       -- New reports at the same spot, same category, filed since starring.
       --
       -- count(*) over () is evaluated before LIMIT, so the total is the real
       -- number of follow-ups while only five are carried back for display.
       select coalesce(json_agg(json_build_object(
                'ticket_number', x.ticket_number,
                'created_at',    x.created_at,
                'status_label',  x.status_label,
                'description',   x.description
              ) order by x.created_at desc), '[]'::json) as followups,
              coalesce(max(x.total), 0)::int as followup_count
       from (
         select f.ticket_number, f.created_at, f.status_label,
                left(f.description, 200) as description,
                count(*) over () as total
         from public.tickets f
         -- A watched ticket sitting on the upstream form's pre-placed marker
         -- shares its coordinates with ~2,499 others, so "same place" is
         -- meaningless for it and the box would match unrelated reports across
         -- the whole city. Guard on the watched ticket, not only the candidate.
         where t.is_default_pin = false
           and f.is_default_pin = false
           and f.category_id = t.category_id
           and f.ticket_number <> t.ticket_number
           and f.created_at > greatest(w.starred_at, t.first_seen_at)
           and f.lat between t.lat - ${LAT_EPS} and t.lat + ${LAT_EPS}
           and f.lon between t.lon - ${LON_EPS} and t.lon + ${LON_EPS}
         order by f.created_at desc
         limit 5
       ) x
     ) fu on true`,
    [tickets, since],
  );

  return NextResponse.json(
    { rows, missing: tickets.filter((t) => !rows.some((r) => r.ticket_number === t)) },
    // Per-visitor by construction: never let a CDN or browser cache hold it.
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
