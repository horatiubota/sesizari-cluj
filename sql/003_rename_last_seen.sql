-- last_seen_at implied "last time we looked", but unchanged rows are now skipped
-- so that a full re-sweep does not rewrite all 210k rows. The column only ever
-- advances when content actually differed, so the name is corrected to match.
alter table public.tickets rename column last_seen_at to last_changed_at;
