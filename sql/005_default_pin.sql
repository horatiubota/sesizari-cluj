-- Flag tickets whose coordinates are a map default rather than a chosen place.
--
-- The MyCluj form pre-places a marker; users who never move it all submit the
-- identical coordinate. 1,910 tickets sit on 46.769694,23.589654 alone, spanning
-- 15 of 16 categories. Left unflagged these fabricate hotspots: that one cell
-- outranked every real location in the city across unrelated categories.
--
-- Rule: >= 20 tickets at an identical 6-decimal coordinate (~0.1 m) spanning
-- >= 5 distinct categories. Independent users cannot cluster that tightly across
-- unrelated complaint types; 201,402 coordinates in the corpus are used exactly
-- once, so genuine pins look nothing like this.
--
-- The tickets stay -- they are valid complaints -- but they are excluded from
-- every spatial analysis.

alter table public.tickets
  add column if not exists is_default_pin boolean not null default false;

create or replace function public.refresh_default_pins() returns integer
language plpgsql as $$
declare
  affected integer;
begin
  with sentinel as (
    select lat, lon
    from public.tickets
    where lat is not null and lon is not null
    group by lat, lon
    having count(*) >= 20 and count(distinct category_id) >= 5
  )
  update public.tickets t
  set is_default_pin = (s.lat is not null)
  from (select lat, lon from sentinel) s
  where t.lat = s.lat and t.lon = s.lon and t.is_default_pin is distinct from true;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

select public.refresh_default_pins();

create index if not exists idx_tickets_located
  on public.tickets (category_id, created_at desc)
  where is_default_pin = false and lat is not null;
