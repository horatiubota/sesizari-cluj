-- ============================================================================
-- sesizari-cluj — schema
--
-- Mirrors the public MyCluj complaint feed (report.e-primariaclujnapoca.ro).
--
-- Two-tier privacy model:
--   public.*   scrubbed, indexed, served to the browser, included in dumps
--   private.*  verbatim originals, no index, never exposed via PostgREST
--
-- Supabase exposes only the `public` schema through PostgREST by default, so
-- `private` is unreachable with the anon key. Do NOT add it to the exposed
-- schema list in API settings.
-- ============================================================================

create schema if not exists private;

-- Nothing outside the service role may touch the private schema.
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------

create table if not exists public.categories (
  id    smallint primary key,
  name  text not null unique
);

insert into public.categories (id, name) values
  (1,  'Asistență socială'),
  (2,  'Depozitări deşeuri'),
  (3,  'Construcții/lucrări neautorizate; organizare şantier'),
  (4,  'Iluminat public'),
  (5,  'Parcări/Parking-uri'),
  (6,  'Persoane fără adăpost sau care apelează la mila publicului'),
  (7,  'Salubritate'),
  (8,  'Spații verzi/Parcuri'),
  (9,  'Străzi/Alei/Trotuare/Poduri'),
  (10, 'Taxe și impozite'),
  (11, 'Semnalizare rutieră'),
  (12, 'Tulburarea liniștii publice'),
  (13, 'Altele'),
  (14, 'Rețele de apă/canalizare (CAS)'),
  (15, 'Transport public (CTP)'),
  (16, 'Parcări neregulamentare')
on conflict (id) do update set name = excluded.name;

-- ---------------------------------------------------------------------------
-- Tickets (current state)
--
-- The upstream `titlu` field is omitted deliberately: it was identical to
-- `category` in all 5,080 records sampled across 2017-2026, so it carries
-- no information and would cost ~10 MB.
-- ---------------------------------------------------------------------------

create table if not exists public.tickets (
  ticket_number   text primary key,
  category_id     smallint not null references public.categories(id),

  -- Scrubbed. The verbatim text lives in private.ticket_raw when it differs.
  description     text,
  resolve_reason  text,

  -- Upstream status is "O|In lucru" — a state code and a label. Split for
  -- indexing. Observed vocabulary: O|Noua, O|In lucru, C|Favorabil, C|Partial,
  -- C|Nefavorabil, C|Transferata operatorului.
  status_code     char(1) not null check (status_code in ('O','C')),
  status_label    text    not null,

  is_edited       boolean not null default false,

  lat             double precision,
  lon             double precision,

  -- Upstream timestamps are wall-clock Europe/Bucharest with no offset.
  created_at      timestamptz not null,

  -- Crawl bookkeeping.
  first_seen_at   timestamptz not null,
  last_seen_at    timestamptz not null,
  -- First observation at which the ticket was closed; null while open.
  closed_at       timestamptz,

  -- {"email":1,"phone":2,...} — what the scrubber removed, for auditability.
  redactions      jsonb not null default '{}'::jsonb,

  -- Reserved for reverse-geocoding into Cluj neighbourhoods.
  neighborhood    text
);

comment on column public.tickets.description is
  'PII-scrubbed. Verbatim original in private.ticket_raw where it differed.';

-- ---------------------------------------------------------------------------
-- Ticket history
--
-- The upstream API only ever exposes *current* status; it publishes no history.
-- Appending an observation whenever mutable content changes accumulates the
-- resolution-time record that does not otherwise exist anywhere public.
-- ---------------------------------------------------------------------------

create table if not exists public.ticket_events (
  id             bigint generated always as identity primary key,
  ticket_number  text not null references public.tickets(ticket_number) on delete cascade,
  observed_at    timestamptz not null,
  status_code    char(1),
  status_label   text,
  resolve_reason text,
  content_hash   text not null,
  unique (ticket_number, content_hash)
);

-- ---------------------------------------------------------------------------
-- Private: verbatim originals
--
-- Only stored for records the scrubber actually modified (~3.4% of the corpus),
-- so the lossless archive costs a few MB rather than duplicating every
-- description. Reconstruct the original as:
--     coalesce(r.description_raw, t.description)
-- ---------------------------------------------------------------------------

create table if not exists private.ticket_raw (
  ticket_number      text primary key
                     references public.tickets(ticket_number) on delete cascade,
  description_raw    text,
  resolve_reason_raw text,
  content_hash       text not null
);
-- Intentionally no indexes beyond the primary key: this table is never queried
-- by the application, only re-read if scrubbing rules are revised.

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- Full-text search over Romanian text. An expression index rather than a stored
-- generated tsvector column: same query performance, ~50 MB less storage.
-- Queries MUST use the identical expression to hit this index.
create index if not exists idx_tickets_fts on public.tickets
  using gin (to_tsvector('romanian', coalesce(description, '')));

create index if not exists idx_tickets_created    on public.tickets (created_at desc);
create index if not exists idx_tickets_category   on public.tickets (category_id, created_at desc);
create index if not exists idx_tickets_status     on public.tickets (status_code, created_at desc);
create index if not exists idx_tickets_neighborhood on public.tickets (neighborhood)
  where neighborhood is not null;

-- Bounding-box map queries. PostGIS is available on Supabase but needs enabling;
-- a plain composite index serves bbox filtering without it.
create index if not exists idx_tickets_latlon on public.tickets (lat, lon);

create index if not exists idx_events_ticket on public.ticket_events (ticket_number, observed_at);

-- ---------------------------------------------------------------------------
-- Row level security — public read, writes only via the service role
-- (which bypasses RLS entirely).
-- ---------------------------------------------------------------------------

alter table public.tickets       enable row level security;
alter table public.ticket_events enable row level security;
alter table public.categories    enable row level security;

drop policy if exists tickets_read   on public.tickets;
drop policy if exists events_read    on public.ticket_events;
drop policy if exists categories_read on public.categories;

create policy tickets_read    on public.tickets       for select to anon, authenticated using (true);
create policy events_read     on public.ticket_events for select to anon, authenticated using (true);
create policy categories_read on public.categories    for select to anon, authenticated using (true);

-- private.ticket_raw deliberately has NO policies and RLS is irrelevant to it:
-- the anon role cannot reach the schema at all.
