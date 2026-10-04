---
version: 1
slug: "web-app-page-tsx"
primary_target: "web/app/page.tsx"
related_targets: ["web/app/harta/page.tsx","web/app/recurente/page.tsx","web/app/urmarite/page.tsx","web/app/layout.tsx"]
---

# Surface brief: Sesizări Cluj web (whole site, dashboard first) — v2

Mode: Operate. Scope: dashboard restructured around what the city's replies say; shell, tokens and type site-wide; /harta /recurente /urmarite restyled only.

Stance (PRODUCT.md, owner decision 2026-10-04): neutral, checkable data arranged so the complaint system's dysfunction is visible. Deadpan: the city's label next to the city's words, a number, one short factual verdict line per section. Never lead with favourable rates.

Audience and job: Cluj residents on phones; journalists and civic groups who sort, cite, download. Every figure traceable to MyCluj; heuristics stated with their measured accuracy in the method notes.

Dashboard order: one-line identity (independent mirror of My Cluj, linked) + freshness → weekly count with change vs previous week and vs last year → four findings (template replies %, "Favorabil" with no stated fix, infrastructure places re-reported ≥3 years, reports open >90 days) with the AI weekly summary beside them on desktop / after them on phones → Ce răspunde Primăria (top templates quoted in full) → „Favorabil”, dar… (breakdown, per-category chart vs city average, recent examples) → Rezolvat, raportat din nou → Încă deschise → picker (template %, no-fix %, open %; official labels as context) → category and cartier tables (sort by volume / template / no-fix / open; CSV) → resolution curve → daily volume → monthly history → latest reports → method notes.

## Direction contract

THESIS: Financial-press chart-desk discipline applied to a city's complaint replies: the finding is the headline, the chart proves it, the city's own words are quoted as evidence. It refuses the KPI-tile dashboard and any decorative colour.

OWN-WORLD: White paper, near-black ink, the chart-desk red (#e3120b) used only for the section tag and for the dysfunction (templated, no fix, ignored), the chart-desk blue (#006ba2) as the colour of ordinary data. Narrow bold serif headlines (Roboto Serif, width axis 72), Source Sans 3 for reading, Roboto Condensed for figures and chart labels, city replies in serif. Every finding section starts with a short red bar on a hairline red rule; charts carry title, subtitle and a source line. No cards except the example replies; no red on any ordinary series.

STORY: The visitor learns this mirrors My Cluj, sees four numbers that describe how the system answers, reads the actual replies behind them, then checks their own category and cartier, and (journalist) sorts, links and downloads.

FIRST VIEWPORT: Desktop 1440: left two-thirds = one-line identity, freshness pill, weekly line, four findings in a 2×2 grid with large red condensed numerals under black rules; right third = AI weekly summary under a red tag. Phone 390: identity, freshness, weekly line, findings stacked; the summary follows the findings.

FORM: Category standard executed in the financial-press chart style (user chose "red tag" over salmon paper and graphic-detail variants; fonts are the closest free relatives, no publication's name, logo or typefaces), seed key 2a17e884. Signature move: the city's label beside the city's words, with counts — and the red tag that marks where each finding starts.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
