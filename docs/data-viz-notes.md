# Data-visualisation notes for the dashboard

> Read before the card was rebuilt later the same day: the `days`
> layout these notes favour became one table per local day with the
> heights band drawn the right way up, the hourly strip, its toggle and
> `crossesDay` went, and the day tables' figures are 0.72 rem
> (docs/nbm-lowest-cloud-base.md, "Since 2026-11-18 the card is one
> table per local day"). The sizes, classes and layouts measured below
> are the card's as it stood that morning.

Read and written 2026-11-18, for the Ceiling & sky card's three-day
layouts (docs/nbm-lowest-cloud-base.md, "The three-hourly bulletin, three
days out"; docs/open-questions.md, "Reach the NBM's three-day bulletin",
then open: which layout stays) and, in brief, the other charts. Everything
here is held inside the card's rules (CLAUDE.md, the first section): no
verdict, no threshold or colour or word the sources do not set, counts
and figures and never a grade. Where a source would say to colour a
figure by its value, summarise a day with a word or an icon, or band a
scale, the note says so and says it is out.

**How each source was read.** The sandbox's network is an allowlist
(CLAUDE.md, "What can and cannot be verified from a sandbox"), so most of
the literature could not be opened from here. For each source the notes
say one of three things: *read* (the page or file was opened and read
today, 2026-11-18); *search summary* (only a WebSearch result's summary
of the page, the page itself on a host the allowlist does not reach; the
wording is the summary's, not checked against the page); or *the skill*
(the bundled `dataviz` skill's reference files, read in full today:
`choosing-a-form.md`, `color-formula.md`, `marks-and-anatomy.md`,
`interaction.md`, `anti-patterns.md`, `palette.md`, and its
`validate_palette.js`, which was run on the app's colours). The last
section lists what was not read.

## Principles, with their sources

### 1. Position on a common scale is read most accurately; length next; area, angle and shading worse

Cleveland and McGill, "Graphical Perception: Theory, Experimentation, and
Application to the Development of Graphical Methods", *JASA* 1984
(search summary; the paper is not on a reachable host): ten elementary
perceptual tasks, ranked by the accuracy of the judgement they support,
position along a common scale first, then position on non-aligned
scales, length, angle and direction, area, volume, shading and colour
saturation. Heer and Bostock, "Crowdsourcing Graphical Perception", CHI
2010 (search summary) replicated the position and length experiments on
Mechanical Turk and found the ranking held. Later work (Hollands and
Spence; Yuan et al., both search summary) found it does not hold for
every task, in particular comparisons of averages across several marks.
Nielsen Norman Group, "Dashboards: Making Charts and Graphs Easier to
Understand" (Laubheimer, 2017; search summary) restates it for
dashboards: 2D position and length are the two preattentive attributes
that map onto quantity, so line and bar charts read quickly, and gauges,
pies and radar charts, which rely on area and angle, do not.

The skill agrees ("Compare magnitude: bar/column", "Trend over time:
line", and the ban on gauges and donuts).

What it means here: a bar on a 0 to 100% track (sky cover), a tick at a
height on a 0 to 12,000 ft scale (ceiling), and a printed figure, are
the forms this ranks highest. A filled area whose *top edge* is the
quantity is still a position judgement, but the fill under it invites
an area reading, and area is low on the list.

### 2. Tables are for looking up individual values; graphs are for the shape of the data

Few, *Show Me the Numbers* (2004; search summaries of secondary notes
and a 2012 workshop handout that cites it): tables when the display will
be used to look up individual values, compare individual values, or when
precise values are required; graphs when the message is in the shape of
the data, patterns, trends and exceptions. Nothing here was read in the
book itself.

What it means here: the reader acts on figures (a ceiling against the
opening altitudes of BSR 2-1 I, a base against the altitude of the next
load), so the figures must stay printed, and a bar or band beside them
is for the shape of the day, when it clears, when it closes in. The card
already does both. The skill's "never a number on every point" rule
(`marks-and-anatomy.md`) is the one place it and this card part: under
the card's rules a figure is the only checkable thing on the page, and
both local conventions (section 11) print every one.

### 3. Small multiples: the same design repeated, at the same scales, within the eye's span

Tufte, *Envisioning Information* (1990; search summary of a UXmatters
article quoting it): small multiples are slices of information that
repeat a common design within the eye span, each showing different data
values, with a constant frame of reference (size, colour, type) while
the data change. Brehmer et al., "A Comparative Evaluation of Animation
and Small Multiples for Trend Visualization on Mobile Phones", IEEE VIS
2019 (search summary of the arXiv abstract): on phones, with 96
crowdworkers, small multiples beat animation on time in seven of nine
trend tasks without losing accuracy (scatterplots, not time series).

The skill's `choosing-a-form.md` reaches for small multiples wherever a
second axis or too many series would otherwise appear.

What it means here: the `days` layout is a small-multiple design, one
block per local day, and its strength is that the eight slots are by
local hour, so the same clock hour sits in the same column of every
block and a reader scans *down* the card to compare the same hour across
days. Keep every block identical: the same row order, the same 0 to 100%
and 0 to 12,000 ft scales, the same column grid, empty leading slots
drawn rather than collapsed. The three strip layouts have no such
alignment: a time-of-day in a 23-column scroller is wherever the
bulletin's cycle put it.

### 4. Erase non-data ink, within reason; and its critics

Tufte, *The Visual Display of Quantitative Information* (1983; search
summaries): the data-ink ratio is the share of a graphic's ink that
carries data; the principles run "above all else show the data",
"maximize the data-ink ratio", "erase non-data-ink", "erase redundant
data-ink", "revise and edit". The critics: Bateman et al., "Useful
Junk?", CHI 2010 (search summary) found Holmes-style embellishment did
not hurt comprehension and helped recall after two weeks, in a small
study (20 people, a few charts) that did not measure reading values off
the chart. Inbar, Tractinsky and Meyer, "Minimalism in information
visualization: attitudes towards maximizing the data-ink ratio", ECCE
2007 (search summary): people preferred Tufte's own non-minimal bar
chart to his stripped one. Few, "The Chartjunk Debate", 2011 (search
summary): agrees with Tufte in substance, finds his definition of junk
too loose, and allows that redundant encoding (a bar *and* its figure)
can be useful; recall of an embellished chart matters only to the degree
it conveys the message. NN/g, "Clutter-Free: One of the 3 Cs for Better
Charts" (Moran, 2022; search summary): direct labels on the series are
easier to process than a legend, and fewer gridlines make them easier
still.

The skill sits with Tufte and Few: hairline recessive gridlines, no
border drawn around a mark (a 2 px surface gap separates fills), labels
in text tokens, a legend only for two or more series.

What it means here: the card's redundancy (bar plus figure) is the kind
Few defends, and it is load-bearing under the rules (section 2). The
non-data ink worth weighing is the chrome around the data: the outlined
track boxes around every slot's sky bar and band, the 1 px borders, the
50% gridline. The outlined track was chosen so that an almost-clear slot
still shows as a column with little in it (CeilingSkyPanel.tsx, the
Open-Meteo track comment), which is a reason; the skill would draw the
same "none" state with a lighter track fill and no stroke.

### 5. Colour does one job, and never carries a value this card may not assert

The skill's `color-formula.md`: every colour does one of four jobs,
categorical (identity), sequential (magnitude, one hue light to dark),
diverging (polarity, two hues and a neutral midpoint) or status (state,
reserved, always with an icon and a label); text never wears a series
colour; never a value ramp on nominal categories. Few, "Practical Rules
for Using Color in Charts", 2008 (search summary): use colour only to
serve a particular communication goal; dark fills defeat the labels on
them; red and green together fail colour-blind readers. WCAG 1.4.1 Use
of Color (search summary of the W3C Understanding page; w3.org is not
reachable): colour is not the only visual means of conveying
information; failure F13 is a chart that conveys information by colour
without a text alternative carrying the same information.

Where the skill and the card's rule differ: the skill would allow a
*sequential* ramp on the sky bars (more cloud, darker), since magnitude
is a legitimate colour job. The card's rule forbids it: a bar painted by
its value is "a number is not the only way to assert something"
(CLAUDE.md), and the height of the bar already is the value. The skill's
own anti-pattern "a value-ramp on nominal categories" makes the same
point for a different reason. So: one hue per source, never per value,
as the card does; and the skill's status rule says the same thing the
card's rule does, that a warning colour is reserved for a sourced flag.

The validator, run today on the app's dark tokens against the panel
colour `#171c24`: the two series hues the parity and wind-errors pages
use, `--accent #4aa8ff` and `--accent-2 #d65db1`, pass CVD separation
(worst pair ΔE 11.8 deutan, target ≥ 8), the normal-vision floor (24.7,
floor 15) and 3:1 contrast; the wind and gust lines' `#4aa8ff` and
`#ffb454` pass the same (26.0 and 31.5). Both pairs sit above the
skill's dark-mode lightness band (OKLCH L 0.48 to 0.67; these are 0.72
and 0.82), which is a note on the skill's palette, not a fault: the
band exists to keep eight hues apart, and these are two. The greys the
Ceiling & sky card uses for every source (`--muted #93a1b0`,
`--sky-cover #b3c2d1`) fail the chroma floor by design: they are not
meant to carry identity by hue, and the validator says so ("reads
gray"). Identity on that card is carried by position, track shape and
the row label, which is the secondary encoding WCAG 1.4.1 asks for
anyway.

### 6. Contrast and size: WCAG's ratios, and the outdoor phone

WCAG 2 SC 1.4.3 Contrast (Minimum), level AA (search summaries; the W3C
page is on an unreachable host): 4.5:1 for text, 3:1 for large text,
where large is 18 pt (24 px) or 14 pt (18.66 px) bold; 16 px is not
large. SC 1.4.11 Non-text Contrast (search summaries of the Understanding
page and of Calgary's and the USDA's test procedures quoting it): 3:1
for graphical objects required to understand the content, the lines of a
line graph and the slices of a pie among the examples, and excluded
where visible text gives the same information (the pie with its values
printed). SC 1.4.4 Resize Text: to 200% without loss of content or
function. The W3C Understanding documents were not read; the figures
are the ones every summary agrees on.

NN/g, "Low-Contrast Text Is Not the Answer" (search summary): at least
8 pt, and low-contrast text is especially hard on a phone outdoors in
sun. NN/g, "Typography for Glanceable Reading: Bigger Is Better"
(search summary of an MIT AgeLab study it reports): for text read at a
glance, bigger is better whatever dimension is increased, and small
sizes make lowercase slower. NN/g, "Legibility, Readability, and
Comprehension" and "Inclusive Design" (search summaries): a reasonably
large default, and a way for the reader to make it larger. The Apple
HIG and Material minimums (11 pt and 12 sp are often quoted) could not
be confirmed in any primary page the search returned, so they are not
relied on here.

Measured today with the skill's `contrast()` on the app's tokens:
`--muted` on `--panel` 6.49:1, on `--panel-2` 5.78:1, on the page
background 7.17:1; `--text` on the panel 14.5:1; the `--sky-cover` fill
on the panel 9.4:1; the muted sky bar on its `--panel-2` track 5.8:1;
the gust line's amber on the panel 9.7:1; the VFR pill's dark text on
green 7.4:1. Every text and mark colour clears 4.5:1 and 3:1. The
`--border` gridlines (1.3:1) and the `--panel-2` tracks (1.1:1) do not
clear 3:1 against the panel, and need not: the figures beside them give
the same information, which is 1.4.11's exemption. The card's weak point
is not contrast but size: at the 16 px root the strip's figures are
0.55 rem = 8.8 px, the day blocks' 0.58 rem = 9.3 px, the hourly chart's
axis text 8 SVG units, which a 340-unit chart scaled into a 320 px phone
renders at about 6 px. All three are under NN/g's 8 pt (10.7 px) floor.
A reader can zoom (1.4.4 is met: the day grid reflows, the strip
scrolls), but a reader outdoors deciding at a glance will not.

### 7. Night on a time axis: a band behind the data, sunset to sunrise, in local time

The NWS Hourly Weather Graph for the drop zone's point
(forecast.weather.gov, `meteograms/Plotter.php` at 40.9505, −95.9178;
the 800 × 870 PNG fetched and read today, 16:06Z): every panel shades
its night hours as a grey vertical band behind the data, from about
sunset to about sunrise, with the date across the top and a time under
every third hour across the bottom. weather.gov, "Hourly Weather Graph"
(read, WebFetch): "Times are across the bottom, the date is across the
top, and the temperature scale is along the left side"; 48-hour windows,
out to seven days. meteoblue's sunshine-duration and meteogram help
pages (search summaries; the host is not reachable): white background
is daylight and dark is night, from sunrise to sunset; point meteograms
in local time. An R night-shading helper's documentation (search
summary) adds the practical rule: draw the shading after the frame and
before the data, so it never obscures a point.

What it means here: the card's shading (since 2026-11-18, docs/img/
ceiling-sky-night-2026-11-18.png) is the convention exactly, and the
day blocks shade a three-hour slot by its greater part and say so in
the key. Nothing to add; in particular no sun or moon glyph on the day
blocks, where the block's heading already names the day and the shade
names the night.

### 8. Bar, area or band for a quantity with a "none" state

The guides (an Atlassian chart guide, storytellingwithdata, FlowingData;
search summaries) agree on three things: bars and areas start at zero
(an area that does not is visually misleading); bars suit a small
number of discrete time points where exact values matter, lines or
areas a long series; and a single-series area is usually the wrong
choice, a bar or line is better. Cleveland and McGill (section 1) are
the reason: a bar's length and the top edge's position are read
accurately, an area's size is not.

What it means here, in two parts. Sky cover at three-hour steps: bars,
as drawn. Cloud height: the quantity is a height above the ground, and
"no layer" is not zero (zero would be cloud on the ground), so neither a
zero-based bar nor an area has a natural "none". The band draws nothing
for "no", which is right, and nothing for "no figure" too, which the
band alone cannot tell apart; the printed row under it does ("no"
against "—"). That is the second reason the figures are load-bearing.
The remaining question is the *sense* of the fill, taken up in the
card section below.

### 9. Two forecasts of one thing, side by side, without saying which is right

WMO, *Guidelines on Communicating Forecast Uncertainty*, WMO/TD-No.
1422 (PWS-18, 2008; search summaries; the PDF is on an unreachable
host): communicate uncertainty rather than hide it, manage expectations,
and show how forecasts have verified. NCEP's description of its
ensemble spaghetti plots and the stamp-plot practice (search summaries):
each member drawn in full, a mean and spread shown *separately*, never a
member promoted as the answer; a 2017 study reported in a decision-
science paper (search summary, truncated, unverified) found weather
readers preferred to see the suite of forecasts side by side.

The skill: one axis, never two scales on one plot; colour follows the
entity, so a source keeps its mark whatever is filtered; small
multiples where a second axis would otherwise appear.

What it means here: the card already does the hard part. The NWS and
Open-Meteo sky bars share one 0 to 100% track per hour; the NBM's day
blocks use the same 0 to 100% and 0 to 12,000 ft scales as the hourly
strip; the comparison against KPMV is counts (the share of hours each
reached 5/8), not a grade; and every second forecast is named as one
and "never blended". One thing the card asserts by weight rather than
words: the NWS bar is wide and solid, Open-Meteo's and the NBM's narrow
and outlined, so the eye takes the NWS as primary. That is a choice (the
NWS gridpoint is the forecast the ceiling row and the strip's hours are
built on), and it is defensible, but it is the card saying something,
and a reader who weighs the comparison figures the other way might
prefer them equal. Worth saying in the key, if the weighting stays.

### 10. The phone: one thing per screen, and nothing gated behind hover

NN/g (search summaries): mobile dashboards keep one entry point on the
screen and push detail a tap away (progressive disclosure); users sweep
the top first, then down the left; a `title` tooltip is nothing on a
phone. Few, *Information Dashboard Design* (2006; search summaries): a
dashboard fits one screen, monitored at a glance, because of working
memory; he distinguishes it from a "faceted analytical display" and
from lookup reports. (By his definition this card is the second kind,
and its length is its citations and keys, which the rule requires.)
An Observable essay on small spaces (search summary): panning a dense
series is acceptable on a phone, and a block that fits the width is
better.

The skill's `interaction.md`: tooltips enhance and never gate; every
value is reachable by a direct label or a table view; hit targets bigger
than the mark. The card prints every value, so its `title` text is a
courtesy for a pointer, as its comments say.

### 11. How the local and aviation conventions lay it out

- **The NWS Hourly Weather Graph** (read, section 7): stacked panels,
  one per group of elements; each series in its own colour with its
  figure printed at *every* point, in the series colour; sky cover as a
  line on a 0 to 100% axis in the humidity/precipitation panel; the
  precipitation-type panels as rows of words (Ocnl, Lkly, Chc, SChc)
  with a mark where one applies; night grey; dates across the top, a
  time every three hours across the bottom.
- **usairnet's KPMV page** (read today with curl and WebFetch, the
  layout the card links to as the local convention): a table, "DATE
  VALID TIME" as a row of day headers across the top, "HOUR UTC" every
  three hours under it, one row per element down the left ("Sky
  conditions Cloud cover", "Ceiling Feet AGL", "Lowest cloud base Feet
  AGL", "Flight category Ceiling + visibility", …); every cell a figure
  as text; sky cover as a word and a percentage in one cell ("Mostly
  clear 16 %"), ceiling as "Unlim." or a figure; flight categories as
  words with a category colour (its stylesheet has `category-badge
  vfr`/`mvfr` and `legend-dot` classes); a "Your flying conditions"
  panel of the reader's own limits, with the warning "Supplemental
  guidance — not a go/no-go decision" and "Favorable symbols and phrases
  only reflect your selected limits". Its sources are the NBH and NBS
  bulletins, the ones the card's base row and day blocks read.
- **aviationweather.gov's GFA** (read, WebFetch): ceiling and visibility
  drawn by flight category on published thresholds (ceiling 100, 300,
  500, 700, 1000, 2000 ft AGL; visibility 0.25, 0.5, 1, 2, 3, 4 SM), sky
  cover as FEW/SCT/BKN/OVC below FL180, cloud base and top in hundreds
  of feet MSL. The flight-category colours are the published aviation
  convention the card's observed-category pill already uses.
- **The NDFD metadata page** (read, WebFetch): sky cover is "the
  predicted percentage of the sky that will be covered by opaque clouds
  at a given time", a percentage. It gives no mapping from percentages
  to words, so usairnet's "Mostly clear" is a mapping read nowhere from
  here (section 12).
- **WMO**: *Guidelines on Graphical Presentation of Public Weather
  Services Products*, WMO/TD-No. 1080 (PWS-4), has chapters on tables
  and tabulated data and on the content of graphical products, and
  *Examples of Best Practice in Communicating Weather Information*,
  WMO/TD-No. 1409, commends good use of icons; WMO-No. 485 (Manual on
  the GDPFS) Appendix II.4 is the standard for plotted symbols. All
  three are search summaries of tables of contents; none was read, and
  nothing in this note rests on them.

The convention, then, on both the forecaster's graph and the pilot's
page: time across, elements down, a figure in every cell or on every
point, night shaded, three-hour columns, the day named above. The
`days` layout is that table with a bar row and a height band added to
each day; the strips are the same table scrolled.

### 12. Where a source suggests something the rules keep out

- **Words for sky cover** (usairnet's "Mostly clear 16 %"; NWS's own
  forecast text uses the same words). A one-word label asserts as much
  as a sentence (CLAUDE.md). If the NWS's percentage-to-word mapping
  were read and cited, the word would be a sourced figure's name, not
  the app's; even so the percentage is printed, the reader acts on the
  figure, and the word adds a category to check that nobody needs. Out.
- **Colouring forecast cells by flight category** (usairnet's `cat-mvfr`
  cells; the GFA's map). The category of an observation is a published
  derivation the card already shows. A *forecast* category per slot
  would be the app's derivation from the NBM's ceiling with no forecast
  visibility beside it, the "derived sky verdict" the rules removed. Out.
- **A sequential ramp on the sky bars** (the skill would allow it as a
  magnitude colour). Out: a figure in a colour by its value.
- **An icon per day** (WMO/TD-No. 1409's praise of icons; Bateman's
  memorable embellishment). A sun or a cloud over a day is a one-word
  summary in a picture. Out, except the hourly chart's sun and moon,
  which name the day and night spans the band already draws and carry
  no weather.
- **Status colour on a series** (the skill reserves status colours). The
  card uses none; the hourly chart's gust line is in `--watch`'s amber,
  noted below.

## Applying them to the Ceiling & sky card and its three-day layouts

Against the screenshots of 2026-11-12 (the four layouts) and 2026-11-18
(the night shading), the fixture build at 390 px.

**Which layout the principles favour: `days`.** Three reasons, each
sourced above. Small multiples with aligned columns (3) let a reader
compare the same hour across days by scanning down, which a 23-column
scroller cannot. It is the aviation table's orientation (11), elements
down and time across, with the day named over each block, so a reader
of usairnet's page meets the same shape. And it fits the width (10),
with 36 px a slot at 390 and 27 at 320 against the strips' 36 px
columns behind a scroll. The `continue` layout has a further cost: it
tells two sources apart within one row by lighter italic type alone,
which is the identity-by-one-cue that section 5 argues against, even
though the row is labelled. The `horizon` layout's extra "NBM" row and
the `strip` layout's second scroller are honest but add a second place
to scroll to.

**The figures are too small for the reader the card is for (6).** The
day blocks' 0.58 rem figures render at 9.3 px, under every floor the
summaries agree on, and the reader is outdoors. The `days` grid has the
room the strip lacks: a three-character figure ("3.5", "no") in a
0.72 rem (11.5 px) tabular face is about 22 px wide in DejaVu Sans
(its digits are about 0.64 em) against a slot of roughly 27 px at 320,
so it fits, and "12am" at four characters is the one to measure. Raise the day blocks' type first (the
`.nbs-grid` size), measure with the runner's font as CLAUDE.md
describes, and leave the hourly strip's 0.55 rem alone until a wider
column is affordable: its columns are as narrow as the stylesheet's
flex basis lets them be, with three figure rows in each, and NWS's own
graph is no better at this width. The hour labels in the day
blocks ("12am", "3am") are 9.3 px too and can grow with the figures.

**The heights band reads in the opposite sense to the sky bar (1, 8).**
One row up, more fill means more cloud. In the band, the base is a
filled area from the ground to the base, so more fill means a *higher*
base, which is the jumpable sky, and a reader who has just learned the
first sense meets the opposite one. Two forms stay inside the rule that
the band is a picture of the printed figures and adds none:

- draw the base as a position mark, a tick like the ceiling's (a second
  stroke or a dashed one, named in the key), which Cleveland and McGill
  rank above area anyway; the "no layer" slot then draws nothing, as
  now, and the printed "no" says why; or
- keep an area but fill *above* the base, from the base to the top of
  the scale, which is where the cloud is, so both rows read "fill is
  cloud". The fill then stands for "a layer starts here", not for
  cover, and the key would have to say so, since a FEW layer's base
  would fill as much as an overcast's.

The first is simpler and asserts less. Either way the 50% gridline at
6,000 ft and the "12k / 0" scale stay, since the printed figures are in
thousands and a reader checks a tick against a scale.

**Name the source on the rows, not only in the heading (5, 9).** Each
block's left column says "sky %", "ceil", "base"; the bulletin's name is
in the title line above the first block and in a paragraph well below
the last. A reader who scrolls into the third block sees rows with no
source. "NBM" once per block in the left column (or the block heading
carrying "NBM" beside the date) keeps the second forecast labelled
where it is read. Text, not a colour.

**Keep the outlined tracks, or lighten them, but do not drop the
"none" state (4, 8).** The skill would replace the 1 px track borders
with a lighter track fill and a 2 px gap, and the eye would lose a
little chrome. What must survive is that an empty slot and a slot with
a 2% bar look different from a slot the bulletin has no figure for: the
printed "—" does that, and the track does it at a glance.

**Equal weight, or say which is primary (9).** On the hourly strip the
NWS bar is the wide solid one and Open-Meteo's the narrow outlined one.
If that stays, one clause in the key ("the NWS bar is drawn wider
because the strip's hours and ceiling row are its") turns a weighting
the reader might take as a ranking into a stated reason.

**Nothing to add on night (7).** The shading matches the NWS graph and
meteoblue; the key says a slot goes by its greater part.

**Nothing the key should gain from the conventions (11, 12).** No words
for cover, no category colour on forecast slots, no icon per day.

**What the hourly strip's 36 h option can learn from the NWS graph
(7, 11).** The graph names the date across the top at every midnight;
the strip prints the weekday under the first hour of a new day
(`crossesDay`). The same thing, and enough.

## The other charts, in brief

- **Hourly wind chart** (`HourlyChart.tsx`). One axis (the skill's first
  rule), a legend for its four marks, night band drawn first with its
  edges lined, limit lines dotted and apart from the dashed gust line:
  all as the sources would have it. Two notes. Its axis text is 8 SVG
  units, about 6 px on a 320 px phone and 8 on a 390 (section 6); the
  chart's own `viewBox` could grow its type without growing the chart.
  And the gust line takes `--watch`'s amber, the colour the stale chip
  and the Watch band use; the skill reserves status colours from series
  ("never reused for series 4"), and the card's rule is that a colour
  asserts. The line is amber at every speed, so it does not colour a
  figure by its value, and the legend names it; but a reader who learns
  amber as "watch" elsewhere on the page meets it here on a plain
  forecast. A hue of its own would cost nothing (`--accent-2` is taken
  by the wind-errors charts' under side; the validator can check a
  third against the blue and the dotted limit colours).
- **`#parity`** (`paritySvg.ts`). The spread row (median dot, bar to the
  90th, line to the extremes) is a box-plot cousin and reads by position
  on one axis shared across rows; the dumbbell for two medians is the
  skill's own form for "before → after per item"; the share bars print
  "agree of n" beside the bar because 1 of 1 and 1,343 of 1,344 draw
  alike, which is Few's point about tables; every mark carries a
  `<title>` and sits above the table with the same figures, so nothing
  is gated. The two hues pass the validator (section 5). Labels at 11 px
  and ticks at 10 px are at NN/g's floor, not under it.
- **`#wind-errors`** (`windErrors.ts`). Histograms of forecast minus
  report, binned to the knot, the two sides in two hues and the zero bin
  grey: the skill's diverging rule exactly (two hues and a neutral
  midpoint), and neither hue a warning colour. The caption's "n, median,
  mean, above, below" is the count-not-grade practice WMO/TD-1422 asks
  for in verification. Shared axes across every row so the charts
  compare (section 3).
- **The dark palette** (`app.css` `:root`). Every text and series colour
  clears WCAG AA against the panel (section 6). The skill asks for a
  dark mode *selected* from the same ramps rather than flipped, and this
  app has only a dark theme, so there is nothing to flip. One question
  for the maintainer, not a recommendation: NN/g's remark about phones
  in sun is about luminance, and a light theme under
  `prefers-color-scheme: light` would be the brighter page outdoors; it
  would mean a second validated set of tokens and the night band
  reworked (a dark band reads as night only on a dark panel, as
  `HourlyChart.tsx`'s comment says).

## What could not be read from here

The allowlist (CLAUDE.md) does not reach these hosts, so each is known
only through a WebSearch result's summary, and the notes say so at every
use: nngroup.com (the dashboards, clutter, low-contrast, glanceable-type,
legibility and inclusive-design articles); w3.org and w3c.github.io (the
WCAG 2 Understanding documents for 1.4.1, 1.4.3, 1.4.4 and 1.4.11);
perceptualedge.com and Few's books (*Show Me the Numbers*, *Information
Dashboard Design*, "The Chartjunk Debate", "Practical Rules for Using
Color in Charts"); edwardtufte.com and Tufte's books (*The Visual
Display of Quantitative Information*, *Envisioning Information*,
*Beautiful Evidence*); Cleveland and McGill 1984 and Cleveland's *The
Elements of Graphing Data*; Heer and Bostock 2010
(homes.cs.washington.edu); Bateman et al. 2010 (vis.csail.mit.edu);
Inbar, Tractinsky and Meyer 2007 (cris.bgu.ac.il); Brehmer et al. 2019
(arxiv.org); Bertin's *Semiology of Graphics* (only course summaries of
its visual variables, which disagree with each other on the
classification, so nothing here rests on it); WMO/TD-No. 1080, 1409 and
1422 and WMO-No. 485 (old.wmo.int, preventionweb.net); meteoblue's help
pages; Apple's HIG typography page and Material's type scale (their
minimum sizes unconfirmed). Not tried, on the rule not to work around a
block.

Read today, in full or as described: the dataviz skill's references and
validator (local); forecast.weather.gov's Hourly Weather Graph image for
the DZ and weather.gov's two pages on it; weather.gov's NDFD metadata
page; aviationweather.gov's GFA page; usairnet's KPMV page; and this
repository's own cards, stylesheet and screenshots.
