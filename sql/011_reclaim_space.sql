-- Reclaim space after the enrichment passes.
--
-- RUN THIS IN THE SUPABASE DASHBOARD SQL EDITOR, one statement at a time.
-- VACUUM cannot run inside a transaction block, and it cannot run through the
-- connection pooler either.
--
-- Why the database grew from 280 MB to 520 MB without adding rows:
-- Postgres never updates a row in place. It writes a new version and leaves the
-- old one as a dead tuple until VACUUM FULL returns those pages to the operating
-- system. The enrichment passes rewrote nearly every row:
--   * neighbourhood assignment  199,278 rows updated
--   * default-pin flagging        2,499 rows updated
--   * closed_at repair            2,000 rows updated
-- plus term_baseline was rebuilt three times while the proper-noun filter was
-- being worked out, and each rebuild abandons the previous copy.
--
-- Autovacuum marks that space reusable but does not shrink the files, so the
-- size Supabase bills against stays high.

-- 1. See where the space actually is, before and after.
select
  n.nspname || '.' || c.relname                        as object,
  pg_size_pretty(pg_total_relation_size(c.oid))        as total,
  pg_size_pretty(pg_relation_size(c.oid))              as heap,
  pg_size_pretty(pg_indexes_size(c.oid))               as indexes,
  s.n_dead_tup                                         as dead_rows
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_stat_user_tables s on s.relid = c.oid
where n.nspname in ('public', 'private') and c.relkind in ('r', 'm')
order by pg_total_relation_size(c.oid) desc;

-- 2. The main reclaim. This is the one that matters: ~200k dead row versions.
vacuum (full, analyze) public.tickets;

-- 3. Smaller, but worth doing while you are here.
vacuum (full, analyze) public.ticket_events;
vacuum (full, analyze) private.ticket_raw;

-- 4. Materialised views accumulate their own dead space across rebuilds.
refresh materialized view public.term_baseline;
vacuum (full, analyze) public.term_baseline;
refresh materialized view public.recurrence_clusters;
vacuum (full, analyze) public.recurrence_clusters;

-- 5. Confirm the result.
select pg_size_pretty(pg_database_size(current_database())) as database_size;
