# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Cluj-Napoca residents.** They check whether reports in their area or category actually get resolved, and follow specific reports they care about (the Urmărite watch list). Often on a phone.
- **Journalists and civic groups.** They look for patterns, outliers and evidence: which categories or neighbourhoods lag, how often reports are rejected or only partly resolved, and what keeps being reported again.

## Product Purpose

Sesizări Cluj is an open mirror and analysis layer for MyCluj, the city's public complaint platform. The city publishes every report on a map, but only one ticket at a time, with no search, no history and no aggregates. This site makes the same public data searchable, mappable and comparable over time.

Success: a resident or reporter can answer "what happens to reports like this, here?" without filing a records request or clicking through the official map one pin at a time.

## Positioning

- **More complete than the official source.** The crawler recovers records the city's own map silently drops (malformed nested JSON), and it works around a silent 1500-record API cap. The corpus covers 98.5% of the ticket number space from 2017-03-22 onward.
- **History that exists nowhere else.** The upstream API exposes only current status. By re-reading on a schedule and logging every change, this project builds actual time-to-resolution data per category and neighbourhood, starting from its first sync.
- **Careful with people's data.** Public, but bulk-indexed with PII scrubbed.

## Operating Context

- Data is refreshed by a daily sync (last 30 days) and a weekly bounded sweep. Pages are rebuilt on a schedule, not per request.
- Every ticket links back to its official record: `https://mycluj.e-primariaclujnapoca.ro/?c=<ticket>`.
- Pages: dashboard (`/`, Panou), map (`/harta`, Hartă), repeat reports (`/recurente`, Recurente), local watch list (`/urmarite`, Urmărite).
- Infrastructure: Supabase Postgres (free tier, ~280 of 500 MB), Next.js on Vercel.

## Capabilities and Constraints

- **Romanian only.** No other language is planned. Copy, dates and numbers use `ro-RO`. ș and ț must render with comma-below (latin-ext subset).
- **Mobile-first.** Most visits are expected on phones; desktop is the secondary layout.
- **Status vocabulary** comes from upstream: closed as Favorabil, Parțial, Transferată operatorului, Nefavorabil or Respinsă; open as În lucru or Nouă. About 1% of tickets are open at any time, so *how* reports are closed is the main signal.
- **`closed_at` is unknown for the backfilled corpus.** The API never exposes a close date. Resolution times exist only for transitions observed since syncing began. Never show or imply a close date that wasn't observed.
- **No citizen photos.** The upstream photo endpoint is upload-only.
- **Privacy model.** Emails, phone numbers, CNPs, IBANs and signature-position names are scrubbed from served text. Street addresses and vehicle plates are deliberately kept, because they are what the complaint is about. Analytics are cookieless with no visitor identifier, so there is no consent banner.

## Brand Commitments

- Name: **Sesizări Cluj**.
- **Neutral mirror.** Present the data plainly and let readers draw conclusions. No editorial framing, no scoring or campaigning against Primăria, no loaded adjectives. Comparisons are allowed; verdicts are not.
- **Conventional data-dashboard look, by choice** (2026-10-04, chosen over themed directions). Execute the category standard at full craft rather than inventing a themed identity. Quality benchmarks: Datawrapper (chart and table readability, mobile), Vercel / Linear dashboards (grid, type, control polish), FT / Economist data pages (confident headline numbers, annotated charts).
- Support link to Ko-fi, labelled in Romanian ("Ia-mi o cafea"), drawn in markup rather than using Ko-fi's image or mark.

## Evidence on Hand

- The corpus: 210,718+ tickets, 2017 to the present, with per-year and per-category totals (README, `snapshot/stats.json`).
- Measured PII scrub rates and the documented upstream API traps (README).
- No testimonials, press coverage, user counts or endorsements exist. Do not fabricate any.

## Product Principles

1. **Data first, no verdicts.** Show what the city's own records say. Readers decide what it means.
2. **Never assert what isn't known.** Unobserved close dates, truncated windows and partial coverage are stated, never papered over.
3. **Always traceable to the source.** Any number or ticket should lead back to the official record.
4. **Quick to answer on a phone.** A resident on the street should get the answer to "what happens to reports like this, here?" in a few taps.
5. **Respect the people in the data.** Reports are public but written by individuals; nothing should make it easier to find or profile them.
