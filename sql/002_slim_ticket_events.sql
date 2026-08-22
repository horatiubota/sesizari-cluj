-- Reclaim space from the initial load.
--
-- The original trigger copied resolve_reason into every event. On the 210,718-row
-- backfill that duplicated the largest text field once per ticket, making
-- ticket_events 100 MB against a 500 MB quota. Those rows are all first-sighting
-- events whose text is still current on public.tickets, so the copy carries no
-- information.
--
-- Re-run 001 first: it installs the corrected trigger.

update public.ticket_events e
set resolve_reason = null
where resolve_reason is not null
  and exists (
    select 1 from public.tickets t
    where t.ticket_number = e.ticket_number
      and t.resolve_reason is not distinct from e.resolve_reason
  );

-- VACUUM FULL rewrites the table to return the freed pages to the filesystem;
-- a plain VACUUM would only mark them reusable. Takes an exclusive lock, so run
-- it while nothing is serving.
vacuum full public.ticket_events;
analyze public.ticket_events;
