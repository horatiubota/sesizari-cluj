-- Full-text search over the official response.
--
-- Until now "caută în text" searched only public.tickets.description -- what the
-- citizen wrote. The response is where the council says what it did, and on a
-- site about how reports are closed that is the more accountable half of the
-- record: "every report closed with «solutionat prin dispecerat»" was not a
-- question the site could answer.
--
-- A separate index rather than one over both columns concatenated. Searching the
-- report text alone stays the default and must keep hitting the existing index,
-- and a combined expression index would not serve it -- so a single index would
-- have meant keeping the old one anyway and paying for a third. With two, the
-- "ambele" case is `desc @@ q or reply @@ q`, which the planner answers with a
-- BitmapOr across both.
--
-- Cost, measured before writing this: resolve_reason holds 71 MB of text against
-- description's 60 MB, and idx_tickets_fts over description is 36 MB, so expect
-- roughly 42 MB. That takes the database from 292 MB to about 334 MB of the
-- 500 MB tier -- around 1.4 years of the project's ~30 MB/year growth, spent
-- once. Check the real figure after building it; the estimate is proportional,
-- not measured.
--
-- NOT OPTIONAL. Without it the reply search is a sequential scan that recomputes
-- to_tsvector for 212k rows: 15.9 s for replies alone and 52.5 s for "ambele",
-- against the 30 s cap in web/vercel.json. Apply this before deploying the UI.
--
-- RUN IN THE SUPABASE SQL EDITOR.

-- The expression must match web/lib/filters.ts exactly or the index is not used.
--
-- CONCURRENTLY so the build does not take a write lock on public.tickets: the
-- sync job writes to this table on a schedule and must not be blocked behind an
-- index build. It cannot run inside a transaction block, so run this statement
-- on its own.
create index concurrently if not exists idx_tickets_fts_reply on public.tickets
  using gin (to_tsvector('romanian', coalesce(resolve_reason, '')));

analyze public.tickets;

-- ---------------------------------------------------------------------------
-- Verify: the index exists, and both searches use one.
-- ---------------------------------------------------------------------------
select indexrelname as index, pg_size_pretty(pg_relation_size(indexrelid)) as size
from pg_stat_user_indexes
where relname = 'tickets' and indexrelname like 'idx_tickets_fts%'
order by indexrelname;

explain (analyze, buffers)
select count(*) from public.tickets
where to_tsvector('romanian', coalesce(resolve_reason, ''))
      @@ plainto_tsquery('romanian', 'dispecerat');
