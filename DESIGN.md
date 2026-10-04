---
name: Sesizări Cluj
description: A city's complaint replies laid out with financial-press chart-desk discipline; the finding is the headline, the chart proves it, the city's own words are the evidence.
colors:
  bg: "#ffffff"
  surface: "#ffffff"
  sunken: "#f2f2f2"
  line: "#d9d9d9"
  line-strong: "#b3b3b3"
  ink: "#0c0c0c"
  ink-2: "#333333"
  ink-3: "#595959"
  focus: "#006ba2"
  tag: "#e3120b"
  alarm: "#e3120b"
  chart: "#006ba2"
  o-fav: "#006ba2"
  o-part: "#3ebcd2"
  o-transf: "#758d99"
  o-transf-bg: "#e4eaed"
  o-resp: "#9a607f"
  o-open: "#e6e6e6"
  o-open-hatch: "#bfbfbf"
  up: "#a1530b"
  down: "#0f6e6e"
  warn: "#8a4b08"
  warn-bg: "#fbf1e3"
typography:
  headline-finding:
    fontFamily: "Roboto Serif, Georgia, serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.005em"
    fontVariation: "'wdth' 72, 'opsz' 36"
  headline-section:
    fontFamily: "Roboto Serif, Georgia, serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.005em"
    fontVariation: "'wdth' 72, 'opsz' 36"
  figure-lead:
    fontFamily: "Roboto Condensed, Arial Narrow, sans-serif"
    fontSize: "3rem"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "'tnum'"
  figure:
    fontFamily: "Roboto Condensed, Arial Narrow, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "'tnum'"
  quote:
    fontFamily: "Roboto Serif, Georgia, serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.625
  body:
    fontFamily: "Source Sans 3, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.625
  note:
    fontFamily: "Source Sans 3, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.625
  chart-label:
    fontFamily: "Roboto Condensed, Arial Narrow, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "'tnum'"
  label:
    fontFamily: "Source Sans 3, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.025em"
  caption:
    fontFamily: "Source Sans 3, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.625
rounded:
  swatch: "2px"
  sm: "2px"
  strip: "3px"
  md: "6px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "20px"
  xl: "24px"
  2xl: "32px"
  3xl: "48px"
  tag-bar: "2.25rem"
components:
  section-tag:
    backgroundColor: "{colors.tag}"
    width: "2.25rem"
    height: "0.5rem"
  finding-headline:
    textColor: "{colors.ink}"
    typography: "{typography.headline-finding}"
  finding-numeral:
    textColor: "{colors.alarm}"
    typography: "{typography.figure-lead}"
  official-label:
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  reply-quote:
    textColor: "{colors.ink}"
    typography: "{typography.quote}"
    width: "72ch"
  example-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "16px"
  sort-button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "44px"
  sort-button-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "44px"
  select:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "44px"
  nav-link:
    textColor: "{colors.ink-3}"
    padding: "0 12px"
    height: "44px"
  nav-link-active:
    textColor: "{colors.ink}"
    padding: "0 12px"
    height: "44px"
  outcome-strip:
    backgroundColor: "{colors.sunken}"
    rounded: "{rounded.strip}"
    height: "10px"
  status-chip:
    textColor: "{colors.ink-2}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  source-line:
    textColor: "{colors.ink-3}"
    typography: "{typography.caption}"
  freshness-pill:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.md}"
    padding: "6px 10px"
  freshness-pill-stale:
    backgroundColor: "{colors.warn-bg}"
    textColor: "{colors.warn}"
    rounded: "{rounded.md}"
    padding: "6px 10px"
---

# Design System: Sesizări Cluj

## Overview

**Creative North Star: "The Chart Desk"**

Sesizări Cluj reads like the data page of a financial weekly turned on a city hall: white paper, near-black ink, one red that means "here is the problem", one blue that means "here is data". Every finding opens with the desk's red tag, states its verdict as the headline, proves it with a chart that carries a title, a subtitle and a source line, and then quotes the city's own reply as evidence beside the city's own label. The tone is deadpan: the system does not grade, it arranges checkable numbers so the dysfunction is visible.

Density is editorial rather than dashboard: long single column on phones, a two-thirds / one-third split at desktop for the opening viewport, then full-width sections separated by red hairlines. There are no KPI tiles, no card grids, no decorative colour; the only cards are the quoted example replies. Depth is flat. Motion is absent apart from native details/summary disclosure.

The faces are free relatives chosen for the financial-press look: Roboto Serif narrowed on its width axis, Source Sans 3, Roboto Condensed. No publication's name, logo or typefaces are used anywhere; only the chart-desk colour conventions are matched.

**Key Characteristics:**
- White paper, near-black ink, hairline rules instead of boxes.
- Red is reserved for the section tag and the dysfunction findings; blue is ordinary data.
- The verdict is the heading; no label sits above it.
- Narrow bold serif headlines, condensed figures, plain sans for reading, the city's replies in serif.
- The city's official label printed as a bordered uppercase tag beside its quoted words, with a count.
- Every chart carries a title, subtitle and source line.
- Light and dark from `prefers-color-scheme`; every pair clears AA.

## Colors

A two-voice chart-desk palette on neutral paper: red for problems, blue for data, everything else greyscale or the city's official outcome scale.

### Primary
- **Chart-Desk Red** (`tag`, `alarm`; dark #ff4d45): the section tag on every section, the large numerals of the four headline findings, the template counts, the categories above the city average in the "Favorabil, dar" chart, and the open-over-90-days buckets. It measures 4.82:1 on white and 5.62:1 on the dark ground, so it can carry numerals. It never paints an ordinary series.

### Secondary
- **Chart-Desk Blue** (`chart`, also `focus`; dark #4ea1d3, dark focus #3ebcd2): the colour of ordinary data. Weekly and daily volume bars, category sparklines, below-average bars in the category chart, the resolution curve, the focus ring and text selection tint.

### Tertiary: the outcome scale (the city's official labels)
- **Favorabil** (`o-fav`, dark #4ea1d3): solid chart blue.
- **Parțial** (`o-part`, dark #9fdde8): light cyan.
- **Transferată operatorului** (`o-transf` stripes on `o-transf-bg`, dark #9aa9b2 on #263038): slate, 135° hatch, because the outcome is not the city's own work.
- **Respinsă / nefavorabil** (`o-resp`, dark #c48fae): muted purple.
- **Încă deschisă** (`o-open` with `o-open-hatch`, dark #33373d / #4a4f57): grey, 45° hatch.

### Direction and status
- **Amber Up** (`up`, dark #f0a35e) and **Teal Down** (`down`, dark #5cc7c0): year-on-year and week-on-week deltas, by the owner's explicit decision. Direction only, no judgement.
- **Stale Amber** (`warn` on `warn-bg`, dark #f3b46b on #2d2214): the freshness pill when data stops updating. Kept separate from `up` so "more than before" never reads as a warning.

### Neutral
- **White Paper** (`bg`, `surface`; dark #121417 / #181b1f): page and raised surfaces are the same white; separation comes from rules.
- **Sunken Grey** (`sunken`, dark #1c1f23): empty strip track, freshness pill, row hover.
- **Hairline** (`line`, dark #2e3137) and **Strong Hairline** (`line-strong`, dark #474c54): row dividers, chart gridlines, control borders, link underlines.
- **Ink** (`ink`, dark #f0f0f0), **Ink 2** (`ink-2`, dark #d0d0d0), **Ink 3** (`ink-3`, dark #a3a3a3): text tiers. Ink 3 still clears 4.5:1 on paper, surface and sunken in both schemes, so secondary text can carry data.

### Named Rules
**The Red Means Problem Rule.** Red appears only as the section tag and on the dysfunction findings (templated replies, "Favorabil" with no stated fix, reports left open). If a series is not a finding, it is blue or ink.

**The Unjudged Label Rule.** The outcome scale reports the city's own labels and contains no red. Favourable is blue, not green; rejected is purple, not red.

**The Map Owns the Category Colours Rule.** The sixteen category colours live on the map pages only. The dashboard never colours by category, so a category dot can never be mistaken for an outcome band.

## Typography

**Display Font:** Roboto Serif (with Georgia, serif), variable, narrowed to width 72, optical size 36
**Body Font:** Source Sans 3 (with system-ui, sans-serif)
**Label/Mono Font:** Roboto Condensed (with Arial Narrow, sans-serif) for figures and chart labels

**Character:** A tall, narrow, bold serif carries verdicts that are often long Romanian sentences in two balanced lines; a plain humanist sans carries everything read; a condensed sans packs numerals and axis labels tightly. All three load through next/font, self-hosted, with the latin-ext subset for ș and ț with comma-below.

### Hierarchy
- **Finding headline** (700, 1.75rem rising to 2rem at sm, 1.15, wdth 72, max 36ch, balanced): the verdict of each finding section; it is the h2.
- **Section headline** (700, 1.5rem, 1.25, same narrowed serif): descriptive titles of non-finding sections (picker, tables, curve, daily, monthly, latest).
- **Lead figure** (Roboto Condensed 700, 3rem, 1, tabular, red): the four headline numerals under black 2px rules.
- **Figure** (Roboto Condensed 700, 2rem / 1.75rem, 1, tabular): template counts and breakdown values.
- **Quote** (Roboto Serif 400, 15px, 1.625, max 72ch, in „…” quotes, clamped to four lines with a "Tot textul" disclosure): the city's replies, verbatim.
- **Body** (Source Sans 3 400, 15px, 1.625): identity line, finding labels, list rows. **Notes** run at 14px, max 68ch, in ink 2.
- **Chart label** (Roboto Condensed, 13px, tabular): category chart names and values; the chart subtitle runs at 14px condensed in ink 3.
- **Label** (Source Sans 3 600, 12px, 0.025em, uppercase): the city's official label tag.
- **Caption** (Source Sans 3, 12px, ink 3): scope lines, legends, axis ticks; the source line sets it in Roboto Condensed.

### Named Rules
**The Verdict Is the Heading Rule.** A finding section's h2 is its one-line verdict, generated from the numbers it states. The section name exists only for screen readers and anchors; nothing is printed above the headline.

**The 12px Floor Rule.** No text is set below 12px (`text-xs`), axis ticks and captions included.

**The Comma Rule.** Every number goes through ro-RO formatting: "86,9%", thousands with a dot, and "de" before the noun from 20 up. Use tabular figures wherever digits align.

## Layout

One centred column, max 72rem (1152px), 16px side padding rising to 24px at sm. The opening viewport at lg (1024px+) is a three-column grid with 48px gap: identity line, freshness pill, weekly line and the four headline findings (2×2 at sm, 32px × 24px gaps) across two columns, the weekly summary in the third under its own tag. On phones everything stacks and the summary follows the findings.

Below the fold, sections run full width in a fixed order, each opening with a tag rule: 24px above, 20px top padding inside, 16px bottom. Notes sit 6–8px under the headline; content starts 20–24px below. Inside sections, structure comes from hairline-divided lists (`divide-y` with top and bottom rules) and three-up figure rows with a 1px rule above each value, not from boxes.

Tables become stacked rows below md (768px): name and weekly count with delta, then the outcome strip with its total, then the three rates in a three-column grid. Charts are HTML or stretched SVG with HTML labels, never text inside SVG; axis labels thin out below sm so they never widen the page. Every centred main carries `w-full` so wide tables scroll inside their own box.

Breakpoints are Tailwind defaults: sm 640px, md 768px, lg 1024px.

## Elevation & Depth

Flat. There are no shadows anywhere on the dashboard. Depth is conveyed by rules (hairline, strong hairline, 2px ink above headline figures, red tag rule above sections) and by the single sunken grey. The sticky site header is the only layered surface: 95% surface with a light backdrop blur and a hairline below.

### Named Rules
**The Rules, Not Boxes Rule.** Separate with a line, not a card or a shadow. The quoted example replies are the only bordered cards.

## Shapes

Mostly square. Controls, the freshness pill and example cards take a gentle 6px radius; the official label takes 2px; outcome strips 3px and legend swatches 2px; status chips and the active nav underline are fully rounded. The section tag is a hard-cornered 36 × 8px red bar sitting on a 1px red rule at the left edge. Hatches (135° for transferred, 45° for open) are the system's only patterns. Small samples (under 20 reports) draw the outcome strip with a 1px dashed ink 3 outline offset 2px and print counts ("11 din 12") instead of percentages.

## Components

### Section Tag
The chart desk's mark for "a section starts here". A 1px rule in tag red across the top of the section with a 2.25rem × 0.5rem red bar at its left end. Every finding section, every dashboard section, the weekly summary aside and the category chart figure open with it.

### Finding Section
Tag, then the verdict h2 in the narrow serif (max 36ch), then an optional note in 14px ink 2 (max 68ch), then the evidence. The verdict is computed from the numbers it states.

### Headline Findings
Four linked items in a 2×2 grid, each under a 2px ink rule: a 3rem red condensed numeral, a 15px medium label that underlines on hover, a 12px ink 3 detail line. Each links to the section holding its evidence. A 12px scope line sits above the grid.

### Official Label and Quote
The signature. The city's label (FAVORABIL, ÎN LUCRU…) as a 12px semibold uppercase tag with a 1px ink border and 2px radius, beside the reply quoted verbatim in serif at max 72ch and the count of times it was sent (a 2rem red condensed "N×"). Ticket numbers link to My Cluj, underlined in strong hairline.

### Example Card
The only card: 1px hairline border, 6px radius, surface background, 16px padding, holding label, category, quote and ticket link. Three across at md.

### Charts
Every chart has a title and subtitle (a figcaption, or the section headline and note) and ends with the source line: "Sursa: My Cluj, Primăria Cluj-Napoca; calcule Sesizări Cluj." in 12px condensed ink 3, with an optional method note. Bars are flat, unrounded; the city average is a 1.5px dashed ink rule with its value labelled; scales are fixed (0–60% minimum, 0–100% for the resolution curve) rather than fitted. Interactive charts are readable by pointer, tap and arrow keys, with a live readout above.

### Outcome Strip
A 100% strip in the five outcome bands, 10px tall (16px large), 3px radius, sunken track, its numbers in its accessible name and printed beside it where they matter. A shared key lists the five bands with 10px swatches.

### Buttons
- **Sort toggles:** 44px tall, 14px horizontal padding, 6px radius, 1px strong-hairline border on surface with ink 2 text; hover darkens the border and text to ink. Pressed: ink fill, surface text, medium weight, `aria-pressed`.
- **Text actions** (download CSV, copy link): 44px tall underlined text in ink 2, hover ink.

### Inputs / Fields
- **Select:** 44px tall, full width, 1px strong-hairline border, 6px radius, surface fill, 15px ink text, 12px label above in medium ink 2. Disabled at 60% opacity.
- **Focus:** a 2px blue outline offset 2px on every focusable element.

### Navigation
A sticky header: wordmark with a three-bar glyph (blue, cyan, ink) at left, four tabs, a quiet Ko-fi link last. Tabs are 14px ink 3, hover ink; active is medium ink with a 2px ink underline. Below sm the tabs become a full-width row of equal 44px tabs under a hairline.

### Status Chip
For a ticket's current state in lists: fully rounded, 1px hairline border, 12px ink 2 text, an 8px round dot in the matching outcome band so lists and strips agree.

## Do's and Don'ts

### Do:
- **Do** open every finding section with the red tag rule and make its verdict the h2 in the narrow serif.
- **Do** keep red for the tag and the dysfunction findings; draw ordinary data in chart blue (#006ba2, dark #4ea1d3) or ink.
- **Do** quote the city's reply verbatim in serif (max 72ch) beside its official label as a bordered uppercase tag, with the count.
- **Do** give every chart a title, a subtitle and the source line.
- **Do** set figures and chart labels in Roboto Condensed with tabular numerals, reading text in Source Sans 3.
- **Do** print counts with a dashed outline when a base has fewer than 20 reports.
- **Do** format every number ro-RO, keep text at 12px or above and AA contrast in both schemes, and make touch targets at least 44px.
- **Do** colour deltas amber (up) and teal (down) for direction only.

### Don't:
- **Don't** use red on an ordinary data series, a delta, or an outcome band.
- **Don't** print an eyebrow, kicker or section label above a verdict headline.
- **Don't** use the sixteen category colours anywhere but the map.
- **Don't** add KPI tiles, card grids, shadows or decorative colour; separate with rules.
- **Don't** use any publication's name, logo or typefaces; the system matches colour conventions only.
- **Don't** fit a share chart's scale to its data, or show a percentage on a base under 20.
