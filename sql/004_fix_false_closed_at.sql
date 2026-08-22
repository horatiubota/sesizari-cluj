-- Correct closed_at values written before the trigger owned this column.
--
-- The loader's original upsert stamped closed_at whenever an updated row had
-- status 'C' and no closed_at yet -- it never checked that a transition had
-- actually been observed. Re-loading already-closed historical tickets therefore
-- asserted that 2,000 tickets from 2017 closed on the day of the re-load,
-- implying ~9.4-year resolution times.
--
-- closed_at is only meaningful when this project actually watched a ticket go
-- from open to closed. Anything else is unknowable: the upstream API exposes
-- current status but never a close date.

-- trg_closed_at deliberately preserves closed_at on any update that is not an
-- observed transition, so it overrides a plain correction here. That is the
-- trigger doing its job; a one-off repair has to step around it explicitly.
alter table public.tickets disable trigger trg_closed_at;

update public.tickets t
set closed_at = null
where t.closed_at is not null
  and not exists (
    select 1
    from public.ticket_events o
    join public.ticket_events c
      on c.ticket_number = o.ticket_number
     and c.id > o.id
    where o.ticket_number = t.ticket_number
      and o.status_code = 'O'
      and c.status_code = 'C'
  );

alter table public.tickets enable trigger trg_closed_at;
