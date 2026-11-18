# The Ceiling & sky card rebuilt: a review (2026-11-18)

A review of the card as rebuilt in commit 18e449e ("one table per local
day, the heights drawn the right way up"), read against the eleven
problems of docs/ceiling-sky-layout-review.md and against the rule in
CLAUDE.md's first section. It changes no application code. Two readings:
as the reader the earlier review judged for (a jumper or instructor on a
phone asking which of the next days looks clear and when a low layer
comes in), and as a code reviewer of src/domain/skyDays.ts,
src/components/CeilingSkyDays.tsx, src/components/CeilingSkyPanel.tsx,
the `.csd-*` rules in src/styles/app.css and the three tests.

## What was looked at

- **The gates**, in the worktree at 18e449e: `npm test` (94 files, 1,415
  tests), `npm run lint`, `npm run typecheck` and `npm run build` all
  pass.
- **The fixture build** (`BASE_PATH=/ VITE_USE_FIXTURES=true npm run
  build`, served with `npx -y http-server@14.1.1 dist -p 8791 -s`),
  loaded in Playwright's Chromium 1194 at device scale 2 with the font
  forced to DejaVu Sans (the runner's; CLAUDE.md, "Verifying UI work"),
  `timezoneId: America/Chicago`, the clock installed at two instants:
  **day**, 2026-11-18T20:00Z (2 PM Central, Wednesday; the NBS fixture
  then starts at Wed 6pm from a 19Z cycle), and **night**,
  2026-11-19T05:30Z (11:30 PM the same Wednesday; the block starts Thu
  3am from a 04Z cycle). At 320, 390 and 1280 px.
- **The deployed site**, <https://amelia-m.github.io/lspc-weather/>,
  on live data about 19:00Z, at 390 and 1280 px, with the proxy's CA
  public-key hashes passed to `--ignore-certificate-errors-spki-list`
  (CLAUDE.md, "The deployed site in a browser"). The 1280 px load met
  Open-Meteo's shared-address daily limit (one console error, a 429), so
  that card shows the NWS and NBM rows alone, which is itself a state
  worth a picture; the 390 px load had every source. The live-site
  workflow's run on this deploy was still in progress when this was
  written; the run on the commit before it passed.
- **Measured in the browser** (`getBoundingClientRect`,
  `getComputedStyle`, `scrollWidth` against `clientWidth` per cell).
  No page scrolled sideways at any width; the only element past the
  viewport edge is the hourly detail's table inside its own scroller.
  No console error in the fixture build.

Eight screenshots of the card alone, 2x, in `docs/img/`:
`ceiling-sky-rebuild-<320|390|1280>-<day|night>-2026-11-18.png` and
`ceiling-sky-rebuild-live-<390|1280>-2026-11-18.png`.

| | 320 day | 390 day | 1280 day | 390 night | live 390 | live 1280 |
|---|---|---|---|---|---|---|
| Card width | 288 | 358 | 347 | 358 | 358 | 347 |
| Card height, today's hourly open | 2,063 | 1,933 | 1,961 | 1,887 | 1,953 | 1,747 |
| Card height, closed | 1,996 | 1,866 | 1,894 | 1,820 | 1,886 | 1,693 |
| The day tables (`.csd`) | 1,166 | 1,166 | 1,166 | 1,120 | 1,185 | 1,109 |
| Below the tables (notes, sources) | 780 | 651 | 679 | 651 | 651 | 522 |
| Slot column width | 25.8 | 34.5 | 33.1 | 34.5 | 34.5 | 33.1 |
| Hourly detail, scroll / window | 291 / 204 | 291 / 274 | 291 / 263 | 274 / 274 | 339 / 274 | 339 / 263 |

The same at every width: the label column 52 px; the figures 11.52 px
(0.72 rem), the row labels and the y-axis 10.56 px, the time header
11.2 px, the hourly detail 10.88 px; the band 84 px tall (7 px per
1,000 ft) and 206, 276 or 265 px wide. The day blocks at the day clock
run 336 px (today, hourly open), 283, 266 and 248; the night clock's
one-column Wednesday 287. The notes are 127, 95 and 49 words visible
plus 134 collapsed and the 20-word usairnet line: 291 visible, 425 in
all, against 374 to 401 in all before. The live 1280 card is shorter
only because Open-Meteo's row and its comparison note were absent.

## The eleven earlier problems

1. **No layout answers the reader's question at a glance: partly.**
   Scanning down the days now works where the NBM forecasts a ceiling:
   on the live site Saturday morning's band is three dark columns from
   1,200 to 4,800 ft up with the base bars under them, under NBM sky
   cover of 86 and 90 (`…-live-390-…`, the Sat table), and that is the
   low layer coming in, read without the figures. Where the NWS alone
   forecasts a ceiling the answer is a 2 px tick (problem 2 below), and
   the three days are 1,166 px of tables, a screen and a half on a
   phone, so "at a glance" still means scrolling; the one-screen
   answer (the review's proposal C) was not built.
2. **The band draws the clear air: fixed, with two new faults.** The
   base is a bar at its height, the NBM ceiling a fill from it up, the
   band's top 12,000 ft (`…-390-day-…`, Thu 3am; `…-live-390-…`, Sat).
   A full column now means cloud. What it draws wrong is in "New
   problems" 1 and 2: a base from one bulletin inside a ceiling from
   the other, and a ceiling above 12,000 ft that draws nothing.
3. **The figures are 8.8 and 9.3 px: fixed.** 11.52 px in 34.5 px
   columns at 390 and 25.8 at 320; `2.9 2.2 2.2` and `1.4 8` are
   readable at both (`…-320-day-…`). What clips at 320 is the time
   header and the "ends" line, not the figures (new problem 3).
4. **The strip and the day blocks say the same hours twice: partly.**
   The strip is gone. Today's table still shows its four slots and
   then, open under it, the same hours again in the hourly detail: at
   the day clock 2pm, 3pm, 6pm and 9pm appear in both (`…-390-day-…`,
   the Wed block), and the card is taller than the layout that had the
   strip (new problem 5).
5. **Dashes and empty boxes: fixed.** No dash in any table at either
   clock or on the live site; an empty slot is a blank column with no
   time over it (`…-390-day-…`, Sat 3pm to 9pm; Wed before 2pm). What
   remains is a labelled row with nothing in it (new problem 4).
6. **Row labels and units: mostly fixed.** One unit, named once in the
   key; `NWS ceil`, `NBM ceil`, `NBM base` name their source; the band's
   axis is `12k 6 0`. Still: `OM %` is an abbreviation the key never
   expands (the note says "Open-Meteo's cloud cover" and never "OM"),
   the hourly detail's rows are `ceil` and `base` with no source, and
   "no" still stands for two absences, which the key says.
7. **The toggle: fixed.** Gone.
8. **The night shade: fixed.** One column from the time label to the
   base row, the band included, and the key says what it is
   (`…-390-night-…`, Thu 12am and 3am).
9. **The heading and the titles: fixed.** "now to Sat 12pm", and each
   day "Wed Nov 18 · today". "19Z cycle" survives in the NBM note,
   twice.
10. **The notes: partly.** 291 words visible in three paragraphs and
    the usairnet line, with the full comparison collapsed, against
    seven paragraphs before; but 425 words in all is more than before,
    the first paragraph alone is 127 words, and 651 px under the
    tables at 390 is more than the 588 of the `days` layout.
11. **Smaller things: partly.** The sticky-axis clipping went with the
    strip. The axis labels are 10.56 px beside an 84 px band and no
    longer sit next to a "sky %" label, but they mark 12k, 6 and 0 while
    the gridlines are at 3, 6 and 9 thousand, so two gridlines are
    unlabelled. The day under way as a block of one or two slots with a
    full set of row labels remains, and is now a full table with an
    84 px band and a one-hour "hourly" open for one column
    (`…-390-night-…`, the Wed block, 287 px for Wed 11pm).

## The reader's task

- **Which day looks clear, when does a low layer come in.** Yes where the
  NBM forecasts the ceiling (the live Saturday), with scrolling; the
  NWS ceiling is a tick easily missed; and today's answer is split
  between the slot table and the hourly detail.
- **Legible at 320.** The figures yes (11.52 px, no figure clipped). The
  time header no: "12am" and "12pm" are 32 px of text in a 25.8 px cell
  with `overflow: hidden` and render as "12ar" and "12pr"
  (`…-320-day-…`, every day table). The "NWS ceiling forecast ends 8pm;
  its sky row runs on" line is 270 px in a 258 px row and ends "runs".
  "NBM base" measures 57 px in its 52 px cell at every width; in DejaVu
  Sans the last letter sits on the column's edge, and a wider font loses
  it.
- **The band without the figures.** A base bar at its height and the
  NBM's cloud above its ceiling read correctly. The NWS tick and the
  base bar do not tell apart: 2 px of `--sky-cover` against 2.8 px of
  `--muted`, both horizontal, often within 14 px of each other
  (`…-390-day-…`, Thu 9am to 3pm: the tick at 10,000 under a bar on the
  top edge). A base at or above 12,000 ft is a bar on the top edge that
  reads as a layer at 12,000 (`…-390-day-…`, Sat: three such bars for
  bases of 26,000 ft). The cloud fill is `--muted` at 0.35 on the band's
  track, the 1.9:1 the earlier review measured for the old base fill.
- **The figures without the band.** Yes: every figure printed, "no"
  and blank as the key says.
- **The night shade.** Clear, one column, the key names it.
- **Blank cells.** Read as "no forecast here", since no time stands over
  them; a labelled row with nothing in it across a whole day reads
  as missing (new problem 4).
- **The hourly detail.** Useful for today, where the slot table shows
  four of ten hours; for the other days it is closed and a 24-column
  table 660 px wide in a 274 px window. Today's scrolls too (291 or
  339 px in 274) with no visible affordance, and its summary says
  "hourly" with no count.
- **Too long.** 1,933 px at 390 with today open, 1,866 closed; 2,063
  at 320. Taller than every layout it replaced (`days` 1,826,
  `horizon` 1,127 at 390) and than the mock-ups it was built from
  (A 1,196, B 1,018).
- **Labels and key.** The key says each thing once and the row labels
  name their source. The exceptions are in problem 6 above.
- **Does anything grade a slot.** No. One colour per source for the
  bars whatever the amount, one colour per source for the figures, no
  icon, no sky word, "night" a fact, and the test
  `tests/ceilingSkyNbm.test.ts` holds the tables free of a warning
  class. A 1% NWS bar renders as a hairline and a 0% one as nothing,
  with the figure under each (`…-live-390-…`, Wed 12pm).

## New problems, in order of weight

1. **The band draws one bulletin's base inside the other's cloud.**
   src/components/CeilingSkyDays.tsx:56-65: the cloud fill is
   `s.nbs?.ceilingFtAgl` (the three-hourly bulletin) and the bar is
   `baseOf(s)`, the hourly bulletin's where it has a figure. At the day
   clock's Thu 3am the NBS says ceiling 3,500 and base 2,400 while the
   NBH says base 8,000: the band fills from 3,500 ft up and draws the
   base bar at 8,000 inside the cloud (`…-390-day-…`; the night clock's
   Thu 12pm the same). The row under it prints `3.5` over `8`, so the
   figures contradict the picture's own rule ("the base a bar at its
   height, its ceiling as cloud above it") in the one column a reader
   would look at. The base row's source also changes inside a day with
   no mark but a `title` tooltip (CeilingSkyDays.tsx:202, which a phone
   never shows): on the live Thursday the figures to 12pm are the NBH's
   and from 3pm the NBS's. Verified (screenshots, live data).
2. **An NBM ceiling at or above 12,000 ft draws no cloud at all.**
   CeilingSkyDays.tsx:57-60: `height={Math.max(0, y)}` with `yOf` clamped
   at `TOP_FT`, so a ceiling of 12,000 ft or more is a rect of height 0,
   while a base at the same height (line 63) is a bar on the top edge.
   The NBM forecasts such ceilings (the NBH fixture's `CIG` row runs
   13,000 to 24,000 ft, src/api/fixtures/nbm.ts:12), so a day with an
   overcast at 15,000 ft prints `15` in the NBM ceil row over a band as
   empty as a clear day's, and the key's "an empty band under a low
   sky-cover row is the clear day it is" reads it wrong. Verified in the
   code; the scenario is plausible, not seen in these loads.
3. **Clipping at 320 px, and a label on its edge at every width.**
   app.css, `.csd-table th, .csd-table td { overflow: hidden; white-space:
   nowrap }` with `table-layout: fixed` and 25.8 px cells: "12am" and
   "12pm" render "12ar" and "12pr" (`…-320-day-…`, `…-320-night-…`,
   every table), and the `.csd-ends` row inherits the same rules, so
   "NWS ceiling forecast ends 8pm; its sky row runs on" ends at "runs".
   "NBM base" is 57 px in the 52 px label cell (`.csd-lab`, padding
   4 px). Verified by measurement and screenshot in DejaVu Sans; a phone
   font is narrower, and "12am" at 11.2 px is about 27 px in one, still
   over 25.8.
4. **Rows with a label and nothing in them.** CeilingSkyDays.tsx:142-159
   and 180-187 draw the NWS % and NWS ceil rows on every day, and the OM
   row whenever any day has a figure (CeilingSkyPanel.tsx:69), where the
   NBM % and NBM base rows are per day (`anyNbs`, `anyBase`). At the day
   clock Saturday has three labelled empty rows of seven; on the live
   site Friday and Saturday have two each (`…-live-390-…`). The "NWS
   ceiling forecast ends" line is placed only on the day the end falls
   in (skyDays.ts:158-164), so a later day's wholly blank NWS ceil row
   carries no explanation. Verified (screenshots).
5. **The card is taller than any layout it replaced, and the day under
   way can be a full table for one column.** skyDays.ts:124 makes a
   block for every day a time falls on whatever it holds, and
   CeilingSkyDays.tsx:124-221 draws every block with the full row set,
   the 84 px band and the detail: at the night clock Wednesday is a
   287 px table whose only column is 11pm, with "hourly" open on one
   hour (`…-390-night-…`). With today open the card is 1,933 px at 390
   and 2,063 at 320, against the `days` layout's 1,826 and 2,025 and the
   mock-ups' 1,196 and 1,018. Verified by measurement.
6. **The NWS tick and the base bar look alike.** app.css `.csd-nws-ceil`
   (2 px, `--sky-cover` #b3c2d1) and `.csd-base` (4 units, 2.8 px,
   `--muted` #93a1b0): two light horizontal marks of nearly one height
   and colour, told apart by the key's word "lighter". Verified
   (`…-390-day-…`, Thu 9am to 3pm).
7. **`nwsCeilingEnds` misses an end at local midnight.**
   src/domain/skyDays.ts:158-164 looks for the first hour with no
   ceiling forecast after one with, inside one day's `hours`; a forecast
   whose last covered hour is a day's 11pm has no transition in that day
   and none in the next, so no line is printed anywhere. The gridpoint's
   ceiling forecast ends on a UTC hour and 06Z is local midnight in
   Central Standard Time. Verified in the code; plausible.
8. **Names.** `OM %` is never expanded; the hourly detail's `ceil` and
   `base` carry no source where the table's rows do (CeilingSkyDays.tsx:
   233-236), and its `base` is the NBH's alone, so past the NBH's reach
   it is blank for hours the table above gives a base for; the NBM note
   names "the 19Z cycle" twice (CeilingSkyPanel.tsx:161). Verified.
9. **Two claims in the key the code does not keep.**
   CeilingSkyPanel.tsx:154-156: "the NBM's lowest base a bar at its
   height" is not so at or above 12,000 ft (problem 2's clamp, line 63),
   and "a blank cell is a slot that forecast does not cover" is also a
   `-99` field inside the bulletin's reach (`hundredsFt`, src/domain/
   nbm.ts:50, `undefined`), an Open-Meteo hour not served, and a null
   NWS sky cover. Verified.
10. **Today twice, and a scroller without a sign.** The slot table's
    four slots and the open detail show the same NWS, Open-Meteo and
    NBH figures for the same hours; the detail scrolls sideways (291 or
    339 px in 274) with nothing to say so but a cut-off column
    (`…-390-day-…`, "10p 1"); the summary is the one word "hourly".
    Verified (screenshots).

Checked and found sound: the slot rule (the NBS column names the slot's
time where it has one, else the earliest hour any forecast has in it,
the hour under way included; the figures read at that time exactly, the
tests pin it); daylight-saving time (in CDT the NBS columns fall on
local 1, 4, 7, … 22 and the slots, by `floor(localHour / 3)`, are still
one per column; on 2026-03-08 the columns land in slots 0 to 7 with no
two in one, and on 2026-11-01 the 06Z column is 1am CDT in slot 0 and
the 09Z one 3am CST in slot 1, so the 25-hour day fills eight slots and
the 23-hour day too; the day's `hours` then hold 25 or 23 entries keyed
by time); `MAX_DAYS` (the NWS sky cover runs a week, so the cap is what
holds the card to four days, and the subtitle reads the last slot
kept); a day with NBS columns and no NWS hours (no detail, `firstTime`
from the slots) and the reverse (the `nwsOnly` test); `baseOf`
(`!== undefined` keeps the NBH's null as "no", and the test at Wed 3pm
would fail with `??`); the three states in every row, title and the
band (`heightText`, `nwsCeilingText`, the `!= null` guards); keys (slot
index per row, date per block, time per hour, label per detail row);
`<details open={b.today}>` (renders `open=""` under react-dom/server, and
React changes the attribute only when the prop changes, so a reader's
toggle survives a refresh); `preserveAspectRatio="none"` (both strokes
carry `vector-effect: non-scaling-stroke`, the rects scale with the
band as they should, and the SVG holds no text); the hourly scroller
(`position: relative`, no `.sr-only` inside it, and the live-site width
rule reads the document's `scrollWidth`, which equals the viewport).

## Recommendations

1. Draw each band column from one bulletin: where the slot has an NBS
   column, its base and ceiling; where it has none, the NBH's base
   alone; and mark in the base row itself, not a tooltip, where its
   figures change source (a thin rule between the cells, or the NBH's
   figures only in the hourly detail).
2. Give a ceiling at or above 12,000 ft a mark on the top edge as a base
   there gets, and say in the key that a mark on the edge means at or
   above 12,000 ft (or raise the band's top to the NBM's reach and label
   it).
3. Let the time header shorten at narrow widths as the hourly detail
   does ("12a", "12p"), let the "ends" row wrap, and widen the label
   column to fit "NBM base" in DejaVu Sans with room to spare.
4. Draw a row only on a day that has a figure in it, as the NBM rows
   already are, and put one line under the tables naming where the NWS
   ceiling forecast ends (day and hour), so a later day's missing row
   needs no explaining; name the end even when it falls at midnight.
5. When the day under way has one or two slots left, show its hourly
   detail alone and start the tables at tomorrow; and make the NWS tick
   a different shape from the base bar (a short vertical mark, or the
   tick spanning the column's full width with the bar narrower), with
   the key saying which is which.

## Files

- `docs/img/ceiling-sky-rebuild-<320|390|1280>-<day|night>-2026-11-18.png`,
  `docs/img/ceiling-sky-rebuild-live-<390|1280>-2026-11-18.png`: the
  eight card screenshots, 2x.
- The Playwright script ran from the scratchpad and is not kept;
  CLAUDE.md, "Verifying UI work", has everything it did, and the
  measurements are in the table above.
