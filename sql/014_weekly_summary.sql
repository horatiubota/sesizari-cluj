-- Weekly narrative summary of incoming reports.
--
-- Written by src/summarize.ts from a GitHub Action, read by the dashboard. The
-- table exists so the summary survives independently of the workflow run and
-- the site needs no rebuild to pick one up -- the dashboard already polls
-- Postgres on a 30-minute revalidate.
--
-- One row per period. Re-running for the same period replaces the row rather
-- than accumulating, so a re-run after a failure is safe.

create table if not exists public.weekly_summary (
  period_start  date        not null,
  period_end    date        not null,
  generated_at  timestamptz not null default now(),

  -- Recorded so the page can attribute the text, and so a change of model is
  -- visible rather than silent.
  model         text        not null,

  n_tickets     integer     not null,
  -- Plain text, blank-line separated paragraphs. Deliberately not HTML: it is
  -- model output and is rendered as text, never as markup.
  summary       text        not null,

  primary key (period_start, period_end)
);

comment on table public.weekly_summary is
  'Machine-generated. Text is model output over public report descriptions; not editorial content.';

alter table public.weekly_summary enable row level security;

drop policy if exists weekly_summary_read on public.weekly_summary;
create policy weekly_summary_read on public.weekly_summary
  for select to anon, authenticated using (true);
