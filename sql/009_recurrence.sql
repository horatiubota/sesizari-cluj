-- Recurring problems: the same category reported repeatedly at the same spot.
--
-- Grid resolution is 4 decimal places (~11 m). 3dp (~110 m) was tried first and
-- swept 156,785 tickets -- 75% of the corpus -- into "clusters", which in a dense
-- city means only that two complaints happened on the same block. At 11 m a
-- cluster is genuinely one streetlight, one pothole, one bin.
--
-- The point is not volume. It is that a problem reported for years, closed
-- favourably every time, was evidently never fixed. `pct_favorabil` alongside
-- `years_spanned` is what makes that measurable rather than rhetorical.

drop materialized view if exists public.recurrence_clusters;
create materialized view public.recurrence_clusters as
select
  row_number() over (order by count(*) desc)              as cluster_id,
  round(lat::numeric, 4)::float8                          as lat,
  round(lon::numeric, 4)::float8                          as lon,
  category_id,
  count(*)::int                                           as n,
  min(created_at)                                         as first_at,
  max(created_at)                                         as last_at,
  count(distinct extract(year from created_at))::int      as years_spanned,
  count(*) filter (where status_label = 'Favorabil')::int  as n_favorabil,
  round(100.0 * count(*) filter (where status_label = 'Favorabil') / count(*))::int as pct_favorabil,
  count(*) filter (where status_code = 'O')::int          as n_open,
  mode() within group (order by neighborhood)             as neighborhood,
  (array_agg(ticket_number order by created_at desc))[1:5] as recent_tickets
from public.tickets
where is_default_pin = false and lat is not null and lon is not null
group by round(lat::numeric, 4), round(lon::numeric, 4), category_id
having count(*) >= 5;

create unique index if not exists idx_recurrence_id on public.recurrence_clusters(cluster_id);
create index if not exists idx_recurrence_n on public.recurrence_clusters(n desc);
create index if not exists idx_recurrence_geo on public.recurrence_clusters(lat, lon);
create index if not exists idx_recurrence_cat on public.recurrence_clusters(category_id);
analyze public.recurrence_clusters;
