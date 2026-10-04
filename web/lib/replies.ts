import { query } from '@/lib/db';

/**
 * What the city's replies actually say.
 *
 * Status labels are the city's own verdict on itself: about 95% of closed
 * reports are labelled "Favorabil". The reply text is the evidence behind that
 * label, and this module reads it in two ways.
 *
 *   Templates. A reply is reduced to a key -- lowercased, diacritics folded,
 *   the "Trimis Raspuns" prefix, a leading "Bună ziua" and trailing sign-offs
 *   ("Vă mulțumim", "Cu stimă"...) dropped, everything that is not a letter
 *   removed, first 200 letters kept. Two replies share a key when they say the
 *   same thing apart from numbers, dates, punctuation and courtesy formulas.
 *   200 letters, not fewer: many replies open with ~110 letters of identical
 *   preamble ("Referitor la sesizarea dumneavoastră înregistrată...") and only
 *   then say something specific, so a shorter key merged replies that differ.
 *   A key sent at least TEMPLATE_MIN times in the window is a template.
 *
 *   Favorabil without a stated fix. A reply labelled Favorabil that is empty,
 *   the one-liner "Soluționat prin dispecerat", or says only that the report was
 *   forwarded or that something will be looked at later -- and contains none of
 *   the phrases that report an intervention or a sanction.
 *
 * The second is a keyword rule and therefore an estimate. Hand-checked on 92
 * random cases (2026-10-04) it was right in 84; the misses ran both ways. It
 * is a lower bound: replies that merely explain, or say an operator "was
 * warned", fall outside both lists and are counted as if they claimed a fix.
 * The method notes on the page say so; keep them in step with these patterns.
 */

export const TEMPLATE_MIN = 10;

/**
 * The reply, lowercased with Romanian diacritics folded and whitespace
 * collapsed. Upstream stores line breaks as the literal characters "\r\n",
 * which are turned into spaces first; otherwise they leave a stray "rn" in the
 * text. The two translate() lists must stay the same length, character for
 * character -- a misaligned pair once folded ș to "i" and ț to "s", and every
 * keyword containing them silently stopped matching.
 */
export const REPLY_TEXT = (col = 't.resolve_reason') =>
  `regexp_replace(translate(lower(regexp_replace(coalesce(${col}, ''), '\\\\[rnt]', ' ', 'g')), 'ăâîșțşţ', 'aaistst'), '\\s+', ' ', 'g')`;

const SIGNOFF_RX = '(vamultumim|multumim|multumesc|pentruintelegere|pentrusesizare|pentruimplicare|pentruinteresulacordat|custima|cudeosebitaconsideratie|ozibuna|ozifrumoasa|totbinele)+$';

/** Template key over the folded text produced by REPLY_TEXT. */
export const TEMPLATE_KEY = (folded: string) =>
  `left(regexp_replace(regexp_replace(regexp_replace(regexp_replace(${folded},
     '^\\s*trimis raspuns\\s*', ''), '[^a-z]+', '', 'g'), '^(bunaziua|buna|ziua)+', ''), '${SIGNOFF_RX}', ''), 200)`;

/** Phrases that report an intervention, a repair or a sanction. */
const FIX_RX = [
  'au intervenit', 's-a intervenit', 'a intervenit', 'au remediat', 'a remediat',
  'a fost (remediat|reparat|igienizat|ridicat|montat|inlocuit|curatat|toaletat|taiat|completat|rezolvat|sanctionat|refacut|asfaltat|reimprospatat|salubrizat|repus)',
  'au fost (remediate|reparate|igienizate|ridicate|montate|inlocuite|curatate|toaletate|taiate|completate|rezolvate|refacute|reimprospatate|aplicate|sanctionati|sanctionate)',
  's-a (remediat|reparat|igienizat|ridicat|montat|inlocuit|curatat|toaletat|efectuat|rezolvat|refacut|aplicat|salubrizat)',
  's-au (efectuat|montat|ridicat|aplicat)', 'repus[ae]? in functiune', 'amenda', 'sanctiun',
  'proces(ul)?[- ]verbal', 'note de constatare', 'au luat masurile', 'a dispus masuri', 'a salubrizat', 'au salubrizat',
].join('|');

/** Phrases that pass the report on or put it off. */
const DEFERRED_RX = [
  's-a transmis', 'a fost transmis', 'au fost transmise', 's-a redirectionat',
  'transmis[ae]? (catre|operatorului|la|firmei|societatii|spre)', 's-a inaintat', 'a fost inaintat',
  'comunicat[ae]? (operatorului|catre|firmei)', 'vom studia', 'se va studia', 'se vor efectua', 'urmand a fi',
  'vor fi (intreprinse|efectuate|remediate)', 'va fi (remediat|analizat|verificat)', 'vom analiza', 'se va analiza',
  'in atentia', 'a fost preluat[ae]?', 'a fost inregistrat[ae]? si',
].join('|');

/**
 * Classifies a Favorabil reply from its folded text. Returns one of
 * 'empty' | 'dispecerat' | 'deferred' | 'other'; the first three are
 * "no stated fix".
 */
export const NOFIX_KIND = (folded: string) => `case
  when trim(${folded}) = '' then 'empty'
  when ${folded} ~ 'solutionat prin dispecerat' and length(${folded}) < 60 then 'dispecerat'
  when ${folded} !~ '(${FIX_RX})' and ${folded} ~ '(${DEFERRED_RX})' then 'deferred'
  else 'other' end`;

export interface Template {
  n: number;
  /** The status label this reply was most often attached to. */
  label: string;
  /** One full example, whitespace collapsed. */
  text: string;
  tickets: string[];
}

export interface NofixExample { kind: 'empty' | 'dispecerat' | 'deferred'; ticket: string; text: string; category_id: number }

export interface RecurringPlace {
  n: number; n_favorabil: number; years: number; n_open: number;
  category_id: number; neighborhood: string | null; first: string; last: string; ticket: string | null;
}

export interface OldOpen { ticket: string; filed: string; category_id: number; neighborhood: string | null; label: string }

export interface Findings {
  closed: number;
  templated: number;
  templates: number;
  top: Template[];
  favorabil: number;
  nofix: { deferred: number; empty: number; dispecerat: number };
  examples: NofixExample[];
  /** Infrastructure places reported in 3+ distinct years and closed Favorabil 3+ times. */
  recurring: { places: number; reports: number; top: RecurringPlace[] };
  open: { total: number; d90: number; y1: number; oldest: OldOpen[] };
}

/**
 * Everything the findings sections need, in one round trip: the dashboard
 * already fans out a dozen queries against a pool of four, and each extra
 * query is another waiter (see getDailyBreakdown).
 */
export async function getFindings(weeks: number): Promise<Findings> {
  const folded = REPLY_TEXT('t.resolve_reason');
  const [row] = await query<{ f: Findings }>(
    `with anchor as (
       select max((created_at at time zone 'Europe/Bucharest')::date) as today from public.tickets
     ),
     w as (
       select t.ticket_number, t.status_code, t.status_label, t.category_id, t.created_at,
              regexp_replace(t.resolve_reason, '\\s+', ' ', 'g') as reply,
              ${folded} as f
       from public.tickets t, anchor a
       where t.created_at >= ((a.today - ${weeks * 7 - 1})::timestamp at time zone 'Europe/Bucharest')
     ),
     c as (select *, ${TEMPLATE_KEY('f')} as k from w where status_code = 'C'),
     keys as (select k, count(*)::int as n from c where k <> '' group by k),
     fav as (select *, ${NOFIX_KIND('f')} as kind from w where status_label = 'Favorabil'),
     top as (
       select keys.n,
              (select mode() within group (order by c2.status_label) from c c2 where c2.k = keys.k) as label,
              (select c2.reply from c c2 where c2.k = keys.k order by c2.created_at desc limit 1) as text,
              (select array_agg(ticket_number) from (select c2.ticket_number from c c2 where c2.k = keys.k
                                                      order by c2.created_at desc limit 3) s) as tickets
       from keys where keys.n >= ${TEMPLATE_MIN} order by keys.n desc limit 8
     ),
     ex as (
       select distinct on (kind) kind, ticket_number as ticket, coalesce(reply, '') as text, category_id
       from fav where kind <> 'other' order by kind, created_at desc
     ),
     rec as (
       select r.n, r.n_favorabil, r.years_spanned as years, r.n_open, r.category_id, r.neighborhood,
              (r.first_at at time zone 'Europe/Bucharest')::date::text as first,
              (r.last_at at time zone 'Europe/Bucharest')::date::text as last,
              r.recent_tickets[1] as ticket
       from public.recurrence_clusters r join public.categories cat on cat.id = r.category_id
       where cat.recurrence_meaning = 'infrastructura' and r.years_spanned >= 3 and r.n_favorabil >= 3
     ),
     op as (select ticket_number, created_at, category_id, neighborhood, status_label
            from public.tickets where status_code = 'O')
     select json_build_object(
       'closed', (select count(*) from c),
       'templated', (select coalesce(sum(n), 0) from keys where n >= ${TEMPLATE_MIN}),
       'templates', (select count(*) from keys where n >= ${TEMPLATE_MIN}),
       'top', (select coalesce(json_agg(top), '[]') from top),
       'favorabil', (select count(*) from fav),
       'nofix', json_build_object(
          'deferred', (select count(*) from fav where kind = 'deferred'),
          'empty', (select count(*) from fav where kind = 'empty'),
          'dispecerat', (select count(*) from fav where kind = 'dispecerat')),
       'examples', (select coalesce(json_agg(ex), '[]') from ex),
       'recurring', json_build_object(
          'places', (select count(*) from rec),
          'reports', (select coalesce(sum(n), 0) from rec),
          'top', (select coalesce(json_agg(x), '[]') from (select * from rec order by n_favorabil desc, n desc limit 5) x)),
       'open', json_build_object(
          'total', (select count(*) from op),
          'd90', (select count(*) from op where created_at < now() - interval '90 days'),
          'y1', (select count(*) from op where created_at < now() - interval '365 days'),
          'oldest', (select coalesce(json_agg(o), '[]') from (
             select ticket_number as ticket, (created_at at time zone 'Europe/Bucharest')::date::text as filed,
                    category_id, neighborhood, status_label as label
             from op order by created_at limit 5) o))
     ) as f`,
  );
  return row!.f;
}
