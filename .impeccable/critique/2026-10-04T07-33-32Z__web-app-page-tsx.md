---
target: dashboard /
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:/home/claude/workspace/sesizari-cluj/web/app/page.tsx"
target_fingerprint: "sha256:4fa3a64bb24df1797e0afe2909704bab247bae57d36564f358af57b5de8af738"
target_path: /home/claude/workspace/sesizari-cluj/web/app/page.tsx
timestamp: 2026-10-04T07-33-32Z
slug: web-app-page-tsx
---
Method: dual-agent (A: design review · B: detector + browser)
Target: dashboard `/` — web/app/page.tsx (live: sesizari-cluj.vercel.app)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Freshness/partial-day stated honestly, but the "updated" timestamp is buried mid-paragraph (page.tsx:271-275) |
| 2 | Match System / Real World | 2 | Statistical jargon ("încă în observație", risk set); decimals use "86.9%" not ro-RO "86,9%" (page.tsx:251,430; OutcomeStrip.tsx:44) |
| 3 | User Control and Freedom | 2 | No on-page filtering; every drill-down leaves for /harta |
| 4 | Consistency and Standards | 1 | Outcome colours reuse 4 category colours; mixed number formatting ("2559" vs nf); outcome cards mix % and counts |
| 5 | Error Prevention | 3 | Strong misreading guards; mid-2021 status-vocabulary break unannotated |
| 6 | Recognition Rather Than Recall | 1 | Table outcome strips have no nearby legend (legend at page.tsx:417); per-outcome numbers hover-only |
| 7 | Flexibility and Efficiency | 2 | No sort, no export, no URL state |
| 8 | Aesthetic and Minimalist Design | 2 | Ten equal-weight sections, grey notes everywhere, no lifted-out answer |
| 9 | Error Recovery | 2 | No empty/stale fallback; `daily[0]!` assumes data (page.tsx:250) |
| 10 | Help and Documentation | 4 | Note de metodă and inline notes are exemplary |
| **Total** | | **22/40** | **Acceptable** |

## Design Specificity Verdict

Content is authored for this product (partial-day caveat, weekday-aligned YoY, observed-only survival curve, nelocalizat note, MyCluj links); visuals are a generic Tailwind analytics template (neutral greys, Inter + JetBrains Mono, bordered cards, ranked tables). Nothing visual says Cluj or civic record; the distinctive "how reports get closed" signal has no visual prominence.

Deterministic scan: CLI detector 0 findings (Tailwind arbitrary classes and runtime layout are invisible to it). Browser detector on the live site: 49 findings desktop, 59 mobile — ~32 undersized-ui-text (text-[10px]), ~13 line-length (130-170 chars), 1 low-contrast (neutral-400, ~2.5:1), overused-font (Inter 79%), em-dash-overuse (41), and on mobile ~20 body-text-viewport-edge, which traced to the P0 overflow bug. Both assessments independently found the overflow.

## Priority Issues

[P0] Mobile page is 840px wide in a 390px viewport. main (page.tsx:267, mx-auto) is a flex item of the flex-col wrapper (layout.tsx:50) with min-width:auto, so the tables' min-w-[50rem] (page.tsx:127) widens main instead of scrolling inside overflow-x-auto. Every paragraph bleeds off-screen; the 90-day/outcome columns are off-screen. Same pattern in recurente/page.tsx:55, WatchList.tsx:186,224. Fix: min-w-0 w-full on main (or min-w-0 on layout wrapper), then a stacked-row table layout below sm. → adapt, harden

[P1] Outcome palette collides with category palette on the same row: Favorabil #3f9142 = Spații verzi, Respins #d94f4f = Parcări neregul., Parțial #d9a441 = Iluminat, Transferată #2f8f9d = Transport (CTP) (lib/categories.ts:3,5,10,13). Red for Respinsă is also a verdict colour. Fix: separate outcome channel (single-hue ramp for closed, hatch for transferred, grey for open), drop semantic red. → colorize

[P1] The page doesn't answer "what happens to reports like this, here?": category and cartier only separately, sorted by volume; strips ~90% green barely discriminate; non-favourable shares hover-only; mid-2021 break unannotated. Fix: category × cartier picker leading the page; explicit small numbers for non-favourable shares; factual annotation of the 2021 break. → shape, clarify

[P2] Flat hierarchy and inverted reading order: 16-colour 100%-stacked chart first on mobile, LLM summary above hard data (against "data first"), survival curve (strongest content) is section 7. Fix: freshness + 3 headline numbers → picker → tables → volume → collapsed AI summary → method. Replace confetti chart with total + top-5. → layout, distill

[P2] Accessibility/locale: neutral-400 data text fails AA (page.tsx:122,173,176,538); widespread 10px text; hover-only → affordance (page.tsx:164); "treci cu mausul" on touch (page.tsx:284); charts pointer-only, no data alternative; empty header cells (page.tsx:131,139); ro-RO decimal/grouping inconsistencies. → audit, polish

## Persona Red Flags

Alex (power user): no sort by outcome, no combined filter, no export, no URL state; outliers among 25 cartiere found by eye.
Sam (screen reader/keyboard): ~41 role=button strip tab stops before latest tickets; charts role=img with no data table; neutral-400 fails AA; unlabelled name column.
Casey (mobile, one-handed): horizontal panning everywhere (P0); "treci cu mausul"; outcome card closes on any scroll (OutcomeStrip.tsx:90); 24px Ko-fi pill and tiny bars; answer ~3000px down.
Ioana (Cluj journalist): ranked by volume not outcome; respins shares hidden; unexplained 2021 shift invites a false "rejections fell" story; no permalink/download for a view.

## Minor Observations

- YoY "+500%" on base of 1 — floor or grey small bases.
- Zero-count rows render a full green strip, looking as certain as large rows.
- Survival-curve 75/50/25% labels overlap the plot (page.tsx:462-468).
- Monthly chart x-axis only first/last month; no year ticks.
- Ko-fi pill is the warmest element in the header, pulls eye before the title.
- Latest-tickets status ("Nouă", "În lucru") styled like the cartier name.
- Line lengths 130-170 chars in max-w-3xl intro paragraphs.

## Questions to Consider

- If ~87% is Favorabil everywhere, is a green strip per row information or wallpaper? What if tables showed only the non-favourable minority?
- Why do the most trustworthy elements (method notes) come last while an LLM paragraph sits third?
- What does the dashboard give a resident on a broken pavement in Mărăști that the map doesn't?
