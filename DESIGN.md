---
name: Sesizări Cluj
description: A calm, light, sortable public-data dashboard where outcomes, not volume, lead every comparison.
colors:
  bg: "#f7f7f5"
  surface: "#ffffff"
  sunken: "#efefec"
  line: "#e2e2de"
  line-strong: "#c9c9c3"
  ink: "#17181a"
  ink-2: "#4a4c50"
  ink-3: "#66686d"
  focus: "#2b59c3"
  o-fav: "#4f7464"
  o-part: "#c8b68c"
  o-transf: "#6f7a8c"
  o-transf-bg: "#e3e6eb"
  o-resp: "#2e3136"
  o-open: "#e4e4df"
  o-open-hatch: "#c4c4bd"
  up: "#a1530b"
  down: "#0f6e6e"
  warn: "#8a4b08"
  warn-bg: "#fbf1e3"
typography:
  display:
    fontFamily: "Inter, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.025em"
    fontFeature: "'cv11', 'ss01', 'tnum'"
  headline:
    fontFamily: "Inter, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
    fontFeature: "'cv11', 'ss01'"
  title:
    fontFamily: "Inter, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.55
    letterSpacing: "-0.025em"
    fontFeature: "'cv11', 'ss01'"
  figure:
    fontFamily: "Inter, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.55
    fontFeature: "'cv11', 'ss01', 'tnum'"
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.625
    fontFeature: "'cv11', 'ss01'"
  control:
    fontFamily: "Inter, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "'cv11', 'ss01'"
  label:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
    fontFeature: "'cv11', 'ss01'"
rounded:
  hairline: "2px"
  strip: "3px"
  control: "6px"
  panel: "8px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
components:
  button-toggle:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.control}"
    typography: "{typography.body}"
    padding: "0 14px"
    height: "44px"
  button-toggle-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    height: "44px"
  chip-filter:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    typography: "{typography.label}"
    padding: "4px 12px"
  chip-filter-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
  select:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    typography: "{typography.control}"
    padding: "0 12px"
    height: "44px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
    padding: "24px"
  outcome-strip:
    backgroundColor: "{colors.sunken}"
    rounded: "{rounded.strip}"
    height: "10px"
  outcome-strip-large:
    backgroundColor: "{colors.sunken}"
    rounded: "{rounded.strip}"
    height: "16px"
---

# Design System: Sesizări Cluj

## Overview

**Creative North Star: "The Public Ledger"**

A calm, light reading surface for public records, made to the craft standard of a good data desk. The page is near-white tinted neutral with near-black ink, ruled by hairlines rather than boxed in cards, and almost everything on it is a number set in tabular figures. One idea owns the system: outcomes, not volume, lead every comparison. Wherever reports are counted, a strip in the five outcome bands sits beside the count, its shares printed, and the row can be re-sorted by outcome in one tap.

Colour is rationed by job. Neutrals carry structure and text; a dedicated, muted outcome scale carries how reports were closed; category colours exist only to say which category something is; blue appears only where the visitor is acting. Nothing is coloured to grade the city: there is no red verdict and no green "good". Density is high but quiet: an 8px rhythm, 12px text floor, generous line height on prose, and sections separated by a single top rule.

Light and dark are one system. Every token has a dark value under `prefers-color-scheme: dark`, so components never pick their own grey.

**Key Characteristics:**
- Near-white tinted-neutral ground, near-black ink, three AA ink tiers.
- A five-band outcome scale read by lightness and pattern, independent of the 16 category colours, with no red.
- One family (Inter, latin-ext, tabular figures) for everything, including numbers.
- Hairline rules between sections and rows; one bordered panel at most per view.
- Selection is shown by ink fill; blue is reserved for focus and active state.
- Small samples are marked as small: counts instead of shares, dashed outline on strips.

## Colors

A tinted-neutral ledger with one interaction blue, a muted outcome scale, and a direction-only delta pair.

### Primary
- **Interaction Blue** (`focus`): the only blue. Focus rings (2px outline, 2px offset), text selection tint (22% mix), and the active/inspected column in interactive charts. Never a fill for content, never a link colour, never a selected-control fill.

### Secondary: the outcome scale
Five bands in reading order, shared by every strip, stacked column, legend and key. Read mostly by lightness, with pattern on the two bands that are not outcomes of the city's own work.
- **Sage** (`o-fav`): Favorabil. Also the resolution curve stroke and the proportional bar default, and the "fresh" dot on the freshness line.
- **Sand** (`o-part`): Parțial.
- **Hatched Slate** (`o-transf` stripes at 135deg, 1.5px on 5px, over `o-transf-bg`): Transferată operatorului. In SVG it is the `#o-hatch` pattern.
- **Dark Slate** (`o-resp`): Respinsă / nefavorabil. Inverts to near-white in dark mode so it stays the extreme of the scale.
- **Hatched Pale Grey** (`o-open-hatch` stripes at 45deg, 1px on 4px, over `o-open`): Încă deschisă.

### Tertiary: direction of change
- **Amber Up** (`up`) and **Teal Down** (`down`): year-on-year and period deltas, coloured only by direction, carrying no judgement about which is good. Zero change and bases under 10 print in `ink-3` (bases under 10 show "a → b" counts, not a percentage). This is the owner's explicit decision and the current rule (confirmed 2026-10-04).
- **Warn** (`warn` on `warn-bg`): operational warnings only, such as the stale-data notice. Kept separate from `up` so that "more than before" never reads as an alarm. 6.1:1 light, 8.6:1 dark.

### Category identity (data, not tokens)
The 16 category colours live in `web/lib/categories.ts` and are used only for category identity: 10px round dots beside category names, sparkline strokes, and map pins. They never paint an outcome, a state, or chrome.

### Neutral
- **Paper** (`bg`): page ground.
- **White Sheet** (`surface`): header bar (95% with backdrop blur), the picker panel, controls, map overlay panel. Also the text colour on ink-filled selected controls.
- **Sunken** (`sunken`): empty track behind strips and bars, quiet chips (freshness line), table row hover at 60%.
- **Hairline** (`line`): section top rules, row dividers, header bottom border.
- **Strong Hairline** (`line-strong`): control borders, underline decoration on links, chart baselines and the dashed 50% rule, non-highlighted volume columns.
- **Ink** (`ink`): primary text, headline figures, selected-control fill, active nav underline, highlighted chart series.
- **Ink 2** (`ink-2`): secondary text that still carries data: notes, captions, field labels, unselected control text.
- **Ink 3** (`ink-3`): tertiary text: table headers, axis labels, legends, observed zeros. Clears 4.5:1 on `bg`, `surface` and `sunken`.

### Named Rules
**The Outcomes Own Their Scale Rule.** Outcome bands come only from the `o-*` tokens via the shared band list; never from a category colour, and never red. A rejection is a recorded outcome, not an alarm.

**The Blue Means You Rule.** `focus` marks only focus, selection tint, and the active element of an interactive chart. Selected controls are ink, not blue.

**The Text Is Ink Rule.** Every text colour is `ink`, `ink-2` or `ink-3` (or `surface` on an ink fill, `up`/`down` on a delta, `warn` on a warning). Anything that must recede further than `ink-3` becomes a rule or a fill, never text.

## Typography

**Display Font:** Inter (self-hosted via next/font, `latin` + `latin-ext`, sans-serif fallback)
**Body Font:** Inter
**Label/Mono Font:** Inter with tabular figures; the `font-mono` utility is an alias for tabular Inter, not a monospaced face.

**Character:** One workhorse sans carries the whole site: comma-below ș and ț, true tabular figures, `cv11` and `ss01` alternates on the body. Hierarchy comes from size and weight 600, never from a second family.

### Hierarchy
- **Display** (600, 2.5rem, line-height 1, tight tracking, tabular): the three headline figures only.
- **Headline** (600, 1.5rem rising to 1.875rem from 640px, tight tracking): the page H1.
- **Title** (600, 1.125rem, tight tracking): section headings; subheads drop to 1rem or 0.875rem at 600.
- **Figure** (600, 1.125rem to 1.25rem, tabular): printed shares in outcome legends and long-run stat blocks.
- **Body** (400, 0.875rem, line-height 1.625, prose capped at 68ch): notes, descriptions, table cells.
- **Control** (400, 15px): select values and row names on phones, a step above body for thumb-sized targets.
- **Label** (500 or 400, 0.75rem): field labels, table headers, legends, axis ticks, captions. Sentence case, no tracking.

### Named Rules
**The 12px Floor Rule.** No text below 0.75rem (12px), including axis ticks and legend labels. The only sub-label size in use is 13px.

**The Tabular Rule.** Every number that may be compared is set with `tabular-nums` and formatted `ro-RO`: decimal comma ("86,9%"), non-breaking group separator, "<0,1%" for nonzero shares under 0.05%.

**The Honest Zero Rule.** An observed zero prints "0%" (muted to `ink-3` in tables). "—" is reserved for "no reports at all", because a dash in a table reads as missing data.

## Layout

A single centred column, `max-width` 72rem with 16px side padding (24px from 640px). Narrow reading pages (watch list) cap at 48rem. Prose and notes cap at 68ch.

The dashboard's first band is a 3-column grid from 1024px: two columns for the H1, freshness line, headline figures and picker; one column for latest reports. Below 1024px the aside moves down the page as its own section. Headline figures sit in a row from 640px, separated by vertical hairlines; stacked below with top hairlines.

Sections are separated by a top hairline with 32px above the heading and 20px between heading/note and content. The spacing rhythm is 8px-based (4, 8, 12, 16, 20, 24, 32, 40, 48px in use).

Tables become stacked blocks below 768px rather than scrolling sideways: name and 7-day count on one line, strip below, rates as a two-column definition list. Every centred `main` is `w-full` so a wide table scrolls in its own overflow box instead of widening the page on phones.

## Elevation & Depth

Flat by default. Depth is conveyed by tone (`bg` page, `surface` sheet, `sunken` track) and hairlines, not shadows. The sticky header separates by a bottom hairline and a 95% surface with light backdrop blur.

### Shadow Vocabulary
- **Map overlay** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`): only the ticket detail panel floating over the map, where tone alone cannot separate it from tiles.

### Named Rules
**The Hairline Not Card Rule.** Sections are divided by a single top rule. At most one bordered panel per view (the picker), and never a card inside a card.

## Shapes

Small, quiet corners. Data marks use hairline corners (2px on swatches, bars and column tops; 3px on outcome strips) so they read as measurements, not buttons. Rectangular controls and selects take 6px; the one panel takes 8px. Filter chips and freshness/status chips are pills. Category identity marks are always circles; outcome swatches are always 10px rounded squares, so the two kinds of colour can be told apart by shape too.

## Components

### Buttons
Quiet, rectangular, ink-on-select.
- **Shape:** gently rounded (6px), 44px tall, 14px side padding, 1px `line-strong` border.
- **Toggle (sort by):** `surface` ground, `ink-2` text; hover moves border and text to `ink`.
- **Selected:** `ink` fill and border, `surface` text, weight 500, `aria-pressed`.
- **Text action (Descarcă CSV, copy link):** no box; `ink-2` text with a `line-strong` underline at 4px offset that darkens to `ink` on hover. Still 44px tall where it stands alone.
- **Focus:** global 2px `focus` outline, 2px offset.

### Chips
- **Style:** pill, 1px `line-strong` border, 12px text (14px on /recurente tabs), 4px by 12px padding.
- **State:** selected is `ink` fill with `surface` text, same as buttons. On the map, chips grow to 44px minimum height under `pointer: coarse`.
- **Status chip:** pill with a 1px `line` border, 8px outcome-band dot, 12px `ink-2` text.

### Cards / Containers
- **Corner Style:** 8px.
- **Background:** `surface` on `bg`.
- **Shadow Strategy:** none (see Elevation).
- **Border:** 1px `line`.
- **Internal Padding:** 16px, 24px from 640px.
- Used once, for the category by cartier picker.

### Inputs / Fields
- **Select:** 44px tall, 6px radius, 1px `line-strong` border, `surface` ground, 15px `ink` text; label above in 12px weight-500 `ink-2`.
- **Focus:** global blue outline.
- **Disabled:** 60% opacity (the prerendered picker before hydration).

### Navigation
- Sticky header, 48px bar: wordmark (15px, 600) with a three-bar mark in sage, sand and ink; four destinations; support link last in `ink-3`.
- **Links:** 14px `ink-3`, hover `ink`. **Active:** `ink`, weight 500, a 2px `ink` underline bar, `aria-current="page"`.
- **Mobile:** the nav becomes a full-width row of four equal 44px tabs under a top hairline.

### Outcome Strip (signature)
A 100% strip in the five bands, in fixed order, on a `sunken` track with 3px corners: 10px tall in tables, 16px in the picker answer. Numbers are never hidden behind it: its accessible name lists every nonzero band, and where a sighted reader needs them a legend prints each band's share in 18px tabular figures beside a 10px swatch (two columns on phones, five from 640px). Strips that print no numbers carry the compact outcome key nearby.
- **Small sample (under 20 reports):** a 1px dashed `ink-3` outline at 2px offset, and counts ("11 din 12") instead of shares. Never fade the strip; fading makes sage read as sand.
- **Stacked columns** over time reuse the exact same fill classes so one legend reads both.

### Outcome Table
Ranked rows that can be re-ranked by outcome. Sort toggles above (volume, still open, partial or rejected, rejected), state held in the URL; the active sort column turns `ink` and its values go weight 600. Rows divided by `line` hairlines, hover `sunken` at 60%. Row names link to the map with a category dot when the row is a category. Below 768px each row is a stacked block.

### Charts
Dependency-free. No text inside SVG; all labels are HTML. Lines use non-scaling 1.5 to 2px strokes. Resolution curve: sage stroke over a 10% sage area on a fixed 0 to 100% scale, light rules at 25/75% and a dashed `line-strong` 50% rule. Volume columns: `line-strong`, with the latest or inspected column in `ink` (static) or `focus` (interactive, keyboard/pointer active). Sparklines take the category colour.

## Do's and Don'ts

### Do:
- **Do** draw every outcome from the shared five-band list and the `o-*` tokens, hatched for transferred and still open.
- **Do** print shares beside strips wherever the numbers matter, and keep them in the strip's accessible name.
- **Do** switch to counts and a dashed strip outline below 20 reports, and to "a → b" counts for deltas on bases under 10.
- **Do** print an observed zero as "0%"; use "—" only when there are no reports.
- **Do** show selection with an `ink` fill and `surface` text; keep `focus` blue for focus rings, selection tint and the active chart element.
- **Do** colour deltas only by direction with `up`/`down` (current owner decision, under review).
- **Do** keep every interactive target at least 44px tall on touch; on the map use `pointer: coarse` to grow chips.
- **Do** set every compared number in tabular Inter, formatted `ro-RO`.
- **Do** give every new colour a dark value under `prefers-color-scheme: dark` in the same token.

### Don't:
- **Don't** use a category colour for an outcome, a state, or chrome; category colours are for identity dots, sparklines and map pins only.
- **Don't** use red, or green-as-good, to judge an outcome or a change.
- **Don't** set text below 12px or in any colour lighter than `ink-3`.
- **Don't** fade a strip to signal uncertainty; outline it.
- **Don't** add a second typeface or a monospaced face for figures.
- **Don't** box sections in cards or nest cards; separate with a top hairline.
- **Don't** put labels inside SVG or let a share chart's scale fit the data; shares sit on a fixed 0 to 100% scale.
