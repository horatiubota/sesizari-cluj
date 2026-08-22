import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { buildWhere, parseFilters } from '@/lib/filters';

/**
 * What is distinctive about this selection?
 *
 * Raw word counts are useless here: every area's top terms are "strada", "zona",
 * "masini". This scores each term by how much more often it appears in the
 * selection than in the corpus as a whole, so it surfaces what makes an area
 * unusual rather than what makes it Romanian.
 *
 * Terms absent from the baseline are excluded: a word appearing three times in
 * one bounding box has an enormous ratio and means nothing.
 *
 * Proper nouns are filtered by capitalisation rather than by a street gazetteer.
 * Ranking by concentration alone returns street names -- "Rozmarinului" really is
 * 35x over-represented in Borhanci -- but an OSM gazetteer also swallows copii,
 * deșeuri, groapă and abandonat. Capitalisation separates them cleanly:
 * street names run 79-92%, topic words 1-28%.
 */

export const runtime = 'nodejs';

/**
 * Tokenising descriptions is the most expensive query in the app: it splits,
 * unnests and groups every word in the sample. At 20,000 rows that was ~900k
 * words per request, fired on every map pan, which exhausted the database's
 * shared CPU. Term *ratios* converge long before that -- a few thousand
 * descriptions give the same ranking for a fraction of the work.
 */
const SAMPLE_LIMIT = 2_500;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const filters = parseFilters(req.nextUrl.searchParams);
  const { clause, params } = buildWhere(filters, { spatial: true });

  const rows = await query<{ word: string; n: number; ratio: number }>(
    `with sel as (
       select t.description from public.tickets t
       where ${clause} and t.description is not null
       limit ${SAMPLE_LIMIT}
     ),
     words as (
       select translate(lower(tok), 'ăâîșțşţ', 'aaiststt') as word
       from sel, lateral unnest(string_to_array(
         regexp_replace(sel.description, '[^A-Za-zĂÂÎȘȚăâîșțŞşŢţ]+', ' ', 'g'), ' ')) tok
       where length(tok) >= 4
     ),
     counts as (select word, count(*)::int n from words group by 1),
     sel_total as (select greatest(sum(n), 1)::float8 s from counts),
     base_total as (select sum(n)::float8 s from public.term_baseline)
     select c.word, c.n,
            ((c.n / (select s from sel_total)) / (b.n / (select s from base_total)))::float8 ratio
     from counts c
     join public.term_baseline b on b.word = c.word
     where c.n >= 5
       and b.pct_caps < 60      -- topic word, not a street or person
       and b.n_cartiere >= 10   -- used city-wide, so concentration is meaningful
     order by ratio desc, c.n desc
     limit 30`,
    params,
  );

  return NextResponse.json(
    { terms: rows },
    // Panning revisits the same viewports constantly; let the edge absorb that.
    { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' } },
  );
}
