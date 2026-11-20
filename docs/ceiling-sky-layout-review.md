# The Ceiling & sky card's layouts: a review (2026-11-18)

> What came of it, the same day: proposal A was built with B's band as
> its heights row, at the maintainer's word; the four layouts, the
> hourly strip, its toggle, `VITE_THREE_DAY`, `ThreeDayLayout` and
> `NbsDays.tsx` are gone (docs/nbm-lowest-cloud-base.md, "Since
> 2026-11-18 the card is one table per local day"; the rebuild's own
> review is docs/ceiling-sky-rebuild-review.md). The text below describes
> the card as it stood that morning.

The maintainer, 2026-11-18: "I think we need to do more work on the
layouts." This is a look at the four three-day layouts the card could be
built with (`VITE_THREE_DAY`: `days`, `strip`, `horizon`, `continue`;
docs/nbm-lowest-cloud-base.md, "The three-hourly bulletin, three days
out"), as a reader would meet them, and three alternatives drawn as
mock-ups for her to choose from. It changes no code.

The reader it is judged for: a jumper or instructor on a phone at the
drop zone, asking "which of the next three days looks clear, and when
does a low layer come in", and an instructor used to usairnet's
three-day table (docs/usairnet-parity.md: the NBM's three-hourly
bulletin as a plain table, a row per quantity, a column per three hours,
the days across the top). The rule it is judged under: the card flags
nothing and colours nothing as a warning; every figure is printed; the
NBM is a second forecast beside the NWS one, never blended with it; the
night shade is neutral (CLAUDE.md, the first section). Every proposal
below keeps those.

## What was looked at

Four fixture builds, one per layout (`VITE_THREE_DAY=<layout> BASE_PATH=/
VITE_USE_FIXTURES=true npm run build`), each served locally
(`npx http-server@14.1.1 -s`) and loaded in Playwright's Chromium 1194
with the font forced to DejaVu Sans (the GitHub runner's, wider than the
sandbox's Inter; CLAUDE.md, "Verifying UI work"), `timezoneId:
America/Chicago`, and the clock pinned with `clock.install` at two
instants:

- **day**: 2026-11-18T20:00Z, 2 PM Central on a Wednesday; the fixture's
  NBS block then starts at Wed 6pm (19Z cycle) and crosses four local
  dates.
- **night**: 2026-11-19T05:30Z, 11:30 PM Central the same Wednesday; the
  block starts at Thu 3am (04Z cycle) and crosses three.

At 320, 390 and 1280 px, with the longest horizon on the toggle chosen
(36h for `days` and `strip`, 72h for `horizon` and `continue`) and every
sideways strip scrolled to its end, plus the 390 px day view at the
default 12h. Twenty-seven screenshots of the card alone, in
`docs/img/ceiling-sky-<layout>-<width>-<day|night>[-12h]-2026-11-18.png`.
No console error and no sideways page scroll in any of them.

Two things about the pictures before reading them:

- **At 1280 px the card is 347 px wide**, 11 px narrower than at 390:
  the Jumpers grid is `repeat(auto-fit, minmax(280px, 1fr))`, and the
  card takes one cell. So "desktop" is the phone's layout, and nothing
  any layout does uses a wide screen. The 1280 screenshots differ from
  the 390 ones only in where the scroll landed.
- **The weather is the fixture's.** The NWS hourly fixture's sky cover is
  a flat 35% with a 10,000 ft ceiling past its first twelve hours, and
  its ceiling forecast ends about a day out; the NBH fixture is the
  2026-10-24 03Z block (bases 2,000 down to 500 ft overnight), the NBS
  the 2026-11-12 01Z block (one ceiling, 3,500 ft at one slot; bases 2,000
  to 3,700 ft the first day, none the second, 26,000 ft the third). A
  live day with a layer coming in would look different; see "What could
  not be judged".

Measured in the browser (the `days` layout unless named):

| | 320 px | 390 px | 390 px, 12h | 1280 px |
|---|---|---|---|---|
| Card height, `days` | 2,025 px | 1,826 px | 1,744 px | 1,840 px |
| Card height, `strip` | 1,415 | 1,258 | 1,176 | 1,272 |
| Card height, `horizon` | 1,284 | 1,127 | 1,045 | 1,141 |
| Card height, `continue` | 1,286 | 1,129 | 1,047 | 1,143 |
| Day blocks (`days`, 4 blocks) | 770 | 728 | 728 | 728 |
| Notes under the card | 728 | 588 | 518 | 602 |
| Hourly strip at 36h, scroll width / window | 828 / 258 | 828 / 328 | 328 / 328 | 828 / 317 |
| Strip at 72h (`horizon`, `continue`) | 1,428 / 258 | 1,428 / 328 | | 1,428 / 317 |
| Hourly column width (24h, 36h) | 20 px | 20 px | 22 px | 20 px |
| Day-block slot width | 26.5 px | 35.3 px | 35.3 px | 33.8 px |

The strip's figures are 0.55 rem = 8.8 px; the day blocks' 0.58 rem =
9.3 px. The notes run 374 words (`days`, `strip`), 391 (`horizon`) and
401 (`continue`). At the day clock the `days` layout drew four blocks
with 9 of 32 slots empty; at the night clock, three blocks with 1 empty.

Contrast, worked from the stylesheet's tokens (WCAG's formula): muted
figures on the panel 6.5:1, on the night shade 7.3:1; the band's base
fill (`--muted` at 0.35) against its track 1.9:1, on the night rect
1.9:1; the NBS sky bar against its track 3.6:1; the night shade itself
against the panel 1.13:1, and the night slot's track (swapped to the
panel colour) against the day slot's 1.12:1.

## Problems found, in order of weight

### 1. No layout answers the reader's question at a glance

`days` (`ceiling-sky-days-390-day-2026-11-18.png`): the answer is in the
"ceil" and "base" rows, 9.3 px figures, one block per day, 170 px apart,
under a band that mis-draws them (problem 2). To find "when does a low
layer come in" the reader scans four rows of `no no no 3.5 no no` across
four blocks. The sky-cover bars, the one thing the eye lands on, say
nothing about height.

`horizon` and `continue` (`ceiling-sky-horizon-390-day-2026-11-18.png`,
`…-continue-390-day-…`): the three days are reached only by the 72h
option, which makes the strip 1,428 px wide in a 328 px window, four and
a half screens of swiping, with 20 px columns for the first 36 hours and
40 px ones after. The weekday is printed under the first column of each
day only, so after any swipe the visible columns ("6pm 9pm 12am 3am…")
belong to a day the reader cannot see: in the screenshots scrolled to
the end, the only day name in view is "Sat", under the 12am column.

`strip` (`ceiling-sky-strip-390-day-2026-11-18.png`): the second strip
is 23 columns of 40 px, seven in view, the same swipe-and-lose-the-day
problem with a shorter strip, and the 36h hourly strip above it to swipe
as well.

usairnet's table, the one the instructor knows, shows the whole three
days in one eyeful because it is a table of figures and nothing else,
with the days across the top. None of the four does that.

### 2. The heights band draws the clear air, not the cloud

`NbsDays.tsx` fills the base area "from the ground to the base": a
2,000 ft base is a 7 px fill at the bottom, a 26,000 ft base a full
40 px column, and "no layer" nothing at all
(`ceiling-sky-days-390-day-2026-11-18.png`, the Sat Nov 21 block: the
three 26,000 ft slots are the only solid columns in the card; the
clearest slots of the three days are the ones that look overcast). A
reader scanning for dark-means-cloud reads it backwards, and the key
under the block ("the shaded area the lowest cloud base") does not say
which side of the line is cloud.

The band is also too small to read without the figures: 40 px for
12,000 ft is 3.3 px per 1,000 ft, so the Thursday bases of 2.0, 2.4,
2.9, 3.0, 3.1 and 3.7 are fills of 7 to 12 px that differ by a pixel or
two, with one gridline (6,000 ft) to read them against, at 1.9:1 against
their track (the usual floor for a graphic is 3:1). The ceiling tick
(2 px, 12.9:1) is the only clear mark in it, and the fixture has one.
So: the figures are readable without the band (just: problem 3), the
band is not readable without the figures, and what it adds when both
are there is the day's rough shape, drawn upside down.

### 3. The figures are 8.8 and 9.3 px

The strip prints its figures at 0.55 rem (8.8 px) in 20 px columns at
24h and 36h; the day blocks at 0.58 rem (9.3 px) in 26.5 px slots at
320 px. Contrast is not the problem (6.5:1 and better); size is. At
390 px the figures that answer the question, `2.2 2.4 2.9 3.1 3.7`,
differ in one glyph each at 9 px (`ceiling-sky-days-320-day-2026-11-18.png`
is the hardest case: 26.5 px slots, four blocks). The 36h strip at its
end (`ceiling-sky-days-390-day-2026-11-18.png`, top) is twelve columns of
`35` over `—` over `—` at 8.8 px.

### 4. The hourly strip and the day blocks say the same hours twice

At the day clock the strip at 36h runs Wed 2pm to Fri 1am, and the day
blocks Wed 6pm to Sat 12pm, so Wed 6pm to Fri 1am appears in both: once
hourly in 20 px columns with times every third hour, once three-hourly
in 35 px slots with every time. They are different forecasts (NWS with
the NBH base; NBS), which the card says in two notes, but a reader
matching Thu 3am's `3.5` in the block against the strip's `10` for the
same hour has to find the hour by counting columns from "2am". The
card's cost for the two: 1,826 px at 390, 2,025 at 320, of which the
blocks are 728 and the notes 588. The "could the strip and the blocks be
one thing" question has a yes (proposals A and C): both are a grid of
times by quantities, and a day block with an hourly row for the day
under way holds everything the strip does.

### 5. Dashes and empty boxes

Past the NBH's 25 hours the base row is dashes and past the NWS ceiling
forecast's end the ceiling row is dashes: at 36h scrolled to the end
(`ceiling-sky-days-390-day-2026-11-18.png`) 24 dashes in the last twelve
columns, each meaning "no figure", each needing a note to say which
forecast ran out. The `days` layout's first and last blocks draw their
empty slots as outlined boxes, nine of them at the day clock
(`…-days-390-day-…`, Wed's six and Sat's three), the same box a slot
with missing data would get. Blank cells and one line where a forecast
ends say the same thing with nothing to decode.

### 6. Row labels and units

One quantity is spelled five ways in one card: the strip's axis says
`k ft` (the NWS ceiling, unnamed), the block's `12k` and `0`, the row
labels `ceil` and `base`, the notes "thousands of ft AGL", and `no` for
two different absences (no ceiling; no layer). The strip's axis column
begins `%` over `%` with nothing saying the first is NWS and the second
Open-Meteo. `base` is the NBM's but the label does not say so, while in
`horizon` the NBM's ceiling row is labelled `NBM`, so the two NBM rows
read as "base" and "NBM"
(`ceiling-sky-horizon-390-day-12h-2026-11-18.png`). In `continue` the
only mark of a figure being the NBM's rather than the NWS's is italic at
8.8 px (`ceiling-sky-continue-390-day-2026-11-18.png`: the row of `no`
is italic, the earlier `no` upright; nothing a phone reader will see).

### 7. The 12/24/36/72 toggle

In `days` the toggle changes the strip only; the blocks below ignore it,
so it is a control over a third of the card. In `horizon` and `continue`
`72h` is the only way to the three-day data, and it looks like a longer
horizon of the same forecast when it is a different one with wider
columns, a new row and a new note (the notes grow from 346 to 391 words
when it is chosen). The reader who never taps it never sees the three
days.

### 8. The night shade

It reads as night in every screenshot, and it is neutral. Two things
about how it reads. In the day blocks a night slot is a dark column from
the hour label to the base figure, and its track and band are shaded
too, so a base fill at 1.9:1 sits on a night rect at 1.13:1 against the
day beside it: three greys within 2:1 in one 40 px band
(`ceiling-sky-days-390-day-2026-11-18.png`, Wed's 6pm and 9pm slots). In
the hourly strip the shade is behind the figures and around the track,
but the track keeps its own lighter background, so a night column is a
dark frame around a light box and reads as "marked" as much as "dark"
(`ceiling-sky-days-390-night-2026-11-18.png`, top strip). The key
explains both; a shade that runs the full column including the time
label, as the hourly chart's band does, would need no explaining.

### 9. The heading and the titles

The subtitle "now + next 35 h" counts the strip while the card runs to
Sat 12pm. The block's title, "Wed 6pm to Sat 12pm, every 3 h: the NBM's
three-hourly bulletin (19Z cycle), a second forecast", is seventeen
words, and "19Z cycle" means nothing to the reader (Data health has it
for whoever checks). `strip`'s "Next three days, every 3 h" is better
and still names no day.

### 10. The notes

374 to 401 words in seven paragraphs, 588 to 770 px, under a card whose
figures are 9 px: the reader scrolls past more explanation than data.
Three paragraphs each open by naming an NWS product; the meaning of a
dash is given three times; the Open-Meteo comparison is a paragraph and
a `details`. A one-line key and one collapsed "About these forecasts"
would carry the same facts.

### 11. Smaller things seen

- The sticky axis column clips the left overhang of the first visible
  time label once the strip is scrolled: "ipm" for "6pm"
  (`ceiling-sky-strip-1280-day-2026-11-18.png`,
  `…-horizon-1280-day-…`), "lam" for "1am"
  (`…-continue-320-night-…`).
- The heights band's `12k` and `0` axis labels are 9 px against a 40 px
  band and sit beside the "sky %" label with nothing between.
- The day under way gets a block of two slots (Wed 6pm, 9pm at the day
  clock) with a full set of row labels and an empty six-slot run.

## Proposals

Three mock-ups, standalone HTML under `docs/design/ceiling-sky/`,
screenshotted at 390 px with DejaVu Sans into
`docs/img/ceiling-sky-mock-<name>-2026-11-18.png`. Their figures are the
fixture's as the screenshots show them; the yellow italic lines are
annotations, not part of the design. Each keeps the rules: every figure
printed, no warning colour, the NBM in rows of its own, the night shade
the app's neutral one. All three share four changes: one unit, spelled
once in the key ("thousands of ft AGL"); a blank, not a dash, past a
forecast's reach, with one line saying where it ends; no empty boxes;
the horizon toggle gone; the notes as one visible key and one collapsed
block; the subtitle naming the card's reach ("now to Sat 9pm"); and the
night shade across a whole column, time label included.

### A. Day table (`day-table.html`, `ceiling-sky-mock-day-table-2026-11-18.png`)

usairnet's table, with the card's two forecasts kept apart: one table
per local day, eight three-hour columns, the NWS rows first (sky cover
as a short bar and a figure, its ceiling), then the NBM's (sky cover,
ceiling, base), each group headed by its source. It replaces both the
hourly strip and the day blocks: the hourly NWS figures and the NBH base
are reached by opening a day ("hourly"), shown open for today in the
mock. The NWS figures in the three-hourly columns are the hour's own
from the hourly forecast, a pick, not a blend; the NWS block ends with
one italic line where its ceiling forecast ends. Figures 11.5 px, 1,196
px tall at 390 with today open and the annotations in. Costs: the
Open-Meteo cloud-cover row needs a home (a third source group, or the
hourly detail only); the sky bars are small and could go, leaving a pure
table.

### B. Cloud profile (`cloud-profile.html`, `ceiling-sky-mock-cloud-profile-2026-11-18.png`)

The band done the right way up: one 84 px height chart per day (7 px
per 1,000 ft, gridlines at 3, 6 and 9 thousand), the NBM's base a bar
sitting at its height, the NBM's ceiling grey sky from that height to
the top, the NWS ceiling a light tick while that forecast runs, the
night columns shaded through the chart. Sky cover % printed above each
column for both sources, every height printed under the band. A full
column now means overcast, an empty band a clear day, a base above the
band's top sits on its edge with the figure saying 26. 1,018 px at 390
for three days. Costs: four marks need a legend; the day under way would
want hourly columns, so it is a different grid from the other days; the
bars that say "cloud starts here" are small at 3-hour columns.

### C. Day rows (`day-rows.html`, `ceiling-sky-mock-day-rows-2026-11-18.png`)

The card collapsed to one row per day, as the 10-day outlook has: the
day's eight NBM sky-cover figures in a line (night ones shaded), then
its ceiling and base as the figures restated lowest to highest
("ceiling no, except 3.5 at 3am · base 2 to 3.7 all day"), and the row
opens to proposal A's table for that day. 776 px at 390 with one day
open; about 60 px per day closed. This is the one that gives the
reader's question an answer in one screen. Costs: a range is a sentence
the app writes, so its wording needs a rule (lowest, highest, "no", and
the hour of a single exception, nothing else), and the maintainer should
judge whether "ceiling no, except 3.5 at 3am" stays on the figures' side
of the line; it is the same `no` and `3.5` the block prints, in a
sentence, and it is the proposal closest to that line.

Of the three, A is the smallest step from what is built (the data and
rows exist; the band and the strip go), C is A with a collapsed state,
and B keeps a picture for readers who want one and fixes the picture.

## What could not be judged

- **Live data.** The fixture's NWS hourly forecast is flat past twelve
  hours and its NBS block has one ceiling in 23 columns; a day with a
  layer arriving at midday, or an NWS ceiling that disagrees with the
  NBM's for several hours, would test every layout, and the mock-ups,
  harder than this did. The block count (four at the day clock, three at
  night) was seen for the 19Z and 04Z cycles only.
- **A phone's font.** DejaVu Sans is the runner's; a phone's system font
  is narrower, so 320 px is a little less cramped there than in these
  pictures. The sizes in px are the same.
- **Touch.** The strip's full figures per hour are in `title` tooltips,
  which a phone never shows; none of the screenshots shows them either.
- **usairnet's page today.** Its table's form is taken from
  docs/usairnet-parity.md and the 2026-11-12 screenshot described there;
  the page was not fetched for this review, and the talk's
  `usairnet-kpmv.png` shows only its head.
- **The mock-ups at 320 px and in motion.** They were drawn and
  measured at 390 only (no element past the viewport, no sideways
  scroll), and the open/closed states are static.
- **Light mode.** The app has no light theme, so none was checked.

## Files

- `docs/img/ceiling-sky-<layout>-<width>-<day|night>[-12h]-2026-11-18.png`:
  the 27 card screenshots.
- `docs/design/ceiling-sky/{day-table,cloud-profile,day-rows}.html` and
  `docs/img/ceiling-sky-mock-<name>-2026-11-18.png`: the proposals.
- The throwaway Playwright scripts ran from the scratchpad and are not
  kept; CLAUDE.md, "Verifying UI work", has everything they did.
