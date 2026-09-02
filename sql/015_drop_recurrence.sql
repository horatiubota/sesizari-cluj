-- Drop the recurrence cluster view.
--
-- The /recurente page and /api/recurrence were removed; nothing reads
-- public.recurrence_clusters any more. The view was a materialised aggregate of
-- public.tickets, so dropping it destroys no source data and it can be rebuilt
-- at any time by re-running sql/009_recurrence.sql.
--
-- Written as a forward migration rather than by deleting 009 and 010: removing
-- those files would not drop anything from a database that has already run them,
-- and it would leave sql/011 and sql/012 -- one-off maintenance scripts that
-- refresh this view -- referring to an object with no definition anywhere in the
-- repo. Those two are left as they are, being a record of operations already
-- performed.
--
-- RUN IN THE SUPABASE SQL EDITOR.

-- ---------------------------------------------------------------------------
-- The view, its indexes go with it.
-- ---------------------------------------------------------------------------
drop materialized view if exists public.recurrence_clusters;

-- ---------------------------------------------------------------------------
-- public.categories.recurrence_meaning is DELIBERATELY KEPT.
--
-- It is category metadata rather than part of the recurrence page: the
-- watchlist (/urmarite, sql-free) reads it to decide how to describe a new
-- report filed at the same spot as one being watched. For an infrastructure
-- category a repeat means the repair did not hold; for a behaviour category it
-- is simply a new incident, and saying otherwise would state something the data
-- does not support. Dropping the column would silently flatten that back into a
-- single misleading phrasing.
--
-- If the watchlist is ever removed too, this is the statement to run:
--   alter table public.categories drop column if exists recurrence_meaning;
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Verify: the view is gone, the column remains.
-- ---------------------------------------------------------------------------
select
  (select count(*) from pg_matviews
    where schemaname = 'public' and matviewname = 'recurrence_clusters') as view_rows_expected_0,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'categories'
      and column_name = 'recurrence_meaning')                            as column_rows_expected_1;
