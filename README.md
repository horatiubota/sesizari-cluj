# sesizari-cluj

An open mirror and analysis layer for [MyCluj](https://mycluj.e-primariaclujnapoca.ro/),
the Cluj-Napoca public-domain complaint platform.

The city publishes every complaint on a map, but only one ticket at a time, with
no search, no history, and no way to see patterns. This project mirrors the same
public data into a queryable database so it can be searched, aggregated, and
tracked over time.

## Status

| Stage | State |
|---|---|
| API reverse-engineering | done — see [API notes](#the-upstream-api) |
| Crawler + local store | done |
| PII scrubbing | done, 16 tests |
| Postgres schema | done — `sql/001_schema.sql` |
| Historical backfill (2017→now) | done |
| Loader into Supabase | next |
| Web frontend | not started |

## Quick start

Requires Node ≥ 24 (native TypeScript execution and `node:sqlite`).
**The crawler has no runtime dependencies.**

```bash
pnpm backfill                  # full history, ~495 requests, ~13 min, resumable
pnpm backfill 2026-01-01 2026-08-22   # a specific range
pnpm sync                      # last 30 days (~5 requests) — run daily
pnpm sync --full               # complete re-sweep — run weekly
pnpm stats                     # QA report + Postgres size projection
pnpm test                      # PII scrubber test suite
```

## The upstream API

A single undocumented endpoint, discovered by inspecting the site's own
`_js/ajaxCalls_20250326.js`. Everything below was verified by probing.

```
POST https://report.e-primariaclujnapoca.ro/IncidentRP.aspx
Content-Type: application/x-www-form-urlencoded
Origin: https://mycluj.e-primariaclujnapoca.ro

categorycodelist=&state=A&incidentfromdate=20/08/2026&incidenttodate=22/08/2026&incidentno=&calltype=P
```

| Parameter | Behaviour |
|---|---|
| `incidentfromdate` / `incidenttodate` | `DD/MM/YYYY`. Inclusive. |
| `state` | `A`=all, `O`=open, `C`=closed. Any other value returns empty. Comma multi-select (`O,C`) returns **empty** despite the UI being a multi-select. |
| `categorycodelist` | Comma-separated category ids (`16,4`). Empty = all. |
| `incidentno` | Single-ticket lookup. Dates must be blank. Returns the same 11 fields — there is no richer detail endpoint. |
| `calltype` | **Ignored server-side.** `P`/`R`/`S`/empty return byte-identical responses. |

### Three traps

**1. A silent 1500-record cap.** The server returns at most 1500 records,
selected as the *first 1500 by ascending date from `incidentfromdate`*, then
re-sorted by latitude for output. There is no error, no flag, no indication of
truncation. A naive one-year query looks like it succeeded and is ~95%
incomplete. `fetchWindow` throws `ResultCapError` at exactly 1500 rather than
returning quietly-truncated data.

Weekly windows returned 196–620 records across 2017–2026, comfortably clear of
the cap. `fetchAdaptive` halves any window that hits it anyway.

**2. The JSON is malformed.** Records sharing identical coordinates are nested
into a sub-array instead of being emitted flat:

```json
[ {...}, {...}, [ {...}, {...}, {...} ], {...} ]
```

The city's own map does `data.forEach(item => addMarkers(item))`, so it passes an
array where an object is expected and **silently drops every nested record from
its own map**. `flattenTickets` walks the structure recursively, so this mirror
is strictly more complete than the official site.

**3. Photos are not retrievable.** `Photo.aspx` exists but is upload-only
(`sendPhotos` in the site's client). The public map never renders images. Citizen
photos cannot be mirrored.

### Data shape

Eleven string fields per ticket. `titlu` was identical to `category` in all
5,080 records sampled across 2017–2026 and is dropped. `description` is null in
roughly 0.02% of records.

```json
{
  "ticketnumber": "CAS-0213702", "titlu": "Altele", "description": "...",
  "isedited": "0", "category": "Altele", "categoryid": "13",
  "latitude": "46.711972", "longitude": "23.547564",
  "createdon": "20/08/2026 15:29:18", "status": "O|In lucru", "resolvereason": ""
}
```

`status` is a pipe-separated state code and label. Observed vocabulary:
`O|Noua`, `O|In lucru`, `C|Favorabil`, `C|Partial`, `C|Nefavorabil`,
`C|Transferata operatorului`.

Data begins **2017-03-22**. Earlier dates return empty.

Permalink back to the official record: `https://mycluj.e-primariaclujnapoca.ro/?c=CAS-0213702`

## Why a history table

The upstream API exposes only *current* status and offers no "modified since"
filter. It publishes no history at all. By re-reading every window on a schedule
and appending an observation whenever mutable content changes, this project
accumulates something that does not otherwise exist publicly: **actual
time-to-resolution per category, per neighbourhood, over time.** That record
starts accruing from the first crawl and compounds.

## Privacy

The source data is public, but there is a real difference between *visible one
ticket at a time* and *bulk-indexed and searchable by name*. Most personal data
here is incidental — people signing off a formal letter, not publishing
themselves.

Two-tier model:

- **`public.tickets.description`** — scrubbed, indexed, served, included in dumps
- **`private.ticket_raw.description_raw`** — verbatim, no index, never exposed

Supabase exposes only the `public` schema through PostgREST, so `private` is
unreachable with the anon key that ships in the browser bundle. It is stored only
for the ~3.4% of records the scrubber actually modified, so the lossless archive
costs a few MB instead of duplicating every description.

**Removed:** emails, Romanian phone numbers, CNPs, IBANs, and person names in
signature position (trailing name lines, `Subsemnatul/a <Name>`).

**Deliberately kept:** street addresses and vehicle plates. They are the *subject*
of the complaint, not an identifier, and removing them would gut the dataset.

Validated against 5,080 real records: 3.43% modified, every name redaction
manually audited for false positives.

## Layout

```
src/api/client.ts     endpoint client — cap guard, nested-array recovery, retry
src/api/types.ts      field shapes, category map, constants
src/crawl.ts          shared crawl engine — windowing, adaptive splitting
src/backfill.ts       one-time historical crawl (resumable)
src/sync.ts           incremental sync — daily recent / weekly full
src/scrub/pii.ts      PII scrubbing (+ pii.test.ts)
src/store/local.ts    SQLite landing zone + change detection
sql/001_schema.sql    Postgres schema
scripts/stats.ts      QA report and size projection
```

The crawl writes to local SQLite first, and Postgres is loaded from that. The
crawl is the only expensive, rate-limit-exposed step, so a schema change costs a
re-load (seconds) rather than a re-crawl (~500 requests against a municipal
server).

## Courtesy

The crawler sends an identifying User-Agent, paces requests (350 ms default,
`MYCLUJ_DELAY_MS`), backs off exponentially on failure, and is resumable so
interruptions do not cause re-crawling. Total load for a full history sweep is
~495 requests. No rate limiting was observed upstream; the pacing is voluntary.

## Licence

Code MIT. The underlying complaint data is public information published by
Primăria Cluj-Napoca.
