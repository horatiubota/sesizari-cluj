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

export async function getDaily(days = 182): Promise<DailyRow[]> {
  return query<DailyRow>(
    `select (created_at at time zone 'Europe/Bucharest')::date::text                 as day,
            count(*)::int                                                           as total,
            count(*) filter (where status_label = 'Favorabil')::int                 as favorabil,
            count(*) filter (where status_label = 'Partial')::int                   as partial,
            count(*) filter (where status_label = 'Transferata operatorului')::int  as transferat,
            count(*) filter (where status_label in ('Respinsa','Nefavorabil'))::int as respins,
            count(*) filter (where status_code = 'O')::int                          as deschise
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
            count(*)::int                                                           as total,
            count(*) filter (where status_label = 'Favorabil')::int                 as favorabil,
            count(*) filter (where status_label = 'Partial')::int                   as partial,
            count(*) filter (where status_label = 'Transferata operatorului')::int  as transferat,
            count(*) filter (where status_label in ('Respinsa','Nefavorabil'))::int as respins,
            count(*) filter (where status_code = 'O')::int                          as deschise
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
