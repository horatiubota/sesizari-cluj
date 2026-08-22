-- Corpus-wide word frequencies, used as the baseline for "what is distinctive
-- about this selection".
--
-- Raw frequency alone is useless: every area's top words are "strada", "va rog",
-- "buna ziua". Comparing a selection against this baseline surfaces what makes
-- an area unusual instead of what makes it Romanian.
--
-- Deliberately not tsvector/ts_stat: ts_stat takes its input as a query *string*,
-- which cannot be parameterised safely against user-supplied filters.

create table if not exists public.stopwords (word text primary key);

insert into public.stopwords (word) values
  ('acest'),('acesta'),('aceasta'),('acestea'),('acestui'),('acum'),('adica'),('afara'),
  ('alta'),('altul'),('anul'),('apoi'),('asta'),('astfel'),('asupra'),('atat'),('atata'),
  ('avem'),('aveti'),('avut'),('buna'),('care'),('catre'),('cand'),('cateva'),('ceea'),
  ('chiar'),('cine'),('conform'),('cred'),('cumva'),('daca'),('deci'),('decat'),('deja'),
  ('desi'),('dintre'),('doar'),('domnule'),('doresc'),('dumneavoastra'),('dupa'),('este'),
  ('fara'),('face'),('facut'),('fost'),('foarte'),('iar'),('inca'),('intre'),('mai'),
  ('mult'),('multe'),('multumesc'),('multumim'),('nici'),('noastra'),('nostru'),('numai'),
  ('oras'),('orasul'),('pana'),('pentru'),('poate'),('prin'),('rog'),('sunt'),('sau'),
  ('spre'),('stimate'),('sesizare'),('sesizarea'),('toate'),('tot'),('unde'),('unei'),
  ('unor'),('vreau'),('ziua'),('zile'),('exista'),('trebuie'),('cum'),('ceva'),('mereu'),
  ('nimic'),('nimeni'),('care'),('deoarece'),('astazi'),('acolo'),('aici'),('vedere'),
  ('situatia'),('problema'),('rezolvat'),('rezolvare'),('masuri'),('primaria'),('primarie')
on conflict do nothing;

-- Normalise: lowercase, fold Romanian diacritics, keep letters only.
create or replace function public.normalise_words(txt text) returns text[]
language sql immutable as $$
  select array_remove(
    string_to_array(
      regexp_replace(
        translate(lower(coalesce(txt, '')),
                  'ăâîșțşţáàéèíìóòúù', 'aaiststaaeeiioouu'),
        '[^a-z]+', ' ', 'g'),
      ' '),
    '');
$$;

drop materialized view if exists public.term_baseline;
create materialized view public.term_baseline as
  select w.word, count(*)::bigint AS n
  from public.tickets t,
       lateral unnest(public.normalise_words(t.description)) AS w(word)
  where t.description is not null
    and length(w.word) >= 4
    and not exists (select 1 from public.stopwords s where s.word = w.word)
  group by 1
  having count(*) >= 20;

create unique index if not exists idx_term_baseline_word on public.term_baseline(word);
analyze public.term_baseline;
