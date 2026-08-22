-- Add neighbourhood breadth to the term baseline.
--
-- The first version ranked purely by concentration, which surfaced street names:
-- "Rozmarinului" is genuinely 35x over-represented in Borhanci because that is
-- where the street is. Distinctive, but useless as a topic.
--
-- A topic word ("ambrozie", "tomberoane") appears across the whole city and
-- merely concentrates in some areas. A proper noun appears in one. Recording how
-- many cartiere each term appears in lets the query demand breadth, so ranking
-- returns subjects rather than place names.

drop materialized view if exists public.term_baseline;
create materialized view public.term_baseline as
  select w.word,
         count(*)::bigint as n,
         count(distinct t.neighborhood)::int as n_cartiere
  from public.tickets t,
       lateral unnest(public.normalise_words(t.description)) as w(word)
  where t.description is not null
    and length(w.word) >= 4
    and not exists (select 1 from public.stopwords s where s.word = w.word)
  group by 1
  having count(*) >= 20;

create unique index if not exists idx_term_baseline_word on public.term_baseline(word);
create index if not exists idx_term_baseline_breadth on public.term_baseline(n_cartiere);
analyze public.term_baseline;
