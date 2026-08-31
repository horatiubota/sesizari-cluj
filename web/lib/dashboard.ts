import { query } from '@/lib/db';

/**
 * Dashboard aggregates.
 *
 * Everything here is anchored to Europe/Bucharest calendar days. Upstream
 * timestamps are wall-clock Bucharest with no offset, and a UTC day boundary
 * would move ~3 hours of evening reports into the following day.
 *
 * Comparisons use rolling windows -- the last 7 and last 30 days -- rather than
 * calendar weeks. A rolling window is always complete, which removes the
 * partial-week problem that otherwise manufactures a decline every Monday.
 *
 * Note the anchor: the newest day *present in the data*, not the wall clock. The
 * sync job runs once a day, so between runs the calendar is ahead of the mirror.
 * Anchoring on now() would append an empty day to the current window and report
 * a fabricated drop every morning.
 *
 * The year-ago window sits 364 days back, not 365: a whole number of weeks, so
 * the comparison keeps weekday alignment. Reporting volume has a strong weekly
 * shape -- weekends run well below weekdays -- which a 365-day offset would
 * smear across the comparison.
 */

/** Newest day present in the data. Every window below is measured back from it. */
const ANCHOR = `
  anchor as (
    select max((created_at at time zone 'Europe/Bucharest')::date) as today
    from public.tickets
  )`;

/** Keeps a windowed scan to the span the windows actually cover. */
const SCAN = `t.created_at >= ((a.today - 400)::timestamp at time zone 'Europe/Bucharest')`;

/**
 * Outcome composition, in the same five buckets the dashboard legends. Shared so
 * that every panel showing outcomes counts them identically -- the split is not
 * obvious from the raw data ('Respinsa' and 'Nefavorabil' are one bucket, and an
 * open ticket has no label at all), and two panels disagreeing about it would be
 * read as a finding rather than as a typo.
 */
const OUTCOME_COUNTS = `
  count(*)::int                                                           as total,
  count(*) filter (where status_label = 'Favorabil')::int                 as favorabil,
  count(*) filter (where status_label = 'Partial')::int                   as partial,
  count(*) filter (where status_label = 'Transferata operatorului')::int  as transferat,
  count(*) filter (where status_label in ('Respinsa','Nefavorabil'))::int as respins,
  count(*) filter (where status_code = 'O')::int                          as deschise`;

/** Local day of a ticket, as a lateral so filters can reference it by name. */
const DAY = `lateral (select (t.created_at at time zone 'Europe/Bucharest')::date) as x(dd)`;

/** cur / prev / year-ago counters over a rolling window of `n` days. */
const buckets = (n: number): string => `
  count(*) filter (where dd > a.today - ${n}         and dd <= a.today)::int        as cur,
  count(*) filter (where dd > a.today - ${2 * n}     and dd <= a.today - ${n})::int as prev,
  count(*) filter (where dd > a.today - ${364 + n}   and dd <= a.today - 364)::int  as ly`;

export interface Overview {
  total: number; open: number; favorabil: number; partial: number;
  transferat: number; respins: number;
  first_day: string; last_day: string; last_day_count: number; last_seen: string;
}

export interface WindowCounts {
  cur: number; prev: number; ly: number;
  /** Inclusive bounds of the current window, for building map links. */
  from: string; to: string;
}
export interface RollingTotals { d7: WindowCounts; d30: WindowCounts }

export interface Breakdown { key: string; label: string; cur: number; prev: number; ly: number }
export interface DailyRow {
  day: string; total: number; favorabil: number; partial: number;
  transferat: number; respins: number; deschise: number;
}
export interface DailyCategoryRow { day: string; category_id: number; n: number }
export interface LatestTicket {
  ticket_number: string; category_id: number; status_label: string;
  created_at: string; neighborhood: string | null; description: string | null;
}
export interface MonthlyOutcomeRow {
  month: string; total: number; favorabil: number; partial: number;
  transferat: number; respins: number; deschise: number;
}

export async function getOverview(): Promise<Overview> {
  const [row] = await query<Overview>(
    `select count(*)::int as total,
            count(*) filter (where status_code = 'O')::int                          as open,
            count(*) filter (where status_label = 'Favorabil')::int                 as favorabil,
            count(*) filter (where status_label = 'Partial')::int                   as partial,
            count(*) filter (where status_label = 'Transferata operatorului')::int  as transferat,
            count(*) filter (where status_label in ('Respinsa','Nefavorabil'))::int as respins,
            min((created_at at time zone 'Europe/Bucharest')::date)::text           as first_day,
            max((created_at at time zone 'Europe/Bucharest')::date)::text           as last_day,
            count(*) filter (where (created_at at time zone 'Europe/Bucharest')::date
                                 = (select max((created_at at time zone 'Europe/Bucharest')::date)
                                    from public.tickets))::int                      as last_day_count,
            to_char(max(created_at at time zone 'Europe/Bucharest'),
                    'YYYY-MM-DD HH24:MI')                                           as last_seen
     from public.tickets`,
  );
  return row;
}

/** Totals for the 7- and 30-day windows in one pass over the recent span. */
export async function getRollingTotals(): Promise<RollingTotals> {
  const [row] = await query<Record<string, number | string>>(
    `with ${ANCHOR},
     d as (select (t.created_at at time zone 'Europe/Bucharest')::date as dd
           from public.tickets t, anchor a where ${SCAN})
     select
       (a.today - 6)::text  as d7_from,  (a.today - 29)::text as d30_from,
        a.today::text       as d_to,
       count(*) filter (where dd > a.today -   7 and dd <= a.today)::int        as d7_cur,
       count(*) filter (where dd > a.today -  14 and dd <= a.today -   7)::int  as d7_prev,
       count(*) filter (where dd > a.today - 371 and dd <= a.today - 364)::int  as d7_ly,
       count(*) filter (where dd > a.today -  30 and dd <= a.today)::int        as d30_cur,
       count(*) filter (where dd > a.today -  60 and dd <= a.today -  30)::int  as d30_prev,
       count(*) filter (where dd > a.today - 394 and dd <= a.today - 364)::int  as d30_ly
     from d, anchor a group by a.today`,
  );
  const n = (k: string): number => Number(row[k]);
  return {
    d7:  { cur: n('d7_cur'),  prev: n('d7_prev'),  ly: n('d7_ly'),
           from: String(row.d7_from),  to: String(row.d_to) },
    d30: { cur: n('d30_cur'), prev: n('d30_prev'), ly: n('d30_ly'),
           from: String(row.d30_from), to: String(row.d_to) },
  };
}

/** Per-category counts over the rolling 7-day window. */
export async function getByCategory(): Promise<Breakdown[]> {
  return query<Breakdown>(
    `with ${ANCHOR}
     select t.category_id::text as key, c.name as label, ${buckets(7)}
     from public.tickets t
       join public.categories c on c.id = t.category_id,
       anchor a, ${DAY}
     where ${SCAN}
     group by 1, 2 order by cur desc, label`,
  );
}

export async function getByNeighborhood(): Promise<Breakdown[]> {
  return query<Breakdown>(
    `with ${ANCHOR}
     select coalesce(t.neighborhood, '(nelocalizat)') as key,
            coalesce(t.neighborhood, '(nelocalizat)') as label, ${buckets(7)}
     from public.tickets t, anchor a, ${DAY}
     where ${SCAN}
     group by 1 order by cur desc, label`,
  );
}

/**
 * Outcome composition per category and per cartier, over the whole corpus.
 *
 * Deliberately not windowed to the 7 days the rest of those tables report. A
 * report takes longer to settle than that -- the resolution curve is still under
 * half at day 7 -- so a 7-day outcome split would be almost entirely "still
 * open" and would say nothing about how the category is actually handled. Across
 * the full corpus the open share is under 3% everywhere, so these read as
 * settled composition.
 *
 * Two categories, CTP and CAS, are 100% "transferred to the operator": the city
 * routes them out and never records an outcome. Their 0% favourable is a fact
 * about who answers, not about whether anything got fixed, and the page says so.
 */
export interface OutcomeShare {
  key: string; total: number;
  favorabil: number; partial: number; transferat: number; respins: number; deschise: number;
}

export async function getOutcomeByCategory(): Promise<OutcomeShare[]> {
  return query<OutcomeShare>(
    `select category_id::text as key, ${OUTCOME_COUNTS}
     from public.tickets group by 1`,
  );
}

export async function getOutcomeByNeighborhood(): Promise<OutcomeShare[]> {
  return query<OutcomeShare>(
    `select coalesce(neighborhood, '(nelocalizat)') as key, ${OUTCOME_COUNTS}
     from public.tickets group by 1`,
  );
}

export async function getDaily(days = 182): Promise<DailyRow[]> {
  return query<DailyRow>(
    `select (created_at at time zone 'Europe/Bucharest')::date::text                 as day,
            ${OUTCOME_COUNTS}
     from public.tickets
     where created_at >= (((select max((created_at at time zone 'Europe/Bucharest')::date)
                            from public.tickets) - $1::int)::timestamp
                          at time zone 'Europe/Bucharest')
     group by 1 order by 1`,
    [days],
  );
}

export async function getDailyByCategory(days = 182): Promise<DailyCategoryRow[]> {
  return query<DailyCategoryRow>(
    `select (created_at at time zone 'Europe/Bucharest')::date::text as day,
            category_id, count(*)::int as n
     from public.tickets
     where created_at >= (((select max((created_at at time zone 'Europe/Bucharest')::date)
                            from public.tickets) - $1::int)::timestamp
                          at time zone 'Europe/Bucharest')
     group by 1, 2 order by 1`,
    [days],
  );
}

export async function getLatest(n = 6): Promise<LatestTicket[]> {
  return query<LatestTicket>(
    `select ticket_number, category_id, status_label,
            to_char(created_at at time zone 'Europe/Bucharest', 'YYYY-MM-DD HH24:MI') as created_at,
            neighborhood, description
     from public.tickets order by created_at desc limit $1`,
    [n],
  );
}

export async function getMonthlyOutcome(): Promise<MonthlyOutcomeRow[]> {
  return query<MonthlyOutcomeRow>(
    `select to_char(date_trunc('month', created_at at time zone 'Europe/Bucharest'), 'YYYY-MM') as month,
            ${OUTCOME_COUNTS}
     from public.tickets group by 1 order by 1`,
  );
}

export interface WeeklySummary {
  period_start: string; period_end: string; generated_at: string;
  model: string; n_tickets: number; summary: string;
}

/** Newest stored weekly summary, or null before the first run. */
export async function getWeeklySummary(): Promise<WeeklySummary | null> {
  const rows = await query<WeeklySummary>(
    `select period_start::text, period_end::text,
            to_char(generated_at at time zone 'Europe/Bucharest', 'YYYY-MM-DD HH24:MI') as generated_at,
            model, n_tickets, summary
     from public.weekly_summary order by period_end desc limit 1`,
  );
  return rows[0] ?? null;
}

/**
 * Time-to-close.
 *
 * The upstream API publishes current status but never a close date, so nothing
 * before this project started watching is measurable -- see 004_fix_false_closed_at.
 * The cohort is therefore only tickets *created after* the first crawl: those we
 * necessarily saw arrive, so their clock starts where it should. Tickets that
 * already existed at the first crawl are excluded, and must be: every fast
 * resolution among them had already happened unobserved, so including them
 * reports a resolution time several times too slow.
 *
 * Two things then have to be handled or the answer is wrong:
 *
 *  1. Right-censoring. Most of the cohort is still open, and dropping it -- taking
 *     the mean of what has closed -- conditions on the event and produces an
 *     absurdly fast number. This uses the Kaplan-Meier product-limit estimator
 *     instead, which counts each ticket for exactly as long as it was watched.
 *     The result answers "what share was closed by day N", which is a claim the
 *     data supports; a mean or median is not, until the curve crosses 50%.
 *
 *  2. The sampling floor. The crawl runs daily, so a ticket opened and closed
 *     between two runs is first seen already closed and has no observed
 *     transition. It closed no later than `first_seen_at`, which is the bound
 *     used here. That understates speed slightly and never overstates it --
 *     ignoring these instead would drop ~a third of the cohort's closures and
 *     report near-zero same-day resolution, which is simply false.
 */
export interface ResolutionPoint {
  day: number;
  /** Open and still under observation at the start of this day. */
  at_risk: number;
  closed: number;
  /** Left the risk set this day by running out of observation, not by closing. */
  censored: number;
  /** Kaplan-Meier estimate of the share closed by the end of this day, 0-100. */
  pct: number;
}
export interface ResolutionCurve {
  points: ResolutionPoint[];
  /** First day the estimate reaches 50%, or null while the median is outside the window. */
  median_day: number | null;
  cohort: number;
  measured: number;
  obs_from: string;
  obs_to: string;
}

/**
 * Days whose risk set has thinned past this are dropped rather than drawn. The
 * tail of a survival curve is always its least certain part, and here the window
 * is short enough that the last day or two would otherwise swing on single digits.
 */
const MIN_AT_RISK = 50;

export async function getResolutionCurve(): Promise<ResolutionCurve | null> {
  const rows = await query<ResolutionPoint & { cohort: number; measured: number; obs_from: string; obs_to: string }>(
    `with obs as (
       select min(first_seen_at) as t0, max(first_seen_at) as t1 from public.tickets
     ),
     cohort as (
       select case when t.status_code = 'C'
                   then extract(epoch from (coalesce(t.closed_at, t.first_seen_at) - t.created_at)) / 86400.0
              end                                                        as dur,
              extract(epoch from (o.t1 - t.created_at)) / 86400.0        as watched
       from public.tickets t, obs o
       where t.created_at >= o.t0
     ),
     n as (
       select generate_series(1, greatest(1, floor(extract(epoch from (o.t1 - o.t0)) / 86400)::int)) as d
       from obs o
     ),
     life as (
       select n.d as day,
              count(*) filter (where coalesce(c.dur, c.watched) > n.d - 1)::int     as at_risk,
              count(*) filter (where c.dur > n.d - 1 and c.dur <= n.d)::int         as closed,
              count(*) filter (where c.dur is null
                                 and c.watched > n.d - 1 and c.watched <= n.d)::int as censored
       from n, cohort c
       group by n.d
     )
     select l.day, l.at_risk, l.closed, l.censored,
            round((100 * (1 - exp(sum(ln(greatest(
              1 - l.closed::numeric / coalesce(nullif(l.at_risk - l.censored / 2.0, 0), 1), 1e-9)))
              over (order by l.day))))::numeric, 1)::float8              as pct,
            (select count(*) from cohort)::int                           as cohort,
            (select count(*) from cohort where dur is not null)::int     as measured,
            (o.t0 at time zone 'Europe/Bucharest')::date::text           as obs_from,
            (o.t1 at time zone 'Europe/Bucharest')::date::text           as obs_to
     from life l, obs o
     order by l.day`,
  );
  if (!rows.length) return null;

  // Trim from the tail, not by filtering: the estimate at day N is a running
  // product of every earlier day, so the series has to stay a contiguous prefix.
  let last = rows.length;
  while (last > 0 && rows[last - 1]!.at_risk < MIN_AT_RISK) last -= 1;
  const points = rows.slice(0, last).map(({ day, at_risk, closed, censored, pct }) =>
    ({ day, at_risk, closed, censored, pct }));
  if (!points.length) return null;

  return {
    points,
    median_day: points.find((p) => p.pct >= 50)?.day ?? null,
    cohort: rows[0]!.cohort,
    measured: rows[0]!.measured,
    obs_from: rows[0]!.obs_from,
    obs_to: rows[0]!.obs_to,
  };
}
