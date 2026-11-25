# Card wording review: shorter notes and explanations (2026-11-21)

The maintainer's ask (2026-11-21): "review wording on cards and propose
less wordy notes and explanations." This is a proposal, not a change: the
app is as it was. Each proposal keeps every figure, source name, date and
attribution, keeps quoted source words verbatim, and keeps the
disclaimers the rules in CLAUDE.md's first section require (silence
named, own limits called the reader's, a sourced figure the app cannot
act on said to be so), shortened but present.

Applied since: W1 to W4, F2 and C4 on 2026-11-22; S1, S3, F1, F3, F4, A, H1, D1 to D3, O1, O2, R, WL, P1, P4 and SET on 2026-11-25 (docs/open-questions.md, "Card wording", has the counts). The "now" texts below are as they stood on 2026-11-21.

## How it was measured

The fixture build (`BASE_PATH=/ VITE_USE_FIXTURES=true npm run build`,
served with `npx -y http-server@14.1.1 dist -p 8793 -s`) loaded in
Playwright's Chromium 1194 at 390 px, `timezoneId: 'America/Chicago'`,
the clock pinned to 2026-11-21 14:00 CST (a Saturday afternoon, so the
night flag is off and the Ceiling & sky card draws full day tables), the
font forced to DejaVu Sans (the GitHub runner's, wider than the sandbox's
Inter, so the heights are the larger case). Every request not to the
local server was aborted: nothing reached api.open-meteo.com or the
deployed site. Page width stayed 390 px in every state; no page errors.

States rendered: the Jumpers tab on the Student profile (the default; two
wind flags fire on the fixture), on Licensed with no own limits, and on
the 21+ waiver tier; the Pilots tab; the `#citations` page; and once with
every `<details>` opened and today's outlook row tapped. Strings the
fixtures do not reach (the Ceiling & sky card's IFR note, the two
fallback notes, the drift card's low-level note, the Sectional card's
notes with tiles loaded, Data health's Open-Meteo count) were rendered
with `renderToStaticMarkup` and word-counted the same way.

A "note" is a `p.muted.small`, a `p.small`, an empty-state `p.muted`, a
`.wind-observed` line, a chart legend's source line or a `<details>`
under a card's data; a flag's guidance is counted under Conditions to
note. Words are whitespace-separated tokens of the rendered text (a
link's text counts, its ⓘ counts as one). Heights are the elements'
bounding boxes; "data" is the card body less its notes.

## The table

Jumpers tab, Student profile, as loaded (details closed). Heights in px
at 390 px wide.

| Card | Data px | Note px | Note share | Note words now | Folded words now | Note words proposed | Folded proposed |
|---|---:|---:|---:|---:|---:|---:|---:|
| Disclaimer banner | 178 | 15 (summary) | 8% | 73 (banner) | 83 | 67 | 79 |
| Conditions to note (2 wind flags) | 786 | — | — | 258 (guidance) | 0 | 158 | 0 |
| Surface wind | 209 | 346 | 62% | 213 | 0 | 194 | 0 |
| Hourly wind | 244 | 131 | 35% | 74 | 0 | 62 | 0 |
| Winds aloft | 542 | 405 | 43% | 226 | 464 | 167 | 321 |
| Freefall drift / spot | 462 | 269 | 37% | 158 | 0 | 111 | 0 |
| Current conditions | 222 | 28 | 11% | 14 | 0 | 14 | 0 |
| Ceiling & sky | 1,101 | 606 (prose) | 36% | 384 | 133 | 319 | 116 |
| 10-day outlook | 342 | 126 | 27% | 80 | 0 | 49 | 0 |
| Precipitation & storms | 231 | 28 | 11% | 18 | 0 | 18 | 0 |
| Daylight | 250 | 28 | 10% | 18 | 0 | 18 | 0 |
| Radar | 385 | 112 | 23% | 60 | 0 | 43 | 0 |
| Exit weight & wing loading | 199 | 174 | 47% | 90 | 0 | 85 | 0 |
| Data health | 408 | 14 | 3% | 3 | 0 | 3 | 0 |
| **Total, Student Jumpers page** | | | | **1,669** | **680** | **1,308** | **516** |

Other states, the cards that differ:

| State · card | Data px | Note px | Note words now | Folded now | Proposed | Folded proposed |
|---|---:|---:|---:|---:|---:|---:|
| Licensed · Conditions to note (empty) | 24 | 171 | 59 | 0 | 52 | 0 |
| Licensed · Surface wind | 162 | 399 | 253 | 0 | 224 | 0 |
| Licensed · Settings (open) | 357 | — | 79 | 0 | 70 | 0 |
| Licensed, own wind limit and gust ceiling · the four wind flags | — | — | 87 + 83 + 130 + 114 = 414 | 0 | about 295 | 0 |
| Waiver 21+ · Conditions to note (4 flags) | 1,015 | — | 326 | 0 | about 270 | 0 |
| Pilots · Conditions to note (empty) | 48 | 113 | 50 | 0 | 45 | 0 |
| Pilots · TAF | 400 | 185 | 109 | 0 | 86 | 0 |
| Pilots · Nearby METARs | 577 | 84 | 41 | 70 (raw) | 34 | 70 |
| Pilots · Density altitude | 286 | 272 | 136 | 0 | 65 | 69 |
| Pilots · Sectional (tiles loaded; from source) | — | — | 96 | 0 | 91 | 0 |
| Outlook · a day tapped (key folded) | 869 | 996 open | 74 (legend) | 312 (key) | 62 | about 243 |
| Ceiling & sky · IFR or MVFR reported (from source) | — | — | +325 | 0 | +130 | +110 (the 91.155 rows) |
| Winds aloft · NOAA FD fallback (from source) | — | — | 74 (fallback note) | 0 | 60 | 0 |
| Drift · NOAA FD fallback (from source) | — | — | 68 (low-level note) | 0 | 50 | 0 |
| 10-day outlook · gridpoint fallback (from source) | — | — | 90 (fallback note) | 0 | 53 | 0 |
| Data health · Open-Meteo count shown (from source) | — | — | 56 + 31 | 0 | 56 + 31 (not proposed) | 0 |
| `#citations` · prose (not the entries) | — | — | 122 + 8 + 73 + 40 + 44 + 130 = 417 | 0 | 104 + 8 + 50 + 40 + 44 + 117 = 363 | 0 |

The entries on `#citations` (14 of them) hold 758 words of claim, 1,606
of "the source says" and 1,164 of questions; A9 alone is 689 words and A8
393. They are data, not card prose, and are not rewritten here; A9's
claim shrinks with F4 and C4 below, since it is derived from them.

## What to do first, and why

The Student page as loaded goes from 1,669 note words to 1,308 (−361,
22%) and its folded text from 680 to 516; the heights follow, since the
notes are plain paragraphs. Ranked by words saved per card on that page:

| Card | Now | Proposed | Saved | Proposals |
|---|---:|---:|---:|---|
| Conditions to note | 258 | 158 | −100 | F1, F2 (S1's constant) |
| Ceiling & sky | 384 + 133 folded | 319 + 116 | −65, −17 folded | C1, C2, C3 |
| Winds aloft | 226 + 464 folded | 167 + 321 | −59, −143 folded | W1–W4, W6 |
| Freefall drift / spot | 158 | 111 | −47 | D1–D3 |
| 10-day outlook | 80 | 49 | −31 | O1 |
| Surface wind | 213 | 194 | −19 | S1, S2 |
| Radar | 60 | 43 | −17 | R |
| Hourly wind | 74 | 62 | −12 | H1 |
| Disclaimer | 73 | 67 | −6 | DIS |
| Exit weight & wing loading | 90 | 85 | −5 | WL |

Off that page, the biggest single cuts are the Ceiling & sky card's
non-VFR note (325 → 130 visible, C4), the Density altitude card (136 → 65
visible, P3), the four wind flags on Licensed with own limits (414 →
about 295, S3 and F2), the outlook's folded key (312 → about 243, O3)
and the fallback notes (O2 −37, D4 −18, W5 −14).

What to do first:

1. **F2 and F1, with S1's constant** (−100 on the list that heads the
   page). The forecast flag repeats the observed flag's whole guidance,
   waiver mechanics and fact included, directly under it; and the
   round-reserve fact prints five times on the Student page from one
   template. Four tests to move (F2's two assertions, S1's exact
   sentences), one each in `forecastAdvisories`, `advisories`,
   `hourlyChart` and `ownLimits`.
2. **C1 and C2, the Ceiling & sky key** (−65 words, more in height: a
   `<dl>` keyed by the row labels sets each row's meaning beside its
   label instead of in a 252 px paragraph). The maintainer's named
   complaint. Three exact assertions kept; one `indexOf` anchor to
   keep or move.
3. **W4, the Winds aloft About details** (−143 folded) with W1–W3 (−59
   visible). The two longest paragraphs pin two phrases between them,
   and the 93-word ground paragraph explains a 1 ft difference.
4. **C4, the non-VFR note's 91.155 rows folded** (−195 visible whenever
   the category is below VFR, the one time the card is most read). No
   test changes: the assertions read the HTML and a closed `<details>`
   keeps the rows in it.
5. **P3 and D1–D4** (Density altitude −71 visible; drift −47, and the
   two judgements in disguise on that card). Small, mechanical, one
   pinned sentence each.

Not worth doing for the words alone: S2 (−8, every figure stays), WL
(−5), DIS (−6, four phrases pinned), Data health (under −20 for five
assertion changes). They are listed so the next pass need not re-read
them.

## Flagged: judgements in disguise

Sentences that assert something no source sets, or instruct beyond the
source, under "A number is not the only way to assert something":

- **10-day outlook**: "Confidence drops fast past a few days — use this
  for planning which days to watch, and check current conditions before
  jumping." An unsourced claim about forecast skill, then advice. The
  banner already sends the reader to current conditions. Drop (O1).
- **Freefall drift / spot**: "These are floors — deploy above your
  minimum, not at it." The BSR says minimum; the instruction is the
  app's. Drop (D2).
- **Freefall drift / spot, FD fallback**: "the stretch where wind usually
  changes most" and "treat this as the rougher half of the estimate".
  Both the app's characterisation. Drop (D4).
- **Winds aloft, About**: "so treat them as guidance". Drop (W4d).
- **Ceiling & sky, non-VFR note**: "IFR: reduced ceiling/visibility."
  "Reduced" is the app's word beside the AIM's label; the flag above
  already prints the category. Drop the gloss (C4).
- **Winds aloft, About**: "the popular skydiving winds tool". An opinion,
  harmless; goes with the cut (W4a).

Kept on purpose, and noted so nobody takes them for the same thing: the
drift card's "Plan to spot upwind: exit ~… toward … of the target so you
drift back over it" is what the estimate is for, and says it is an
estimate; the advisory subtitle "Flags only — not a go/no-go call. You
decide." is the rule itself.

## Flagged: stale against the code

- **`#citations` intro**: "14 CFR 105.17 and 105.19, AIM 7-1-7 and
  FAA-P-8740-2 on 2026-09-23." The reading log (`src/config/readingLog.ts`)
  has 105.17, 105.19 and 91.155 last read 2026-11-03 (the AIM and the
  pamphlet 2026-09-23). The sentence names a superseded date for two of
  its four, and does not name 91.155 at all. Fix in CIT1; the test that
  pins the intro (`tests/citationsPage.test.ts`) pins no date.
- **10-day outlook, gridpoint fallback note**: "the cutoffs this app used
  to derive one from cloud cover and rain chance were its own." History
  wording on a card; CLAUDE.md puts history in the commit log, and
  `tests/citationsPage.test.ts` rejects "used to" on that page for the
  same reason. Drop (O2).
- **Disclaimer, "About the sources"**: "read at their sources on
  2026-09-22 and 2026-09-23 (every cited SIM part again on 2026-10-08)".
  True as the first reading, but the CFR sections have been read since
  (2026-11-03) and the sentence does not say so. `tests/disclaimer.test.ts`
  pins "2026-09-22 and 2026-09-23". Suggested in DIS: "first read … ; the
  citations page has each source's last reading."
- **HourlyKey, Wind**: "A station's report gives a gust only when the
  wind varied by 10 knots or more between peaks and lulls (NWS glossary),
  so a report with no gust is not a steady wind." Not stale, but in the
  key of a *forecast* column, about station *reports*. Move to the
  Current conditions card or drop (O3).
- **Duplicates on screen**, not stale but said twice: the Winds aloft
  card's "Now 2:00 PM" under an offset bar labelled "now" (W1); the
  method note "Every level this app samples…" beside the About details'
  interpolation paragraph that lists the same levels (W2); the TAF note's
  "~20 mi NNE of the drop zone" under a subtitle that says "~20 mi NNE of
  DZ" (P1); the outlook's "Dir is the direction the wind blows from,
  averaged over the day's hours and weighted by speed" beside a column
  heading whose title says "Dominant direction: the day's speed-weighted
  mean 10 m wind direction" (O1); "Showing key altitudes to 10,000 ft …
  Expand for every level up to 13,000 ft" under a button that says "Show
  more altitudes (more increments, up to 13,000 ft)" (W6).

## Proposals

Each: the current text as rendered, the proposed text, word counts, the
tests that pin the current wording (grepped on a distinctive phrase; "none
found" means no test under `tests/` holds that phrase), and where the
string lives.

### Surface wind

**S1 · The round-reserve caveat** (`SurfaceWindPanel`; built by
`lowerLimitPublished`, `windBandUse`, `withNotHere` in
`src/domain/advisories.ts` and `dzFact` in `src/config/thresholds.ts`).

Now (75 w):

> A lower maximum ground wind, 8.7 kt, is published for solo students on round reserves. The band and flag here use 12 kt, the 14 mph figure for ram-air canopies rounded down to whole knots, so neither checks the lower one. No student rig at LSPC carries a round reserve (the maintainer, 2026-10-26; confirmation asked on the citations page), so that figure binds no student at this drop zone. USPA SIM, Section 2-1 (BSR) ⓘ

Proposed (64 w):

> The BSR also publishes 8.7 kt for solo students on round reserves; the band and flag use 12 kt, the 14 mph ram-air figure rounded down to whole knots, and do not check it. No student rig at LSPC carries a round reserve (the maintainer, 2026-10-26; confirmation asked on the citations page), so it binds no student here. USPA SIM, Section 2-1 (BSR) ⓘ

The same fact sentence prints in the Hourly wind legend (H1), the
outlook's day legend, and both wind flags (F1, F2); `dzFact` also builds
`HOP_AND_POP_FACT`, so its template change shortens the visibility flag
and the Ceiling & sky note too ("so a hop-and-pop is in the 3 SM row
throughout" stays; only the attribution clause is shared).

Pins: `tests/advisories.test.ts` 691–696 (exact sentences), 705 (edited
form "…as edited in Settings, not a published figure, so neither"), 941
(the flag's form); `tests/hourlyChart.test.ts` 268; `tests/ownLimits.test.ts`
72; `tests/forecastAdvisories.test.ts` 116; the `HOLDS` map in
`tests/advisories.test.ts` 38–41 if `dzFact`'s template changes.

**S2 · The forecast-gust note** (`src/config/forecastGustNote.ts`,
`FORECAST_GUST_NOTE.sentence`).

Now (113 w):

> The Forecast flag reads the NWS forecast gust for the drop zone. From 2026-04-01 to 2026-10-25, set against KPMV's reports, that gust ran above the reported gust in 62.9% of the 978 gusting hours, the same in 9.5% and below in 27.6%; half the differences were 3 kt or less and nine in ten 8 kt or less (mean +1.5 kt). On reported gusts of 23 kt or more it ran a little low (−0.6 kt on average), and in the 3,884 hours KPMV reported no gust it sat about 6 kt over the steady wind. Counts from one reading (2026-10-27), not a correction: the flag reads the forecast as issued. The comparison.

Proposed (105 w):

> The Forecast flag reads the NWS forecast gust for the drop zone. Against KPMV's reports, 2026-04-01 to 2026-10-25, it ran above the reported gust in 62.9% of the 978 gusting hours, the same in 9.5%, below in 27.6%; half the differences were 3 kt or less, nine in ten 8 kt or less (mean +1.5 kt). On reported gusts of 23 kt or more it ran a little low (−0.6 kt on average); in the 3,884 hours with no reported gust it sat about 6 kt over the steady wind. One reading (2026-10-27), not a correction: the flag reads the forecast as issued. The comparison.

Pins: `tests/surfaceWindRows.test.ts` 176–182 ("978 gusting hours", "half
the differences were 3 kt or less", "not a correction", the href, the
`<p class="muted small forecast-gust-note">` wrapper), 205 ("a little low
(−"). All kept.

**S3 · The Licensed profile's two standing notes** (`SurfaceWindPanel`;
`LICENSED.windGuidance` in `src/config/thresholds.ts`).

Now, the app's note (49 w):

> No published limit for this profile, so there is no band to draw — and no surface-wind flag appears under “Conditions to note” at any speed. The reading is the observation; judging it is yours. You can set your own limit in Settings at the foot of the page.

Proposed (38 w):

> No published limit for this profile: no band, and no surface-wind flag appears under “Conditions to note” at any speed. Judging the reading is yours; set your own limit in Settings (foot of the page) to draw one.

Now, the guidance (73 w; also the first part of all four wind flags on
Licensed with own limits, 414 words between them):

> No USPA ground-wind limit for licensed jumpers — the BSR states maximum ground winds for solo students and then that for licensed skydivers they "are unlimited". Judge it on your canopy, your currency and the conditions, with the S&TA. Whether the load flies is a separate question: takeoff limits come from the aircraft’s operating limitations and the pilot in command, not from USPA: ask the pilot. Source: USPA SIM, Section 2-1 (BSR) ⓘ

Proposed (63 w):

> No USPA ground-wind limit for licensed jumpers: the BSR sets maximum ground winds for solo students and says for licensed skydivers they "are unlimited". Judge it on your canopy, currency and the conditions, with the S&TA. Whether the load flies is the pilot in command's call under the aircraft's operating limitations, not USPA's: ask the pilot. Source: USPA SIM, Section 2-1 (BSR) ⓘ

Pins: `tests/advisories.test.ts` 673–675 ("No published limit for this
profile", "no surface-wind flag appears under", "ask the pilot."),
`tests/ownLimits.test.ts` 90 (the note's opening `<strong>No published
limit for this profile`), 82 ("No USPA ground-wind limit for licensed
jumpers"); `tests/thresholds.test.ts` 283–286 (/pilot in command|PIC/,
/ask the pilot\./, no "N kt"); `tests/forecastAdvisories.test.ts` 125
(contains `windGuidance`, follows the constant). All kept.

Not proposed: the observed line (18 w; the maintainer's 2026-10-30
wording, pinned by `tests/surfaceWindRows.test.ts` 165) and the citation
line (7 w).

### Conditions to note

**F1 · The Student surface-wind flag** (`evaluateAdvisories`;
`STUDENT.windGuidance` + `windBandSentence`).

Now (97 w):

> USPA BSR maximum ground winds for solo students: 14 mph (~12 kt) on ram-air canopies, 10 mph on round reserves. An S&TA or Examiner may waive it, by a written waiver. The band and flag here use 12 kt, the 14 mph figure for ram-air canopies rounded down to whole knots, so below the band nothing on this page flags the lower limit for solo students on round reserves. No student rig at LSPC carries a round reserve (the maintainer, 2026-10-26; confirmation asked on the citations page), so that figure binds no student at this drop zone.

Proposed (82 w):

> USPA BSR maximum ground winds for solo students: 14 mph (~12 kt) on ram-air canopies, 10 mph on round reserves. An S&TA or Examiner may waive it, by a written waiver. The band and flag here use 12 kt, the 14 mph ram-air figure rounded down to whole knots; nothing on this page flags the 10 mph figure. No student rig at LSPC carries a round reserve (the maintainer, 2026-10-26; confirmation asked on the citations page), so it binds no student here.

Pins: `tests/advisories.test.ts` 938–942 (exact band sentence), 388
("10 mph on round reserves"); `tests/thresholds.test.ts` 336 ("An S&TA or
Examiner may waive it, by a written waiver.", kept).

**F2 · The Forecast wind flag** (`forecastWindAdvisories`). It repeats
the whole of F1 after its own sentence.

Now (161 w):

> The NWS hourly forecast for the drop zone, gusts included, is at or above 12 kt, the surface-wind caution, in these hours of the next 12. A forecast, not a reading: the Surface wind flag fires if KPMV reports it. USPA BSR maximum ground winds for solo students: 14 mph (~12 kt) on ram-air canopies, 10 mph on round reserves. An S&TA or Examiner may waive it, by a written waiver. The band and flag here use 12 kt, the 14 mph figure for ram-air canopies rounded down to whole knots, so below the band nothing on this page flags the lower limit for solo students on round reserves. No student rig at LSPC carries a round reserve (the maintainer, 2026-10-26; confirmation asked on the citations page), so that figure binds no student at this drop zone.

Proposed (76 w): the flag's own two sentences, the profile's first
guidance sentence (the figures), and a short pointer to the band; the
waiver mechanics and the round-reserve fact stay on the observed flag
and the Surface wind card, which the flag names.

> The NWS hourly forecast for the drop zone, gusts included, is at or above 12 kt, the surface-wind caution, in these hours of the next 12. A forecast, not a reading: the Surface wind flag fires if KPMV reports it. USPA BSR maximum ground winds for solo students: 14 mph (~12 kt) on ram-air canopies, 10 mph on round reserves. The same 12 kt band as the Surface wind card, which says what it leaves unchecked.

The flag must still stand alone on a calm morning when no observed flag
is listed, which it does: the limit, its source and the pointer are all
in it. The two citations (2-1 H, 2-2) stay, since the first sentence of
the guidance is still 2-1 H's figure; if the 2-2 sentence goes, so should
`windSecondaryCitation` on this flag (`cited(t.windCitation)` only).

Pins: `tests/forecastAdvisories.test.ts` 116 ("The band and flag here use
12 kt" in the forecast flag; change to the new pointer), 125 (own-limit
form contains `windGuidance`; keep by quoting the first sentence only, or
change the assertion to the first sentence).

**F3 · The visibility flag** (`visibilityGuidance`: `VISIBILITY_RULE` +
`visibilityFigure`, `src/config/thresholds.ts`; also the Ceiling & sky
note's "The visibility flag …" clause and A8 on `#citations`).

Now (120 w):

> 14 CFR 105.17 requires at least 3 SM flight visibility below 10,000 ft MSL, and 5 SM at or above it; an exit from this DZ at or above 8,818 ft AGL is in the 5 SM row. This reading is surface visibility from the METAR; the rule is about flight visibility at altitude. This flag holds the surface reading to both rows: 5 SM, the row a full-altitude exit from this DZ is in, and 3 SM, the row a hop-and-pop is in, and says which the reading is under. Hop-and-pop exits at LSPC are well below 10,000 ft MSL (the maintainer, 2026-10-31; confirmation asked on the citations page), so a hop-and-pop is in the 3 SM row throughout.

Proposed (102 w):

> 14 CFR 105.17 requires 3 SM flight visibility below 10,000 ft MSL and 5 SM at or above it; from this DZ an exit at or above 8,818 ft AGL is in the 5 SM row. This reading is the METAR's surface visibility; the rule is flight visibility at altitude. The flag holds it to both rows, 5 SM (a full-altitude exit) and 3 SM (a hop-and-pop), and says which it is under. Hop-and-pop exits at LSPC are well below 10,000 ft MSL (the maintainer, 2026-10-31; confirmation asked on the citations page), so a hop-and-pop is in the 3 SM row throughout.

Pins: `tests/advisories.test.ts` 38–41 (`HOLDS.both`, exact), 780–782
(/3 SM/, /5 SM/, /10,000 ft MSL/), 799–830 (the Ceiling & sky card prints
`The visibility flag ${HOLDS[VISIBILITY_ROW]} `); `HOP_AND_POP_FACT`'s
`sentenceOnCitations` variant for A8.

**F4 · The flight-category flag's guidance** (`FLIGHT_CATEGORY_GUIDANCE`;
also A9's claim).

Now (65 w):

> Standard FAA flight category (AIM 7-1-7) from ceiling and visibility — a label for the weather, not a jump rule. Below VFR, the rules to check are the pilot’s basic VFR weather minimums, 14 CFR 91.155 (by airspace class and altitude), and the flight-visibility and cloud-clearance rule for parachute operations that the Ceiling & sky card cites; that call belongs to the pilot in command.

Proposed (54 w):

> FAA flight category (AIM 7-1-7) from ceiling and visibility: a label for the weather, not a jump rule. Below VFR, check the pilot's basic VFR weather minimums, 14 CFR 91.155 (by airspace class and altitude), and 105.17's flight-visibility and cloud-clearance rule on the Ceiling & sky card; the call is the pilot in command's.

Pins: `tests/advisories.test.ts` 496 (/91\.155/), 500 (/105\.17/, now in
the guidance itself under MVFR too: fine, the flag's `citations` would
then carry 105.17 under MVFR, or the word stays out), 558 (`toBe(FLIGHT_CATEGORY_GUIDANCE)`,
follows the constant). The IFR/LIFR comparison (77 w) is figures and
stays.

Not proposed: the daylight flag (55 w, two authorities quoted as they
state it), the overcast flag (45 w, pinned exact at
`tests/advisories.test.ts` 874–876), the thunderstorm flag (12 w), the
gust-limit flag (21 w).

**A · The empty states and notes** (`AdvisoryPanel`).

Licensed, now (59 w):

> No conditions flagged from the available data. Surface wind is never flagged on the Licensed profile unless you set your own wind limit in Settings — no published source sets one — so read the speed on the Surface wind card. This is not clearance to jump — confirm winds, clouds, and the spot yourself and with the S&TA.

Proposed (52 w):

> No conditions flagged from the available data. Surface wind is never flagged on the Licensed profile (no published source sets a limit) unless you set your own in Settings: read the speed on the Surface wind card. Not clearance to jump: confirm winds, clouds and the spot yourself and with the S&TA.

Pins: `tests/advisories.test.ts` 646–648 ("Surface wind is never flagged
on the Licensed profile", "Surface wind card", "not clearance to jump"),
`tests/views.test.ts` 141. All kept.

Pilots, now (30 w): "Jumper wind limits are not flagged here. The
ground-wind limits for students and the club waiver are on the Jumpers
tab; the observed wind is on the Current conditions card." Proposed
(25 w): "Jumper wind limits are not flagged here. Student and
club-waiver ground-wind limits are on the Jumpers tab; the observed wind
on the Current conditions card." Pins: `tests/views.test.ts` 136 (first
sentence, kept).

The "Edited in Settings" and "Your own limits" notes (about 40 w each)
are short and each sentence is a required disclaimer; not proposed.

### Hourly wind (and the outlook's day legend, the same component)

**H1 · The legend's source line** (`HourlyLegend`).

Now (62 w):

> Limit lines: Student · USPA BSR. Source: USPA SIM, Section 2-1 (BSR) ⓘ. A lower maximum ground wind, 8.7 kt, is published for solo students on round reserves. The limit line is not it. No student rig at LSPC carries a round reserve (the maintainer, 2026-10-26; confirmation asked on the citations page), so that figure binds no student at this drop zone.

Proposed (50 w):

> Limit lines: Student · USPA BSR. Source: USPA SIM, Section 2-1 (BSR) ⓘ. The BSR's 8.7 kt for solo students on round reserves has no line. No student rig at LSPC carries a round reserve (the maintainer, 2026-10-26; confirmation asked on the citations page), so it binds no student here.

Pins: `tests/hourlyChart.test.ts` 248 ("Limit lines: P."), 268 (exact
sentence), 252 (edited form, kept). Follows S1.

### Winds aloft

**W1 · The clock line.** Now (22 w): "Now 2:00 PM. The model steps
hourly, so the table follows the hour nearest the clock and moves on at
half past." The offset bar under the valid time already marks "now" and
prints the gap in words. Proposed (11 w): "Follows the hour nearest the
clock; moves on at half past." The stepped form ("You stepped to this
hour, so the table no longer follows the clock.", 16 w) can stay. Pins:
none found.

**W2 · The method note under the switch.** Now (43 w, "All levels"
view):

> Every level this app samples: the model’s 10, 80, 120 and 180 m winds, and pressure levels every 25 hPa up through this table’s altitudes, seven of them between the ones Mark Schulze’s tool samples. “As Schulze” shows the table built his way.

Proposed (17 w), the levels themselves living in W4d, which lists them
already:

> All levels: every sample this app takes. As Schulze: his pressure levels only, and his Surface row.

And the "As Schulze" view's note (49 w) to the same two lines. Pins: none
found.

**W3 · The standing note under the table.** Now (67 w):

> A model forecast for the DZ, not a measurement. The Surface row is the model’s 10 m wind; the observed wind is under the table and on the Surface wind card. Against Mark Schulze’s tool: same data, but this table also takes samples his does not (the switch above the table rebuilds it his way), and after half past his table is the hour before this one.

Proposed (62 w):

> A model forecast for the DZ, not a measurement. The Surface row is the model’s 10 m wind; the observed wind is under the table and on the Surface wind card. Mark Schulze’s tool reads the same data; this table takes samples his does not (“As Schulze” rebuilds it his way), and after half past his is the hour before this one.

Pins: `tests/windsHour.test.ts` 125–131 (three exact strings: the first
two sentences kept; the third changes).

**W4 · "About these numbers"** (`<details class="aloft-about">`, 464 w
folded). Four paragraphs:

W4a, the comparison with Schulze's tool. Now (171 w):

> Same Open-Meteo data source as Mark Schulze’s Winds Aloft, the popular skydiving winds tool — so if its numbers differ from these, check its stated valid time (it labels forecasts in Z, e.g. “1600Z”) against the one above before assuming the data disagrees: this card follows the hour nearest the clock, that tool the hour in progress, so after half past the two are an hour apart until one of them is stepped with its hour buttons. Even on the same hour the two have shown different forecast runs for a while, up to about half an hour, most often between half past and ten to the hour, while a new forecast run reaches Open-Meteo’s servers one copy at a time and either table can get the old run or the new; if they disagree then, look again later. Its altitudes are AGL, like these, so the two tables are directly comparable; the “MSL” on its page is the ground elevation it looked up, not the scale of its wind table.

Proposed (116 w):

> Same Open-Meteo data as Mark Schulze’s Winds Aloft. If its numbers differ, check its valid time (labelled in Z, e.g. “1600Z”) against the one above: this card follows the hour nearest the clock, his the hour in progress, so after half past they are an hour apart until one is stepped. On the same hour the two can be on different forecast runs for up to about half an hour, most often between half past and ten to the hour, while a new run reaches Open-Meteo’s servers; if they disagree then, look again later. Its altitudes are AGL, like these; the “MSL” on its page is the ground elevation it looked up, not its table’s scale.

W4b, the Surface rows. Now (129 w):

> The two tables’ Surface rows are different winds. Here it is the model’s forecast wind at 10 m (33 ft), the height an airport wind sensor measures; the measured wind is on the Surface wind card. Mark Schulze’s Surface row is not a 10 m wind. His tool draws a straight line between two of the model’s pressure levels (here one the model places below the ground and the next one up) and reads it at ground level. That comes out nearer the wind a couple of hundred feet up, so his row often shows more wind than the 10 m one, most of all at night, when the air near the ground goes calm while the air above keeps moving. The As Schulze view builds it his way.

Proposed (92 w):

> The two tables’ Surface rows are different winds. Here it is the model’s forecast wind at 10 m (33 ft), the height an airport sensor measures; the measured wind is on the Surface wind card. His is a straight line between two of the model’s pressure levels (one below the ground here, the next up) read at ground level: nearer the wind a couple of hundred feet up, so it often shows more wind than the 10 m row, most of all at night. The As Schulze view builds it his way.

W4c, the ground. Now (93 w):

> The two tables also count their altitudes from different ground. This table counts from the field’s published elevation, 1,182 ft. Mark Schulze’s counts from the ground Open-Meteo’s terrain gives at the map pin: 1,181 ft at this dashboard’s point, which the link above opens. So a row of his is about 1 ft lower than the row of the same name in this one. His own list’s pin for the club is elsewhere, in the field south-west of the runway, so his page opened from that list counts from that pin’s ground instead.

Proposed (57 w):

> His altitudes count from Open-Meteo’s terrain at the map pin (1,181 ft at this dashboard’s point, which the link opens); this table counts from the field’s published 1,182 ft, so his rows sit about 1 ft lower. His own list’s pin for the club is in the field south-west of the runway and counts from that ground.

W4d, the interpolation. Now (75 w):

> Each level is linearly interpolated from the model’s winds: at 10, 80, 120 and 180 m above its ground and at pressure surfaces every 25 hPa through this table’s altitudes. A pressure surface comes with its geopotential height, which we convert to ft MSL and interpolate to these AGL altitudes. Direction is interpolated along the shortest compass arc. These are a model forecast for the DZ, not a measured sounding, so treat them as guidance.

Proposed (56 w):

> Each level is linearly interpolated from the model’s winds at 10, 80, 120 and 180 m above its ground and at pressure surfaces every 25 hPa through this table’s altitudes (each surface’s geopotential height converted to ft MSL, then to these AGL altitudes); direction along the shortest compass arc. A model forecast, not a measured sounding.

Pins for W4: `tests/windsHour.test.ts` 115 ("AGL, like these", "Mark
Schulze’s Winds Aloft", "linearly interpolated", "model’s forecast wind
at 10": all kept), 137 (the summary line, unchanged);
`tests/windsAloft.test.ts` 333 (no "Mark Schulze’s <strong>Surface</strong>
row" without a source: the proposed W4b has no bold "Surface" in that
phrase; keep the gate).

**W5 · The NOAA FD fallback note.** Now (74 w):

> Fallback source: Open-Meteo was unreachable, so these levels are interpolated from the NOAA winds-aloft (FD) forecast for OMA (Omaha, ~30 mi from the DZ) — 3/6/9/12k-ft MSL levels, the same bulletin jump pilots brief from. Levels below the bulletin’s lowest (3,000 ft MSL, roughly 1,800 ft above the DZ) are not listed at all, the surface row among them — the bulletin says nothing about them; see the Surface wind card for ground wind.

Proposed (60 w):

> Fallback source: Open-Meteo was unreachable, so these levels are interpolated from the NOAA winds-aloft (FD) forecast for OMA (Omaha, ~30 mi from the DZ), the 3/6/9/12k-ft MSL bulletin jump pilots brief from. It has nothing below 3,000 ft MSL (about 1,800 ft above the DZ), so no row is listed there, the surface row included: see the Surface wind card.

Pins: `tests/windsHour.test.ts` 144 (`<strong>Fallback source:</strong>`,
kept).

**W6 · The collapsed-view line** (17 w) duplicates the toggle button's
"Show more altitudes (more increments, up to 13,000 ft)". Proposed: fold
"(key altitudes to 10,000 ft, LSPC’s usual max)" into the button and drop
the paragraph; saves about 10 words. Pins: `tests/windsAloft.test.ts` 261,
270, 285, 287 (both strings, both profiles). Lowest priority on this card.

Not proposed: the observed line (28 w), "Arrow shows drift direction
(where wind pushes you)." (8 w), the spotting guidance (25 w, sourced,
`tests/windsHour.test.ts` 120).

### Freefall drift / spot

**D1 · The hour note.** Now (37 w): "Worked from the forecast hour
selected on the Winds aloft card, and the table shown there (all levels,
or as Schulze). The buttons here and on that card step the same hour, so
changing either moves both." Proposed (24 w): "Worked from the Winds
aloft card’s hour and table (all levels, or as Schulze); the hour buttons
here and there step the same hour." Pins: `tests/windsHour.test.ts`
170–171 (both sentences exact).

**D2 · The BSR note.** Now (67 w):

> USPA BSR minimum container-opening altitudes: students & A-license 3,000 ft AGL, B-license 2,500 ft, C/D 2,500 ft (waiverable by an S&TA to no lower than 2,000 ft), tandem 5,000 ft. These are floors — deploy above your minimum, not at it. See the USPA SIM §2-1 (BSR); section text last read at uspa.org on 2026-10-08 (the citations page lists every reading) — re-check against the current SIM.

Proposed (37 w), the citation through `SourceLink` like every other
card (its ⓘ carries the reading date; `#citations` lists every reading),
and the app's own instruction dropped (flagged above):

> USPA BSR minimum container-opening altitudes: students & A-license 3,000 ft AGL, B-license 2,500 ft, C/D 2,500 ft (waiverable by an S&TA to no lower than 2,000 ft), tandem 5,000 ft. Source: USPA SIM, Section 2-1 (BSR) ⓘ

Pins: `tests/spot.test.ts` 240 ("B-license 2,500 ft", kept); the
`OPENING_ALTITUDES_WORDING` pieces are unchanged. Check that test for the
`uspaOpeningAltitude` href before changing the link's form.

**D3 · The canopy note.** Now (42 w): "*Canopy drift assumes you don’t
steer (1,000 ft/min descent); you normally fly it out. Rough estimate
only: the winds are a model forecast, and choosing the exit point is the
spotter’s job, not this card’s. Source: USPA SIM, Section 4-7 (Spotting)
ⓘ". Proposed (38 w): "*Canopy drift assumes no steering (1,000 ft/min
descent); you normally fly it out. A rough estimate from a model
forecast; choosing the exit point is the spotter’s job, not this card’s.
Source: USPA SIM, Section 4-7 (Spotting) ⓘ". Pins: `tests/spot.test.ts`
217 (kept), 218 (href).

**D4 · The FD low-level note.** Now (68 w):

> No winds below 2,000 ft AGL — this assumes the 2,000 ft wind all the way down. The source in use has no level under that, so the last 2,000 ft of descent carries that wind rather than a forecast one — the stretch where wind usually changes most. Read the ground wind off the Surface wind card and treat this as the rougher half of the estimate.

Proposed (50 w):

> No winds below 2,000 ft AGL — this assumes the 2,000 ft wind all the way down. The source in use has no level under that, so the last 2,000 ft of descent carries that wind rather than a forecast one; read the ground wind on the Surface wind card.

Pins: none found ("No winds below" is not in `tests/`; the mirror note's
"No winds above" is, `tests/spot.test.ts` 197–199, and is unchanged).

Not proposed: "Deploy opens on 3,000 ft, the BSR minimum for students,
listed below." (12 w, pinned `tests/spot.test.ts` 237).

### Ceiling & sky

**C1 · The key** (`CeilingSkyPanel`, the paragraph after the tables).

Now (182 w, 252 px):

> Each day across, every 3 h, in the drop zone’s time; the dark columns are night there, sunset to sunrise, the same times the night flag uses, a three-hour slot going by its greater part. Sky cover % as a bar and a figure: the NWS forecast’s, Open-Meteo’s cloud cover (OM) as a figure beside it, and the NBM’s. Heights in thousands of ft AGL; “no” = no broken/overcast layer (ceiling) or no layer at all (base); a blank cell is a slot that forecast does not cover or gives no figure for, and a row is left out of a day it has no figure in. The band is the heights, ground to 12,000 ft: the NBM’s lowest base a short bar at its height, its ceiling as cloud above it, the NWS ceiling a line across the column while that forecast runs; a mark on the top edge is a height at or above 12,000 ft, the row has the figure. “hourly” opens the day’s NWS hours, scrolling sideways; today is its hours alone when two slots or fewer remain.

Proposed (136 w), as a `<dl>` keyed by the row labels the tables
already print, so the prose stops naming the rows:

> Each day across, every 3 h, drop zone time; the dark columns are night there, sunset to sunrise, the same times the night flag uses, a slot by its greater part.
> NWS %, NBM %: sky cover, bar and figure. OM %: Open-Meteo’s cloud cover.
> NWS ceil, NBM ceil, NBM base: thousands of ft AGL; “no” = no ceiling (broken/overcast layer) or no layer; blank = no figure for that slot; a row shows only on a day it has a figure in.
> Band: ground to 12,000 ft; NBM base a bar at its height, NBM ceiling the cloud above it, NWS ceiling a line while that forecast runs; a mark on the top edge = 12,000 ft or higher.
> hourly: the day’s NWS hours; today is its hours alone when two slots or fewer remain.

Pins: `tests/ceilingSkyNbm.test.ts` 170 (exact "the dark columns are
night there, sunset to sunrise, the same times the night flag uses",
kept), 219 (exact "today is its hours alone when two slots or fewer
remain", kept), 81 and 223 (`html.indexOf('Each day across')` as the end
of the day-table slice: kept as the opening words, or move the anchor to
a class on the key).

**C2 · The NBM paragraph.** Now (116 w, 182 px):

> The NBM rows are the NWS National Blend of Models’ bulletins for KPMV, read through the relay (hourly, 25 hours; three-hourly, 6 to 72 hours, the bulletin usairnet’s three-day table reads); each bulletin’s cycle is on Data health. Their base is the lowest cloud base whether or not a ceiling is present, a few or scattered layer included, from a blend of models and humidity (MDL’s definition, read 2026-10-26). A column is one bulletin’s: the three-hourly one’s where it has a column there, the hourly one’s base alone before it begins, dotted; the hourly rows’ base is the hourly bulletin’s. A second forecast beside the NWS one, which it can disagree with; neither raises a flag.

Proposed (97 w):

> NBM rows: the NWS National Blend of Models’ bulletins for KPMV, through the relay: hourly (25 hours) and three-hourly (6 to 72 hours, the bulletin usairnet’s three-day table reads); each cycle is on Data health. Base: the lowest cloud base, ceiling or not, few and scattered layers included, from a blend of models and humidity (MDL’s definition, read 2026-10-26). A column is one bulletin’s: the three-hourly’s where it has one, the hourly one’s base alone before it begins, dotted; the hourly rows’ base is the hourly’s. A second forecast beside the NWS one; neither raises a flag.

Pins: `tests/ceilingSkyNbm.test.ts` 91 ("NWS National Blend of Models’
bulletins for KPMV"), 121 ("three-hourly, 6 to 72 hours, the bulletin
usairnet’s three-day table reads"), 131 ("the hourly one’s base alone
before it begins, dotted"). All kept.

**C3 · The comparison in full** (`<details class="sky-compare">`, 134 w
folded). The one-line brief (49 w) stays. Now:

> Each figure is the share of hours a forecast was at or above 5/8 (62.5%), the least a broken layer covers. KPMV is about 11 mi away. On hours it reported a ceiling: NWS 73%; Open-Meteo 77% in the first hours of its runs and 77% a day ahead. With no ceiling: NWS 20%; Open-Meteo 21% and 43%; Open-Meteo’s low-cloud share (below 3 km, in each hour’s tooltip where hovering shows one) 4%. Some no-ceiling hours may have had cloud above 12,000 ft, which the station does not report. Neither forecast was measured at the lead the card shows: NWS from four issuances a day, Open-Meteo at its runs’ first hours and a day ahead. Exactly 0% or 100%: NWS on 1% of hours, Open-Meteo on 51%. Sources: FAA AC 00-45H ⓘ; the comparison.

Proposed (116 w), the percentages in the same order:

> Each figure: the share of hours a forecast was at or above 5/8 (62.5%), the least a broken layer covers; KPMV is about 11 mi away. With a ceiling reported: NWS 73%; Open-Meteo 77% in its runs’ first hours, 77% a day ahead. With none: NWS 20%; Open-Meteo 21% and 43%, its low-cloud share (below 3 km) 4%. Some no-ceiling hours may have had cloud above 12,000 ft, which the station does not report. Neither was measured at the lead the card shows: NWS from four issuances a day, Open-Meteo at its runs’ first hours and a day ahead. Exactly 0% or 100%: NWS 1% of hours, Open-Meteo 51%. Sources: FAA AC 00-45H ⓘ; the comparison.

Pins: `tests/ceilingSkyClouds.test.ts` 99–111 (closed details, the doc
href, the AC 00-45H href, every percentage in that order: all kept).

**C4 · The non-VFR note** (shown under MVFR, IFR or LIFR). Now (325 w):

> IFR: reduced ceiling/visibility. 14 CFR 105.17 bars parachute ops into or through cloud and sets flight visibility and distance from cloud: below 10,000 ft MSL, 3 SM and 500 ft below / 1,000 ft above / 2,000 ft horizontal; at or above 10,000 ft MSL, 5 SM and 1,000 ft below / 1,000 ft above / 1 mile horizontal. The visibility flag holds the surface reading to both rows: […79 words, F3…]. Source: 14 CFR § 105.17 ⓘ. The pilot’s basic VFR weather minimums are 14 CFR 91.155, by airspace class and altitude, for aircraft other than helicopters: […the 110-word `FAR_91155_ROWS`…] 105.17’s table has no airspace column, so the Class G figures do not loosen the parachute operation. Which airspace is over the DZ is on the sectional chart (Pilots tab). Source: 14 CFR § 91.155 ⓘ

Proposed (130 w visible; the rows folded):

> 14 CFR 105.17 bars parachute ops into or through cloud and sets flight visibility and distance from cloud: below 10,000 ft MSL, 3 SM and 500 ft below / 1,000 ft above / 2,000 ft horizontal; at or above 10,000 ft MSL, 5 SM and 1,000 ft below / 1,000 ft above / 1 mile horizontal. The visibility flag holds the surface reading to both rows, as the flag says. Source: 14 CFR § 105.17 ⓘ. The pilot’s basic VFR weather minimums are 14 CFR 91.155, by airspace class and altitude (every row below); 105.17’s table has no airspace column, so the Class G figures do not loosen the parachute operation. Which airspace is over the DZ is on the sectional chart (Pilots tab). Source: 14 CFR § 91.155 ⓘ

with `<details><summary>14 CFR 91.155’s rows, aircraft other than
helicopters</summary>` holding `FAR_91155_ROWS` unchanged (it is also the
citation's `ref` and A9's claim). If the "as the flag says" pointer is
too thin, keep the F3 clause in full (+102 words): the test at
`tests/advisories.test.ts` 823 expects `The visibility flag ${HOLDS} ` on
the card, so that clause stays unless that assertion moves to the flag.

Pins: `tests/advisories.test.ts` 799–830: /into or through cloud/,
/5 SM/, /1 mile horizontal/, both hrefs, /91\.155/, the three row regexes
and /no airspace column/ (all still in the HTML inside a closed details),
`The visibility flag ${HOLDS} ` (see above), `not.toContain('this page
asks')`.

Not proposed: "NWS ceiling forecast ends Sun 8pm; its sky row runs on."
(11 w, pinned `tests/ceilingSkyNbm.test.ts` 194), the brief (49 w), the
usairnet line (20 w).

### 10-day outlook

**O1 · The standing note.** Now (80 w):

> Model forecast for the DZ (daily maxima; wind/gust are 10 m surface values). Dir is the direction the wind blows from, averaged over the day’s hours and weighted by speed: not the direction of the maximum, and on a day the wind swings it can be one it seldom blew from. Tap a day for its hourly breakdown. Confidence drops fast past a few days — use this for planning which days to watch, and check current conditions before jumping.

Proposed (49 w), the last sentence dropped as flagged:

> Model forecast for the DZ: daily maxima; wind and gust at 10 m. Dir: the direction the wind blows from, the day’s speed-weighted mean, not the direction at the maximum, so on a swinging day it can be one it seldom blew from. Tap a day for its hours.

Pins: none found.

**O2 · The gridpoint fallback note.** Now (90 w):

> Fallback source: Open-Meteo was unreachable, so these days are aggregated from the NWS gridpoint forecast (~7 days instead of 10). Sky shows the day’s mean cloud cover, not an icon: a weather icon is the forecasting service’s own reading of its model, this source publishes none, and the cutoffs this app used to derive one from cloud cover and rain chance were its own. Rain chance is in its own column. The first and last days cover only the hours the grid forecast has, for the maxima and Dir alike.

Proposed (53 w):

> Fallback source: Open-Meteo was unreachable, so these days are aggregated from the NWS gridpoint forecast (~7 days, not 10). Sky is the day’s mean cloud cover: this source publishes no weather code, and the app derives none. The first and last days cover only the hours the grid has, maxima and Dir alike.

Pins: none found.

**O3 · The day detail's key** (`HourlyKey`, 312 w folded). The four
category lines are AIM 7-1-7's and stay. Proposed trims:

Flight, the tail after the four lines, now (60 w): "A category describes
ceiling and visibility; it is not a go/no-go. A dash means no category
could be given: the NWS forecasts ceiling and visibility only about a day
and a half ahead, and the table marks the hour they stop. Where only one
of the two is forecast, it can still give MVFR, IFR or LIFR, never VFR,
which needs both." Proposed (51 w): "A category describes ceiling and
visibility; it is not a go/no-go. A dash: no category, since the NWS
forecasts ceiling and visibility only about a day and a half ahead (the
table marks where they stop); with one of the two it can still give
MVFR, IFR or LIFR, never VFR."

Wind, now (59 w) with the station-gust sentence flagged above. Proposed
(24 w): "The direction the wind blows from, then its speed, then “g”
and the gust where the forecast gives one: the NWS forecast’s surface
wind."

Sky, now (47 w). Proposed (30 w): "The NWS forecast’s sky cover, as a
percentage: how much, not how high; a high overcast and a low one read
the same. The flight category does not read it."

Pins: `tests/forecastReach.test.ts` holds the summary only ("Key: what
the columns mean").

### Radar

**R · Three notes into two.** Now (14 + 33 + 13 = 60 w):

> NWS Omaha / Valley (KOAX) WSR-88D — covers the drop zone (~34 mi NNW).
> ◦ marks the drop zone. Its position is derived from the DZ coordinates and the image’s georeferencing, which NWS does not publish — it was measured against county boundaries, so read it as approximate.
> Tap the image for the interactive radar; the loop updates every few minutes.

Proposed (43 w):

> NWS Omaha / Valley (KOAX) WSR-88D, ~34 mi NNW; the loop updates every few minutes. Tap it for the interactive radar.
> ◦ marks the drop zone, placed from its coordinates on an image NWS does not georeference (measured against county boundaries), so approximate.

Pins: none found in `tests/radarPanel.test.ts` for any of these phrases.

### Exit weight & wing loading

**WL · The standing note.** Now (78 w):

> PD’s maximum exit weight for each category on this size; the comparison above uses the Student figure only. Gear is one student rig weighed (about 32 lb); change it for yours. Body weight is not saved. PD gives its Student figures “mainly to help instructors” choose a student’s canopy: which canopy a student jumps is the instructor’s call. Sources: Performance Designs, Navigator Wing Loading Chart (TABLE-0122 Rev.A) ⓘ; Performance Designs, Wing Loading Chart Interpretation (CN-0089 Rev. 0) ⓘ

Proposed (73 w):

> PD’s maximum exit weight per category on this size; the comparison above uses the Student figure only. Gear is one student rig weighed (about 32 lb); change it for yours. Body weight is not saved. PD gives its Student figures “mainly to help instructors”: which canopy a student jumps is the instructor’s call. Sources: Performance Designs, Navigator Wing Loading Chart (TABLE-0122 Rev.A) ⓘ; Performance Designs, Wing Loading Chart Interpretation (CN-0089 Rev. 0) ⓘ

Pins: `tests/wingLoading.test.ts` 74–77 (two phrases, two hrefs, kept);
`tests/simGlossary.test.ts` 263–267 (the note opens "PD’s maximum" and
holds the one `exitWeight` link: kept).

### Pilots tab

**P1 · TAF.** The header note, now (24 w): "Terminal Aerodrome Forecast
for Offutt AFB (KOFF), ~20 mi NNE of the drop zone (KPMV issues no TAF).
Regional guidance, not field-specific to NE69." The subtitle already
reads "KOFF · ~20 mi NNE of DZ". Proposed (14 w): "Terminal Aerodrome
Forecast for Offutt AFB; KPMV issues no TAF. Not specific to NE69."

The decode note, now (85 w):

> Decoded from the text above. Prevailing: the forecast from the start of the period. Temporary: fluctuations lasting under an hour at a time inside the window; only the stated elements change. From: a new prevailing forecast from that time; every element is restated. A blank cell on a change row means that element stays as the prevailing row says. Category is the FAA classification of the row’s ceiling and visibility, a description of the weather and not a jump rule. Source: FAA AIM 7-1-7 ⓘ

Proposed (72 w), the group meanings in `GROUP_WORDS` shortened:

> Prevailing: from the start of the period. Temporary: fluctuations under an hour at a time inside the window; only the stated elements change. From: a new prevailing forecast; every element restated. A blank cell on a change row means that element stays as the prevailing row says. Category: the FAA classification of the row’s ceiling and visibility, a description of the weather and not a jump rule. Source: FAA AIM 7-1-7 ⓘ

Pins: `tests/tafPanel.test.ts` 76 (the blank-cell sentence, kept), 213
and 216–217 (the QNH and temperature sentences, untouched).

**P2 · Nearby METARs.** Now (39 w): "Distances from the drop zone.
Category is the FAA’s classification of each report’s ceiling and
visibility (AIM 7-1-7), withheld where a report has no sky group. Reports
come in every 20 to 60 minutes; this card checks every five." Proposed
(34 w): "Distances from the drop zone. Category: the FAA’s
classification of each report’s ceiling and visibility (AIM 7-1-7),
withheld without a sky group. Reports come every 20 to 60 minutes; this
card checks every five." Pins: none found.

**P3 · Density altitude.** The first note (60 w) quotes the pamphlet
twice and stays. The second, now (76 w):

> Both figures are worked with the National Weather Service calculators’ formulas: the altimeter setting reduced to the station pressure at the field, the pressure altitude from it, then the density altitude. Given the station pressure, temperature and dew point above, the NWS calculator gives the humidity row to within about ten feet (the rows are rounded); the headline is its formula with the temperature in place of the virtual temperature. Source: NWS Density Altitude calculator ⓘ

Proposed: a `<details>` with the summary "How the figures are worked"
(5 w visible) and (69 w) inside:

> Both figures use the National Weather Service calculators’ formulas: altimeter setting to station pressure at the field, pressure altitude from it, then density altitude. From the station pressure, temperature and dew point above, the NWS calculator gives the humidity row to within about ten feet (its rows are rounded); the headline is its formula with the temperature in place of the virtual temperature. Source: NWS Density Altitude calculator ⓘ

Pins: `tests/densityAltitude.test.ts` 184–190 (the two quotes and both
hrefs in the HTML; a closed details keeps them).

**P4 · Sectional.** The traffic note, now (67 w):

> Live air traffic on this chart: adsb.lol → · adsb.fi → Two volunteer networks; if one is down, try the other. Each link asks its map to open over the same sectional, centred on the drop zone. They show only aircraft broadcasting ADS-B (or located by multilateration) within range of their receivers, so an aircraft on neither map may still be there; neither is a traffic service.

Proposed (62 w):

> Live air traffic on this chart: adsb.lol → · adsb.fi → Two volunteer networks; if one is down, try the other. Each opens over the same sectional, centred on the drop zone, and shows only aircraft broadcasting ADS-B (or located by multilateration) within range of its receivers, so an aircraft on neither map may still be there; neither is a traffic service.

The marker note (29 w) stays. Pins: `tests/sectionalPanel.test.ts` 45–46
("neither is a traffic service", "an aircraft on neither map may still
be there", kept), 61 ("marks the drop zone").

### Settings, banner, Data health, footer

**SET · The Licensed paragraph.** Now (79 w):

> What you set here appears in the charts, the Surface wind card and the flags under “Conditions to note” above, each marked as yours. No published source sets a ground-wind limit or gust ceiling for licensed jumpers; leave either empty for none. The visibility row, unedited, is 14 CFR 105.17’s 5 SM row, the higher of the two rows the flag holds the reading to. Saved in this browser; winds and gusts in knots (1 kt ≈ 1.15 mph).

Proposed (70 w):

> What you set here is drawn on the charts and the Surface wind card and flagged under “Conditions to note”, each marked as yours. No published source sets a ground-wind limit or gust ceiling for licensed jumpers; empty means none. Visibility, unedited, is 14 CFR 105.17’s 5 SM row, the higher of the two the flag holds the reading to. Kept in this browser; knots (1 kt ≈ 1.15 mph).

Pins: none found for this paragraph (three phrases checked); the student
paragraph's "Not on a student profile." is pinned (`tests/ownLimits.test.ts`
160) and not proposed (35 w).

**DIS · The banner.** Now (73 w). Proposed (67 w), the four pinned
phrases kept:

> In development: not endorsed or approved by USPA, LSPC, or any licensed professional. Advisory only: it flags conditions and cites guidance; it does not decide whether it is safe to jump. Its cited limits are readings of the sources, not a licensed professional’s sign-off: verify each against its source (the citations page lists them). Confirm conditions with current official sources, the S&TA, and the pilot in command.

And "About the sources" (67 + 16 w), with the stale-date point above,
proposed (79 w):

> The citations to the USPA SIM, the CFRs and the FAA began as AI recollections, first read at their sources on 2026-09-22 and 2026-09-23 (every cited SIM part again on 2026-10-08); the citations page has each source’s last reading, what it says, and what a reading could not settle. The club wind tiers are transcribed from an undated photo of the posted sign. Observations are from KPMV (~11 mi ENE); forecasts and winds are gridded to the drop zone.

Pins: `tests/disclaimer.test.ts` (four banner phrases; in the details:
"2026-09-22 and 2026-09-23", "undated photo of the posted sign", the
station string; all kept).

**Data health**: the Open-Meteo count (56 + 31 w) is a figure-dense
record with five exact pins (`tests/openMeteoUsage.test.ts` 277–285); a
trim would save under 20 words for five assertion changes. Not proposed.

**Footer**: six link lines, 95 w; each blurb could lose a clause, about
25 words in all. Low value; not proposed in detail.

### `#citations` prose

**CIT1 · The intro.** Now (122 w), with the stale date. Proposed
(104 w):

> Each entry is a claim the dashboard makes, what its source says, and what you are asked to settle. The USPA SIM sections were read at uspa.org (the 2026 SIM) on 2026-10-08; each source’s last reading is listed at the end. The club’s wind-limit tiers are a transcription of an undated photo of the sign. A reading is the source as served on one day, not a licensed professional’s sign-off, and knowing a rule is not knowing how this DZ applies it. Rule on each claim, answer its questions, and send them with the button below; they stay in this browser until you do.

(The SIM date and edition come from `SIM_LAST_READ` and `SIM_EDITION`;
the CFR date should come from the reading log or not be named here.)

**CIT2 · The Part B intro.** Now (73 w). Proposed (50 w):

> Two things here are the dashboard’s own, not a source’s. One invented number is still on screen (B1): it triggers nothing and only sets a bar’s length; a glance, not a ruling. And two flags carry a level no source grades (B2): an instructor’s call, with nothing to look up.

**CIT3 · "How each source was read".** Now (about 130 w). Proposed
(117 w):

> Every section a citation links to, and every SIM part quoted here: when last read, in which edition, and how. uspa.org names its online SIM only as the 2026 SIM and revises it within an edition (its change-document list, loaded 2026-10-10, held none for this edition), so each SIM part carries a fingerprint of its text as read that day; a daily check compares the live page with it, and a changed part is read again before its date moves. FAA-P-8740-2 is a copy in a FAASTeam event folder; if the link dies, search for the pamphlet. None of this is a check by a person holding the rating: that is what the answers above are for.

Pins: `tests/citationsPage.test.ts` 111–125 (no history wording: the
proposals use none), 83 (the "How each source was read" heading as a
slice anchor, kept).

## Not proposed

Short already, or every word a required disclaimer: Current conditions
(14 w), Precipitation & storms (18 w), Daylight (18 w), Pilot briefing
links (16 w), the observed lines on Surface wind and Winds aloft, the
"Edited in Settings" and "Your own limits" notes, the flags not named
above, the waiver tiers' guidance (the club's rule and 2-2's are two
sentences by design, `tests/thresholds.test.ts` 330–338), the empty
states ("No hourly forecast available." and the like), and the parity
and wind-errors pages (out of scope: not cards).
