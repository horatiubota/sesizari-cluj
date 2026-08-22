-- Run these in the Supabase dashboard SQL Editor, one block at a time.
--
-- The editor wraps statements in a transaction, which is why VACUUM FULL failed
-- there with "25001: VACUUM cannot run inside a transaction block".
-- Everything in this file is transaction-safe.

-- ---------------------------------------------------------------------------
-- BLOCK 1 — reset the database password at the Postgres level.
--
-- Three dashboard resets produced passwords the connection pooler rejected with
-- 28P01, while this editor connects normally. Setting it here takes the
-- dashboard out of the loop so the value is known exactly. Choose your own and
-- keep it alphanumeric, which removes any percent-encoding question from the
-- connection string.
--
--   alter user postgres with password '<your-new-password>';
--
-- (Left commented deliberately: substitute a password you choose, do not run a
-- value that has been written down in a repository.)
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- BLOCK 2 — see how much space is recoverable and where it is.
-- ---------------------------------------------------------------------------
select
  n.nspname || '.' || c.relname                  as object,
  pg_size_pretty(pg_total_relation_size(c.oid))  as total,
  pg_size_pretty(pg_relation_size(c.oid))        as heap,
  pg_size_pretty(pg_indexes_size(c.oid))         as indexes,
  coalesce(s.n_dead_tup, 0)                      as dead_rows
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_stat_user_tables s on s.relid = c.oid
where n.nspname in ('public', 'private')
  and c.relkind in ('r', 'm')
order by pg_total_relation_size(c.oid) desc;


-- ---------------------------------------------------------------------------
-- BLOCK 3 — reclaim index bloat.
--
-- REINDEX TABLE is transaction-safe, unlike VACUUM FULL. public.tickets carried
-- roughly 84 MB of indexes, and index bloat tracks the ~200k row rewrites from
-- the enrichment passes.
-- ---------------------------------------------------------------------------
reindex table public.tickets;
reindex table public.ticket_events;
reindex table private.ticket_raw;


-- ---------------------------------------------------------------------------
-- BLOCK 4 — rebuild the materialised views.
--
-- term_baseline was rebuilt three times while the proper-noun filter was worked
-- out, and each rebuild abandons the previous copy. Refreshing writes a clean one.
-- ---------------------------------------------------------------------------
refresh materialized view public.term_baseline;
refresh materialized view public.recurrence_clusters;


-- ---------------------------------------------------------------------------
-- BLOCK 5 — reclaim heap bloat without VACUUM FULL.
--
-- An ALTER COLUMN with an explicit USING clause forces a full table rewrite,
-- which drops every dead row version, and unlike VACUUM FULL it runs inside a
-- transaction. This is what clears the ~200k dead versions left by the
-- neighbourhood assignment (199,278 rows), default-pin flagging (2,499) and the
-- closed_at repair (2,000).
--
-- Takes an ACCESS EXCLUSIVE lock for the duration. Nothing else should be
-- writing, so do not run it while a sync job is active.
-- ---------------------------------------------------------------------------
alter table public.tickets
  alter column lat type double precision using lat::double precision;


-- ---------------------------------------------------------------------------
-- BLOCK 6 — confirm the result. Target is comfortably under 0.5 GB;
-- the last clean measurement before the enrichment passes was 280 MB.
-- ---------------------------------------------------------------------------
select pg_size_pretty(pg_database_size(current_database())) as database_size;
