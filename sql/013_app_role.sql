-- Create a dedicated application role.
--
-- Why: the dashboard's password reset produces credentials the connection pooler
-- rejects with 28P01, and `alter user postgres with password ...` is denied
-- because Supabase's `postgres` role is privileged but not a superuser
-- ("42501: permission denied to alter role"). Creating a new role sidesteps both:
-- CREATE ROLE is permitted from the SQL editor, and the pooler accepts any
-- database user in the form <role>.<project-ref>.
--
-- This is also the arrangement we should have had from the start. The app and the
-- sync job do not need the near-superuser account.
--
-- RUN IN THE SUPABASE SQL EDITOR. Substitute your own password below; do not
-- commit the value.

-- ---------------------------------------------------------------------------
-- BLOCK 1 — create the role.
--
--   create role sesizari_app with login password '<choose-a-password>';
--
-- Keep it alphanumeric so the connection string needs no percent-encoding.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- BLOCK 2 — privileges.
--
-- Granting membership in `postgres` is the pragmatic choice here: it carries
-- table ownership, which is what allows REFRESH MATERIALIZED VIEW (owner-only)
-- and avoids the new role being filtered by the row level security policies on
-- public.tickets. Least-privilege grants are in block 4 if you would rather be
-- explicit, but note they do not cover refreshing the materialised views.
-- ---------------------------------------------------------------------------
grant postgres to sesizari_app;


-- ---------------------------------------------------------------------------
-- BLOCK 3 — verify, then connect as:
--
--   postgresql://sesizari_app.seffnbxtthcgqahrzqxt:<password>@aws-1-eu-west-1.pooler.supabase.com:5432/postgres
--
-- Note the username carries the project ref, exactly as the postgres user does.
-- Port 5432 is the session pooler; 6543 is the transaction pooler and does not
-- support the explicit transactions the loader uses.
-- ---------------------------------------------------------------------------
select rolname, rolcanlogin, rolbypassrls
from pg_roles
where rolname in ('postgres', 'sesizari_app');


-- ---------------------------------------------------------------------------
-- BLOCK 4 — least-privilege alternative to block 2.
--
-- Use INSTEAD of `grant postgres to sesizari_app` if you prefer explicit grants.
-- The web app works fully under these. The loader works except for refreshing
-- materialised views, which requires ownership; transfer that with
--   alter materialized view public.term_baseline owner to sesizari_app;
-- ---------------------------------------------------------------------------
-- grant usage on schema public, private to sesizari_app;
-- grant select on all tables in schema public to sesizari_app;
-- grant insert, update on public.tickets, public.ticket_events to sesizari_app;
-- grant insert, update, select on private.ticket_raw to sesizari_app;
-- grant usage, select on all sequences in schema public to sesizari_app;
-- alter default privileges in schema public grant select on tables to sesizari_app;
