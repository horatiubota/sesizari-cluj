-- Distinguish topic words from proper nouns by how often they appear capitalised.
--
-- Ranking purely by concentration surfaced street names: "Rozmarinului" really is
-- 35x over-represented in Borhanci, because that is where the street is.
--
-- An OSM street gazetteer was the obvious fix and the wrong one. 1,277 baseline
-- terms collide with Cluj place names, including copii, deșeuri, groapă,
-- biciclete, urgență, transport and abandonat -- suppressing those would gut the
-- feature to remove a handful of street names.
--
-- Capitalisation separates them cleanly and is derived from the corpus itself:
--   Decebal 92%   Mehedinți 88%   Mănăștur 84%   Frunzișului 87%
--   groapă  28%   deșeuri   11%   copii      3%  biciclete   1%
-- The gap is wide enough that a 60% threshold needs no tuning.

drop table if exists public.gazetteer;

drop materialized view if exists public.term_baseline;
create materialized view public.term_baseline as
with tokens as (
  select t.neighborhood,
         tok,
         translate(lower(tok), 'ăâîșțşţ', 'aaiststt') as word
  from public.tickets t,
       lateral unnest(string_to_array(
         regexp_replace(t.description, '[^A-Za-zĂÂÎȘȚăâîșțŞşŢţ]+', ' ', 'g'), ' ')) tok
  where t.description is not null and length(tok) >= 4
)
select word,
       count(*)::bigint as n,
       count(distinct neighborhood)::int as n_cartiere,
       round(100.0 * count(*) filter (where tok ~ '^[A-ZĂÂÎȘȚŞŢ]') / count(*))::int as pct_caps
from tokens
where not exists (select 1 from public.stopwords s where s.word = tokens.word)
group by 1
having count(*) >= 20;

create unique index if not exists idx_term_baseline_word on public.term_baseline(word);
create index if not exists idx_term_baseline_topic
  on public.term_baseline(pct_caps, n_cartiere);
analyze public.term_baseline;
