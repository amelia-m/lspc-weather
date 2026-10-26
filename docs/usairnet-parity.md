# usairnet parity evaluation

Reference comparison of the [usairnet KPMV aviation
forecast](https://www.usairnet.com/cgi-bin/launch/code.cgi?state=NE&sta=KPMV)
plot rows against the LSPC Weather dashboard, to track which forecast
components are covered and which remain candidates.

Legend: ✅ have · ⚠️ partial · ❌ missing · ⏭️ intentionally skipped.

| usairnet row | Dashboard status |
|---|---|
| Sky / Cloud coverage % | ✅ Ceiling & sky card + per-day hourly detail |
| Temp (°F) | ✅ hourly detail, daily hi/lo, in the page-wide °F/°C unit |
| Wind direction / avg speed / max gust | ✅ surface, winds aloft, hourly |
| Cloud base @ 60% / ceiling | ✅ ceiling (lowest BKN/OVC) |
| Chance of precip % | ✅ precip card + hourly |
| Visibility | ✅ current METAR, plus a Vis column in the 10-day card's hourly detail |
| Flight Rule (VFR / MVFR / IFR / LIFR) | ✅ Ceiling & sky pill, hourly Flight column, and a flag below VFR (AIM 7-1-7) |
| Dew point + temp/dew-point spread | ⚠️ current METAR only, no forecast — spread shown as a measurement, no verdict |
| Relative humidity | ✅ current METAR card (`RH % · spread`, in the page-wide °F/°C unit) |
| Precip amount (QPF, inches) | ✅ NWS gridpoint `quantitativePrecipitation`, on the Precip & storms card |
| Chance of thunder % | ✅ NWS gridpoint `probabilityOfThunder` (Precip & storms card, hourly Storm column) |
| Probability precip is rain % | ⏭️ skip — low value for summer jumping |
| Lowest cloud base (any layer) | ⚠️ partial: the latest report's every layer is on the Current conditions card's Sky line; no forecast of it (NWS's gridpoint has the ceiling only; usairnet's comes from the NBM, below) |
| IFR ceiling / IFR visibility chance % | ❌ missing (NBM's `IFC` and `IFV`, below) |
| Mixing height, transport wind | ❌ missing (NBM's `MHT`, `TWD`, `TWS`, below) |
| Nebraska State Summary sidebar | ⏭️ skip — regional roundup, not DZ-specific |

## Prioritized backlog

Everything that was on this list has shipped. What remains:

1. **Forecast dew point / spread** — the spread is shown for the current METAR
   only; the NWS gridpoint carries a forecast dewpoint that would extend it.
   Note the constraint below before building anything on top of it.
2. **Lowest cloud base (any layer)** — the Ceiling & sky card shows the ceiling
   (lowest BKN/OVC); usairnet also plots the lowest FEW/SCT base. For the
   latest report the dashboard has it: the Current conditions card's Sky
   line lists every layer the METAR gives ("FEW 2,500 ft, BKN 4,000 ft"),
   lowest first. A *forecast* of it would have to come from the NBM, the
   source of usairnet's row; see "Where usairnet's rows come from" below.

Resolved:

- **Chance of thunder %** — *implemented.* Investigation found the NWS
  gridpoint (`api.weather.gov`, which works even when Open-Meteo is blocked)
  exposes a numeric `probabilityOfThunder` property — the same data usairnet
  shows. We already fetch that gridpoint, so no new network dependency was
  needed. See the [NWS gridpoint properties
  doc](https://github.com/weather-gov/api/blob/master/gridpoints.md).
- **Flight category (VFR/MVFR/IFR/LIFR)** — *implemented*, derived from the
  ceiling and visibility already fetched. Cited to **FAA AIM 7-1-7 only**. An
  earlier plan here was to cite 14 CFR 91.155 alongside it; that was wrong and
  is not to be revived. The AIM defines the categories and nothing else — it is
  not regulatory and does not carry the pilot's VFR weather minimums, so naming
  91.155 while linking the AIM offered a source that could not support the rule
  named.
- **Per-hour visibility** — *implemented* as the Vis column in the 10-day
  card's expanded hourly detail.
- **Precip amount (QPF, inches)** — *implemented* from the gridpoint's
  `quantitativePrecipitation`, shown alongside the chance-of-precip %.
- **Humidity + temp/dew-point spread** — *implemented as measurements.* RH and
  the spread print on the current-conditions card, and RH feeds the
  density-altitude card's humidity row. The original framing of this item — a
  tightening spread as a morning-fog early warning — was **deliberately not
  built**: it needs a number at which the spread becomes "tight", and nobody
  publishes one. The app's own 3 °C fog flag, and the "fog/low-cloud favorable"
  verdict that went with it, were removed for exactly that reason.

Skipped:
- **Probability precip is rain %** and **Nebraska State Summary** — low value
  for a single-DZ summer skydiving tool.

## Where usairnet's rows come from: the NBM

Asked 2026-10-24 from a usairnet popup ("Cloud cover / ceiling mismatch",
citing "NBH issued 2026-10-24 03:00 UTC"). The NBM is the NWS's National
Blend of Models: a statistical blend of many models' output, issued
hourly, which the NWS also publishes as text bulletins for each station.
Five are listed at <https://www.weather.gov/mdl/nbm_text> (NBS, NBE, NBX,
NBH, NBP). Two matter here:

- **NBH**, hourly, 1 to 25 hours ahead.
- **NBS**, three-hourly, 6 to 72 hours ahead.

KPMV is in both. Each issuance is one file for every station, on NOAA's
open data bucket at
`https://noaa-nbm-grib2-pds.s3.amazonaws.com/blend.YYYYMMDD/HH/text/blend_nb{h,s}tx.tHHz`
(and on NOMADS, which refused this sandbox with a 403). The KPMV blocks of
the 03Z issuance of 2026-10-24, as read, are in
`data/parity/nbm-kpmv-2026-10-24-03z.txt`.

Rows a reader of this app would know, as the bulletin labels them: `CIG`
(ceiling, `-88` for none), `LCB` (lowest cloud base), `VIS`, `SKY`,
`WSP`, `GST` and `WDR`. They also carry `IFC`/`IFV` (a chance of an IFR
ceiling or visibility, the rows usairnet calls "IFR ceiling chance") and
`MHT`, `TWD`, `TWS` (mixing height and transport wind). That night `LCB`
gave a base under every hour, `CIG` a ceiling in only some: 3Z on the
25th read `CIG 210`, `LCB 150`.

MDL's key to the rows, its "NBM v5.0 Text Bulletin Card"
(<https://vlab.noaa.gov/web/mdl/nbm-textcard-v5.0>, read 2026-10-26 once
`vlab.noaa.gov` was allowlisted; the hourly card's key is kept in
`data/parity/nbm-textcard-v5.0-key-2026-10-26.txt`), says: `CIG` is
"ceiling height, 100s feet (>5000 ft reported to the nearest 1000 ft;
-88=unlimited)", `LCB` "lowest cloud base, 100s feet" on the same terms,
`VIS` "visibility, 1/10th miles (rounded to nearest mile for values >= 1
mile)", `MVC`, `IFC` and `LIC` the probability of a ceiling at or under
3,000 ft, under 1,000 ft and under 500 ft, `MVV`, `IFV` and `LIV` the
same for visibility at or under 5, under 3 and under 1 mile, `MHT`
"mixing height, 100s feet AGL", `TWD` and `TWS` the transport wind
(tens of degrees, knots), `GST` "wind gust, knots", and -99 missing. Its
"NBM Weather Elements" page (same host, read the same day) defines the
base height as "Lowest cloud base whether or not a ceiling is present
(could be FEW or SCT layer)", "a 50/50 blend of model diagnostic cloud
information and RH derived clouds", and the ceiling probabilities as
GLMP's through 36 hours and a NAM/GFS MOS blend from 39 to 78. So the
reading of the values above holds, and the row is what its name says:
the lowest layer, FEW and SCT included, which is what usairnet plots.
MDL's own viewer, `blend.mdl.nws.noaa.gov/nbm-text`, and NOMADS answer
the sandbox since the same day.

**Could the dashboard read it?** The bucket answers a GET that carries an
`Origin` with `Access-Control-Allow-Origin: *`, and a preflight with `GET`
allowed (checked 2026-10-24; an earlier HEAD check here wrongly read as
no header). So a browser could fetch it. But each file is 28 MB (NBH) or
30 MB (NBS) for all stations. The KPMV block sat at the same byte offset,
18,242,995, in the NBH files of 00, 01, 02 and 03Z that day, so a
byte-range request could take only it. Nothing published says the offset
holds, though; one station added or removed upstream of KPMV would move
it. A workflow, or the TAF relay, could instead cut the block out and
serve it.

Not built. A forecast lowest cloud base raises no flag of its own: no
published limit applies to a FEW or SCT base. It would be printed plainly
beside the NWS ceiling, from a second forecast that can disagree with it,
as usairnet's "mismatch" popup shows. Whether that is worth a new source
is the maintainer's call (docs/open-questions.md).

Design rule reminder: every added metric flags a condition and cites a source,
and none renders a go/no-go verdict. The stronger rule this branch added: a
metric only gets to raise a flag, or wear a warning colour, if a published
source sets the number it fires at. Otherwise it is printed plainly and the
reader judges it.
