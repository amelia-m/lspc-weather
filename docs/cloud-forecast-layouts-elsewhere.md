# How other sites lay out a multi-day cloud and ceiling forecast

> Read before the card was rebuilt later the same day: since 2026-11-18
> it is one table per local day in usairnet's form, and the hourly strip
> this survey was made beside is gone (docs/nbm-lowest-cloud-base.md,
> "Since 2026-11-18 the card is one table per local day").

A survey for the Ceiling & sky card's three-day part (then the NBM's
three-hourly bulletin under the hourly strip; docs/nbm-lowest-cloud-base.md,
"The three-hourly bulletin, three days out"). Six sites were loaded in
Playwright's Chromium from the sandbox on 2026-11-18 between about 16:05Z
and 16:15Z, each at 1280 px and at 390 px (phone emulation), and each
screenshot is kept beside this doc as `docs/img/survey-<site>-2026-11-18.png`
with the 1280 px capture on the left and the 390 px one on the right. The
browser went through the proxy with its CA keys
(`--ignore-certificate-errors-spki-list`, CLAUDE.md, "The deployed site in
a browser"), with a browser-like User-Agent, and with every request to
Open-Meteo aborted before it left the browser. The reader's question
throughout is the one the card is for: *which of the next three days is
clear, and when does a low layer come in?*

What each site is read for, in one line: usairnet is the local convention
jumpers already read; the two NWS pages are the same gridpoint forecast the
card's hourly strip draws, in NWS's own two layouts; aviationweather.gov's
TAF board and GFA are what the Pilots tab links to; MDL's viewer draws the
very bulletin the card reads; Mark Schulze's page is the jumper's tool for
hours and heights.

## usairnet's aviation forecast table for KPMV (the local convention)

`https://www.usairnet.com/cgi-bin/launch/code.cgi?Submit=Go&sta=KPMV&state=NE`,
read 2026-11-18 about 16:05Z. `docs/img/survey-usairnet-2026-11-18.png`
is the top of the page (the current-conditions panel); the forecast table,
which sits about 3,000 px down, is
`docs/img/survey-usairnet-table-2026-11-18.png`.

**Days and hours.** One table, "Extended Forecast · Every 3 Hours", 24
columns at three-hour spacing. Two header rows: a `DATE` row whose cells
span a day's columns (`<th scope="colgroup" colspan="…">`: "NOV 18" over
the four columns left of today, "NOV 19" and "NOV 20" over eight each,
"NOV 21" over the last four; the weekday above the date), then an `HOUR
CST` row with the clock time in two lines ("12:00" over "PM"). The day
boundary is only the header span's edge; nothing marks midnight down the
body. A note above the table says where the columns come from: "Opening
columns use NBH; NBS begins Nov 18 21:00 UTC. NBH issued Nov 18 15:00
UTC", so the first columns are the hourly bulletin and the rest the
three-hourly one, the same two bulletins the card reads. A "Switch to 24
Hour Forecast" button swaps in an hourly table; "Click a column to hold"
pins one column's figures while scrolling.

**Sky and cloud heights.** Every row is a label cell (name, unit, an "i"
button) and 24 figure cells; every cell prints its figure. Sky conditions:
an icon (sun, moon, or a cloud over either), a word ("Clear", "Mostly
clear", "Partly cloudy", "Mostly cloudy", "Cloudy") and the percentage.
Ceiling, feet AGL: "Unlim." or the figure ("4,700", "2,300", "1,400"),
drawn as a blue filled area that hangs from the top of the row where a
ceiling exists. IFR ceiling chance, "ceiling below 1,000 ft / %": the
figure with a short bar. Lowest cloud base, feet AGL: the figure ("3,600",
"8,000", "15,000", "Unlim.") over a blue area that rises from the bottom
of the row, so the two height rows read in opposite directions. Then
visibility (statute miles), IFR visibility chance, and a flight-category
row of coloured chips (green VFR, blue MVFR; red and purple IFR/LIFR in
the legend) with a "!" badge on one column. The footer legend reads "N/A:
unavailable · Unlim.: unlimited ceiling · AGL: above ground level", and a
"View source NBS bulletin" disclosure holds the raw text.

**Night.** Only the sky row's icons change: a moon instead of a sun
(`data-illumination="night"`, fifteen of the 24 columns). No column
shading, no line at sunset or sunrise.

**Limits.** A first row, "Edit my limits", shows a "?" in every column
until a reader sets limits; the page's own caveat says "Favorable symbols
and phrases only reflect your selected limits", and the limits dialog
offers "Daytime only" flying hours. That is the reader's own limits, the
same idea as this app's own-limits path, with the same reason it is
allowed.

**At 390 px.** The page declares `width=device-width` but lays the table
out at its desktop width, so the phone's layout viewport grows to 1,681
px and the whole table is drawn at about a quarter scale: every figure is
there and none is legible without pinch-zooming. A "Switch to Mobile View"
control appears at that width; clicking it in Playwright changed nothing,
so the mobile view is not surveyed.

**For the reader's question.** The day spans and the words in the sky row
answer "which day" at a glance on a wide screen, and the hanging ceiling
area shows where a layer comes in and how low; the figures are all there
to check. What works against it: the two height rows drawn in opposite
directions, the 24-column width on a phone, and the coloured category
chips, which answer the question for the reader rather than handing over
the figures.

## NWS's hourly weather graph for the drop zone

`https://forecast.weather.gov/MapClick.php?lat=40.8703&lon=-96.1085&FcstType=graphical`,
read 2026-11-18 about 16:06Z. `docs/img/survey-nws-graphical-2026-11-18.png`
is the default element set; `…-nws-graphical-aviation-…` has Surface Wind,
Sky Cover, Ceiling Height and Visibility ticked (`w18=cig`, `w19=vsby`),
the panels cropped from the "48-Hour Period Starting" control down.

**Days and hours.** One server-drawn PNG (`meteograms/Plotter.php`,
`hrspan=48`) of stacked panels, one per element, sharing an x axis of 48
hours labelled every three ("12pm", "3pm", …). The day is named once per
panel, at the top where the date changes ("Thu, Nov 19 2026", "Fri, Nov
20 2026"). Three days need two pages: "Back 2 Days" and "Forward 2 Days"
re-draw the image from another start hour.

**Sky and cloud heights.** Sky Cover is a line with a point every hour and
the percentage printed at some points ("20%", "8%", "12%", "54%"), not
all. Ceiling Height is its own panel, axis in hundreds of feet and
non-linear (0, 10, 20, 30, 50, 250): where the forecast has no ceiling
the panel is empty, so an unlimited ceiling and missing data look the
same. Visibility is a line at 10.

**Night.** Grey bands from sunset to sunrise across every panel, the
clearest night marking of the six.

**At 390 px.** The page is 962 px wide and the image does not scale, so
the phone shows it zoomed out and the printed figures are unreadable.

**For the reader's question.** A clear day is a flat line near zero in the
Sky Cover panel and an empty Ceiling panel, readable across two days;
when a layer comes in, the ceiling line appears. But the third day is on
the next page, and an empty ceiling panel says "none forecast" only to a
reader who knows the convention.

## NWS's tabular forecast

The same URL with `FcstType=digital`, read 2026-11-18 about 16:06Z.
`docs/img/survey-nws-digital-2026-11-18.png` (default rows) and
`…-nws-digital-aviation-…` (the aviation rows, cropped to the tables).

**Days and hours.** Two tables of 24 hourly columns, 48 hours a page,
paged the same way. A "Date" row names the date only in the first column
of each day ("11/18" at hour 10, "11/19" at hour 00); the "Hour (CST)"
row runs 10, 11, … 23, 00, … 09. Midnight is marked by the date label and
nothing else.

**Sky and cloud heights.** Figures only: Sky Cover (%) in every cell,
Ceiling Height (x100ft) a row that was blank in every cell today (no
ceiling forecast), Visibility (mi) 10 in every cell. Each row's label and
figures are in one colour, which names the row, not the hour.

**Night.** Not marked.

**At 390 px.** The page is 962 px wide; the phone zooms out and the two
tables stack.

**For the reader's question.** Every figure is printed and nothing grades
it, which is the card's rule exactly; but a row of 24 figures has to be
read, not seen, a blank ceiling cell is the ambiguity above, and the third
day is on the next page.

## aviationweather.gov's TAF board (KOMA, KOFF, KLNK) and its GFA

`https://aviationweather.gov/data/taf/?ids=KOMA%2CKOFF%2CKLNK`, read
2026-11-18 about 16:06Z (raw, `docs/img/survey-awc-taf-2026-11-18.png`)
and 16:12Z (Decoded, `…-awc-taf-decoded-…`; Tabular, `…-awc-taf-tabular-…`).

**Days and hours.** No grid. Raw: each TAF as issued, one line per
change group. Decoded: per station, a block per period, each a list of
labelled lines ("Forecast period: 1500 UTC 18 Wed Nov 2026 to 1600 UTC 18
Wed Nov 2026", "Forecast type: FM: standard forecast or significant
change", "Winds", "Visibility", "Clouds: overcast at 3,000 ft"). Periods
are of unequal length and all times are UTC. The horizon is the TAF's
own: 1815/1912 at KOMA and KLNK, 1811/1917 at KOFF, so under thirty
hours. The "Tabular" switch is for METARs only (its tooltip, "Decode into
table form (METAR only)"): with it on, the TAFs leave the page and an
empty METAR table header remains.

**Sky and cloud heights.** Words and figures: "overcast at 3,000 ft",
"broken clouds at 5,000 ft, broken clouds at 25,000 ft", "clear". No
drawing.

**Night.** Not marked.

**At 390 px.** The page fits the width (no sideways scroll), but the
decoded lines are clipped at the right edge rather than wrapped, so the
longer "Text" and "Winds" lines lose their ends.

The GFA, `https://aviationweather.gov/gfa/`, loaded on its Observations
tab (`…-awc-gfa-…`); its Clouds tab (`#clouds`, `…-awc-gfa-clouds-…`) and
Ceiling & Visibility tab (`#cigvis`, `…-awc-gfa-cigvis-…`) were read at
about 16:13Z. The basemap tiles come from `static-map-tiles-api.arcgis.com`,
which is not on the sandbox allowlist, so the map art is missing in the
screenshots while every overlay drew. It is a map per hour, not a table:
the Clouds tab fills cloud cover and prints a station text per point
("OVC030 TOP FL450", "SKC", with a clock-face cover symbol), the Ceiling
& Visibility tab fills flight categories (the IFR and MVFR colours) with
the G-AIRMET polygons over them, and a slider along the bottom steps the
valid hour from 1613Z to 10Z, eighteen hours. At 390 px the slider keeps
every fourth label (20Z, 00Z, 04Z, 08Z). For one location across three
days it does not answer the question at all: a reader would step through
hours and remember.

## MDL's NBM text bulletin viewer

`https://blend.mdl.nws.noaa.gov/nbm-text`, read 2026-11-18 about 16:07Z
(the form, `docs/img/survey-nbm-text-2026-11-18.png`) and 16:14Z with the
viewer's own deep link, `?ele=nbs&sta=KPMV&cyc=latest` (the form's "Copy
URL" scheme, read in its `javascript_bull8p.js`), which renders KPMV's NBS
block in a `<pre>` under the form (`…-nbm-text-bulletin-…`).

**Worth knowing first:** the "latest" cycle the viewer served at 16:14Z on
11/18 was `11/17/2026 1400 UTC`, more than a day old. The page says of
itself that it "is not updated by the operational job stream" and "the
most recent cycle times may not always contain the most recent data".
The relay reads NOAA's bucket instead, which is current (docs/taf-relay.md),
so this viewer is a way to see the bulletin's layout, not a source.

**Days and hours.** The bulletin's own rows: `DT` names the day where it
changes (`/NOV 17/NOV 18 … /NOV 19 … /NOV 20`, UTC days), `UTC` the hour
(18 21 00 03 …), `FHR` the hours from the cycle (04 07 10 …); 23 columns
of three characters.

**Sky and cloud heights.** `SKY` in percent; `CIG` and `LCB` in hundreds
of feet, `-88` for none, run together where three digits fill the column
("27130140130…"); `IFC` and `IFV` in percent, `-99` where not computed;
`VIS` in tenths of a mile (`100`). No drawing, no words.

**Night.** Not marked as such, though the `SOL` row (solar radiation)
reads 0 through the night hours.

**At 390 px.** The page is 990 px wide; the `<pre>` does not wrap and the
phone zooms out.

**For the reader's question.** This is the card's source, legible to
someone who knows the row keys and nobody else; it is what the card is
for turning into something readable.

## Mark Schulze's winds page for the drop zone

`https://www.markschulze.net/winds/?lat=40.8703&lon=-96.1085`, read
2026-11-18 about 16:08Z with a `Referer` header
(`docs/img/survey-schulze-2026-11-18.png`). **It stayed empty.** The page
loads jQuery from `code.jquery.com` and Leaflet from `unpkg.com`, neither
on the sandbox allowlist, so its script never ran and the page showed its
static frame: an hour stepper ("–1 hr", "at the current location", "latest
forecast", "+1 hr"), Latitude, Longitude, MGRS, Elevation, a "Show Map"
button, Temperature, Wind, "Download File" and "Show File", every value
"---". That frame says how a jumper's tool lays out time: one valid hour
at a time, stepped by a button, with a table of heights for that hour
(the table itself was not seen today; what it holds and how it is built
is in docs/markschulze-altitude-reference.md from earlier readings). There
is no day view and no multi-day view; the question "which day" is not one
the tool asks. It fitted 390 px without sideways scroll, with nothing in
it to overflow.

## What the card's three-day layout should keep, and what it should avoid

The card's rules are fixed (CLAUDE.md): every figure printed, and no
colour, icon or word that grades an hour. Within them:

**Keep, because jumpers know them:**

1. **A day header spanning its columns, and the hours in local clock
   time.** usairnet's `DATE` row over its `HOUR CST` row is the shape
   jumpers read KPMV in, and NWS's two layouts name the day the same way,
   once where it changes. The card's day blocks already give each local
   day its own heading; their eight slots should carry the clock time the
   way the table does ("12 PM", "3 PM"), and the edge between days
   should be visible in the body, not only in the heading. The bulletin's
   UTC days are nobody's convention here.
2. **Height rows that print a figure in every slot, with a word for "no
   ceiling".** usairnet prints "Unlim." and a feet-AGL figure in every
   ceiling and lowest-base cell; the NWS layouts leave a cell or a panel
   blank for no ceiling, and a blank reads as "no data" as easily as
   "none". The card's band already prints the heights in thousands of
   feet under each slot; keep every slot filled, and say "none" (or the
   bulletin's own word) rather than leaving it empty.
3. **Cloud heights on a height axis, base as an area from the ground and
   ceiling as a mark, with night shaded under them.** usairnet's filled
   area is the picture jumpers have of a layer coming in, and NWS's grey
   night bands are the one night marking any of the six sites draws (the
   card's day blocks have drawn the band since 2026-11-12 and shaded
   night since 2026-11-18). One direction only: usairnet's
   ceiling hanging from the top while its base rises from the bottom is
   the part not to copy.

**Avoid:**

1. **Flight-category chips, coloured cells, favorable symbols and sky
   words.** usairnet's green and blue VFR/MVFR chips and "!" badge, the
   GFA's IFR fills, and even the sky row's "Clear"/"Cloudy" word all
   answer the reader's question for them; the card hands over the
   percentage and the heights and leaves the answer to the reader. A sky
   word would need a published band behind it to be a citation rather
   than a grade, and none is cited.
2. **A fixed-width table of every column across the horizon.** Not one of
   the six sites fits a 390 px phone: usairnet lays out at 1,681 px, the
   NWS pages at 962, MDL's `<pre>` at 990, and each is drawn zoomed out
   with its figures too small to read; the TAF board fits the width by
   clipping its lines. The card's one-block-per-day layout, eight slots
   wide, fits 320 px without scrolling, and that is the reason to keep
   it over a 23-column strip. Paging in 48-hour windows (NWS) is the same
   failure the other way: the third day is off the page.
