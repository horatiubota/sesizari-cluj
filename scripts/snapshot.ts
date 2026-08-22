import { writeFileSync } from 'node:fs';
import pg from 'pg';

/**
 * Write an aggregate snapshot of the corpus to snapshot/stats.json.
 *
 * Two jobs:
 *   1. Give the repo a versioned record of how the dataset changes over time,
 *      and the frontend instant totals without querying Postgres.
 *   2. Produce a real commit on a schedule. GitHub disables scheduled workflows
 *      in public repositories after 60 days with "no repository activity" and
 *      does not document what counts as activity, so this commits actual content
 *      changes rather than relying on an empty commit being counted.
 */

const OUT = 'snapshot/stats.json';

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const rows = async <T>(sql: string): Promise<T[]> => (await client.query(sql)).rows as T[];

const [totals] = await rows<Record<string, string>>(`
  select
    (select count(*) from public.tickets)                            as tickets,
    (select count(*) from public.tickets where status_code = 'O')    as open,
    (select count(*) from public.tickets where status_code = 'C')    as closed,
    (select count(*) from public.ticket_events)                      as events,
    (select count(*) from public.tickets where closed_at is not null) as with_measured_resolution
`);

const byYear = await rows(`
  select extract(year from created_at at time zone 'Europe/Bucharest')::int as year,
         count(*)::int as tickets
  from public.tickets group by 1 order by 1
`);

const byCategory = await rows(`
  select c.id, c.name, count(t.*)::int as tickets,
         count(*) filter (where t.status_code = 'O')::int as open
  from public.categories c
  left join public.tickets t on t.category_id = c.id
  group by 1,2 order by 3 desc
`);

const byStatus = await rows(`
  select status_code || '|' || status_label as status, count(*)::int as tickets
  from public.tickets group by 1 order by 2 desc
`);

const [range] = await rows<Record<string, string>>(`
  select min(created_at at time zone 'Europe/Bucharest')::date::text as first_ticket,
         max(created_at at time zone 'Europe/Bucharest')::date::text as latest_ticket
  from public.tickets
`);

const [size] = await rows<{ size: string }>(
  `select pg_size_pretty(pg_database_size(current_database())) as size`,
);

const snapshot = {
  generated_at: new Date().toISOString(),
  source: 'https://mycluj.e-primariaclujnapoca.ro/',
  totals: Object.fromEntries(Object.entries(totals ?? {}).map(([k, v]) => [k, Number(v)])),
  date_range: range,
  database_size: size?.size,
  by_year: byYear,
  by_status: byStatus,
  by_category: byCategory,
};

writeFileSync(OUT, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`wrote ${OUT}`);
console.log(`  tickets ${snapshot.totals.tickets}  open ${snapshot.totals.open}  events ${snapshot.totals.events}`);
console.log(`  measured resolutions: ${snapshot.totals.with_measured_resolution}`);

await client.end();
