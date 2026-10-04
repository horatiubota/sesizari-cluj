---
version: 1
slug: "web-app-page-tsx"
primary_target: "web/app/page.tsx"
related_targets: ["web/app/harta/page.tsx","web/app/recurente/page.tsx","web/app/urmarite/page.tsx","web/app/layout.tsx"]
---

# Surface brief: Sesizări Cluj web (whole site, dashboard first)

Mode: Operate. Scope: shared shell + tokens, dashboard restructure, /harta /recurente /urmarite restyled (confirm any structural change on those pages with the user first).

Audience and job: Cluj residents on phones asking "what happens to reports like this, here?"; journalists/civic groups who sort, cite and download. Proof is the real corpus only; every figure traceable to MyCluj; never assert unobserved close dates.

Dashboard order: overview (visible freshness + 3 headline numbers) → category × cartier picker (outcome breakdown with printed non-favourable shares + volume trend; no per-combination time-to-close; precomputed at build) → sortable category and cartier tables (volume / % nefavorabil / % respinse / % deschise; stacked rows on mobile; legend beside strips) → resolution curve + checkpoints → daily volume (total + top 5) → monthly outcomes since 2017 with factual mid-2021 note → latest reports → weekly AI summary collapsed → method notes. URL holds picker, sort, window. CSV per table from build-time data.

Unresolved at build start: typeface (Inter vs alternative), exact outcome palette, layouts of the three secondary pages, Ko-fi placement.

## Direction contract

THESIS: The category standard executed at Datawrapper/Linear/FT craft: a calm, light, sortable public-data dashboard whose one owned idea is that outcomes, not volume, lead every comparison. It refuses the grey-card KPI template with equal-weight sections and decorative 16-colour charts.

OWN-WORLD: Near-white tinted-neutral ground, ink near-black, one blue accent reserved for interaction and selection. A dedicated outcome scale independent of category colours: favourable a deep neutral-green-grey, partial and transferred as mid tones with pattern support, rejected/unfavourable a dark slate, open a light hatched grey; no red verdict colour. One workhorse sans with tabular figures and full ș/ț; numbers in ro-RO format. Hairline rules, no cards-in-cards, 8px rhythm, 12px minimum text.

STORY: The visitor sees how fresh the data is and three city-wide numbers, then narrows to their category and cartier and reads how such reports were closed, then (journalist) sorts by outcome, links the exact view and downloads it.

FIRST VIEWPORT: Mobile 390: compact header (wordmark, nav, support link) → one line of freshness → three headline figures stacked at display size with their windows and year-on-year change → the picker's two selects begin at the fold. Desktop 1440: header bar; left two-thirds headline figures in a row above the picker and its answer; right third latest reports.

FORM: The category standard (canon card, chosen by the user over the rolled transit-network direction), seed key 2a17e884. Signature move: outcome strips with printed minority shares and one-tap sort by outcome, everywhere outcomes appear.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
