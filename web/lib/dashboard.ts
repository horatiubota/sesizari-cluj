import { query } from '@/lib/db';

/**
 * Dashboard aggregates.
 *
 * Everything here is anchored to Europe/Bucharest calendar days. Upstream
 * timestamps are wall-clock Bucharest with no offset, and a UTC day boundary
 * would move ~3 hours of evening reports into the following day.
 *
 * Week-over-week comparisons are matched on *elapsed days*, not whole weeks.
 * The current week is always partial, so comparing it against a complete week
 * would manufacture a decline every time. `days` below is how far into the week
 * the data reaches, and each comparison window is truncated to the same length.
 *
 * Note the anchor: the newest day *present in the data*, not the wall clock. The
 * sync job runs once a day, so between runs the calendar is ahead of the mirror.
 * Anchoring on now() would append an empty day to the current window and report
 * a fabricated week-over-week drop every morning.
 */

/** Common week anchoring, reused by every period query. */
const WEEK_CTE = `
  anchor as (
    select max((created_at at time zone 'Europe/Bucharest')::date) as today
    from public.tickets
  ),
  w as (
    select today,
           date_trunc('week', today)::date                    as cur_start,
           (today - date_trunc('week', today)::date + 1)::int as days,
           date_trunc('week', today)::date - 7                as prev_start,
           -- Monday of the same ISO week number one ISO year back, which keeps
           -- weekday alignment. Week 53 against a 52-week year lands on week 1
           -- of the following year; rare, and still a like-for-like Monday.
           to_date(concat(extract(isoyear from today)::int - 1, '-',
                          extract(week   from today)::int), 'IYYY-IW') as ly_start
    from anchor
  )`;

/** Bucket counters shared by the category and neighbourhood breakdowns. */
const BUCKETS = `
  count(*) filter (where dd between w.cur_start and w.today)::int                              as cur,
  count(*) filter (where dd >= w.prev_start and dd < w.prev_start + w.days)::int               as prev,
  count(*) filter (where dd >= w.ly_start   and dd < w.ly_start   + w.days)::int               as ly`;

/** Restricts the scan to the three windows rather than the whole table. */
const WINDOW_FILTER = `
  t.created_at >= (w.ly_start::timestamp at time zone 'Europe/Bucharest')
  and t.created_at < ((w.today + 1)::timestamp at time zone 'Europe/Bucharest')`;

export interface Overview {
  total: number; open: number; favorabil: number; partial: number;
  transferat: number; respins: number;
  first_day: string; last_day: string; last_day_count: number; last_seen: string;
}

export interface WeekTotals {
  today: string; week_start: string; days: number;
  prev_start: string; ly_start: string; iso_week: number;
  cur: number; prev: number; ly: number;
}

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
export interface BacklogRow { year: number; still_open: number; total: number }
export interface MonthlyOutcomeRow {
  month: string; total: number; favorabil: number; partial: number;
  transferat: number; respins: number; deschise: number;
}

export async function getOverview(): Promise<Overview> {
  const [row] = await query<Overview>(
    `select count(*)::int as total,
            count(*) filter (where status_code = 'O')::int                              as open,
            count(*) filter (where status_label = 'Favorabil')::int                     as favorabil,
            count(*) filter (where status_label = 'Partial')::int                       as partial,
            count(*) filter (where status_label = 'Transferata operatorului')::int      as transferat,
            count(*) filter (where status_label in ('Respinsa','Nefavorabil'))::int     as respins,
            min((created_at at time zone 'Europe/Bucharest')::date)::text               as first_day,
            max((created_at at time zone 'Europe/Bucharest')::date)::text               as last_day,
            count(*) filter (where (created_at at time zone 'Europe/Bucharest')::date
                                 = (select max((created_at at time zone 'Europe/Bucharest')::date)
                                    from public.tickets))::int                          as last_day_count,
            to_char(max(created_at at time zone 'Europe/Bucharest'),
                    'YYYY-MM-DD HH24:MI')                                               as last_seen
     from public.tickets`,
  );
  return row;
}

export async function getWeekTotals(): Promise<WeekTotals> {
  const [row] = await query<WeekTotals>(
    `with ${WEEK_CTE},
     d as (select (t.created_at at time zone 'Europe/Bucharest')::date as dd
           from public.tickets t, w where ${WINDOW_FILTER})
     select w.today::text as today, w.cur_start::text as week_start, w.days,
            w.prev_start::text as prev_start, w.ly_start::text as ly_start,
            extract(week from w.today)::int as iso_week,
            ${BUCKETS}
     from d, w group by w.today, w.cur_start, w.days, w.prev_start, w.ly_start`,
  );
  return row;
}

export async function getByCategory(): Promise<Breakdown[]> {
  return query<Breakdown>(
    `with ${WEEK_CTE}
     select t.category_id::text as key, c.name as label, ${BUCKETS}
     from public.tickets t
       join public.categories c on c.id = t.category_id,
       w, lateral (select (t.created_at at time zone 'Europe/Bucharest')::date) as x(dd)
     where ${WINDOW_FILTER}
     group by 1, 2 order by cur desc, label`,
  );
}

export async function getByNeighborhood(): Promise<Breakdown[]> {
  return query<Breakdown>(
    `with ${WEEK_CTE}
     select coalesce(t.neighborhood, '(nelocalizat)') as key,
            coalesce(t.neighborhood, '(nelocalizat)') as label, ${BUCKETS}
     from public.tickets t, w,
       lateral (select (t.created_at at time zone 'Europe/Bucharest')::date) as x(dd)
     where ${WINDOW_FILTER}
     group by 1 order by cur desc, label`,
  );
}

export async function getDaily(days = 182): Promise<DailyRow[]> {
  return query<DailyRow>(
    `select (created_at at time zone 'Europe/Bucharest')::date::text                    as day,
            count(*)::int                                                              as total,
            count(*) filter (where status_label = 'Favorabil')::int                    as favorabil,
            count(*) filter (where status_label = 'Partial')::int                      as partial,
            count(*) filter (where status_label = 'Transferata operatorului')::int     as transferat,
            count(*) filter (where status_label in ('Respinsa','Nefavorabil'))::int    as respins,
            count(*) filter (where status_code = 'O')::int                             as deschise
     from public.tickets
     where created_at >= (((select max((created_at at time zone 'Europe/Bucharest')::date)
                            from public.tickets) - $1::int)::timestamp
                          at time zone 'Europe/Bucharest')
     group by 1 order by 1`,
    [days],
  );
}

export async function getDailyByCategory(days = 60): Promise<DailyCategoryRow[]> {
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

export async function getBacklogByYear(): Promise<BacklogRow[]> {
  return query<BacklogRow>(
    `select extract(year from created_at at time zone 'Europe/Bucharest')::int as year,
            count(*) filter (where status_code = 'O')::int as still_open,
            count(*)::int as total
     from public.tickets group by 1 order by 1`,
  );
}

export async function getMonthlyOutcome(): Promise<MonthlyOutcomeRow[]> {
  return query<MonthlyOutcomeRow>(
    `select to_char(date_trunc('month', created_at at time zone 'Europe/Bucharest'), 'YYYY-MM') as month,
            count(*)::int                                                              as total,
            count(*) filter (where status_label = 'Favorabil')::int                    as favorabil,
            count(*) filter (where status_label = 'Partial')::int                      as partial,
            count(*) filter (where status_label = 'Transferata operatorului')::int     as transferat,
            count(*) filter (where status_label in ('Respinsa','Nefavorabil'))::int    as respins,
            count(*) filter (where status_code = 'O')::int                             as deschise
     from public.tickets group by 1 order by 1`,
  );
}
