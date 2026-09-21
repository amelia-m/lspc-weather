# usairnet parity evaluation

Reference comparison of the [usairnet KPMV aviation
forecast](https://www.usairnet.com/cgi-bin/launch/code.cgi?state=NE&sta=KPMV)
plot rows against the LSPC Weather dashboard, to track which forecast
components are covered and which remain candidates.

Legend: ✅ have · ⚠️ partial · ❌ missing · ⏭️ intentionally skipped.

| usairnet row | Dashboard status |
|---|---|
| Sky / Cloud coverage % | ✅ Ceiling & sky card + per-day hourly detail |
| Temp (°F) | ✅ hourly detail, daily hi/lo |
| Wind direction / avg speed / max gust | ✅ surface, winds aloft, hourly |
| Cloud base @ 60% / ceiling | ✅ ceiling (lowest BKN/OVC) |
| Chance of precip % | ✅ precip card + hourly |
| Visibility | ✅ current METAR, plus a Vis column in the 10-day card's hourly detail |
| Flight Rule (VFR / MVFR / IFR / LIFR) | ✅ Ceiling & sky pill, hourly Flight column, and a flag below VFR (AIM 7-1-7) |
| Dew point + temp/dew-point spread | ⚠️ current METAR only, no forecast — spread shown as a measurement, no verdict |
| Relative humidity | ✅ current METAR card (`RH % · °C spread`) |
| Precip amount (QPF, inches) | ✅ NWS gridpoint `quantitativePrecipitation`, on the Precip & storms card |
| Chance of thunder % | ✅ NWS gridpoint `probabilityOfThunder` (Precip & storms card, hourly Storm column) |
| Probability precip is rain % | ⏭️ skip — low value for summer jumping |
| Lowest cloud base (any layer) | ⚠️ partial (we show ceiling, not lowest FEW/SCT) |
| Nebraska State Summary sidebar | ⏭️ skip — regional roundup, not DZ-specific |

## Prioritized backlog

Everything that was on this list has shipped. What remains:

1. **Forecast dew point / spread** — the spread is shown for the current METAR
   only; the NWS gridpoint carries a forecast dewpoint that would extend it.
   Note the constraint below before building anything on top of it.
2. **Lowest cloud base (any layer)** — the Ceiling & sky card shows the ceiling
   (lowest BKN/OVC); usairnet also plots the lowest FEW/SCT base.

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
  humidity-corrected density altitude. The original framing of this item — a
  tightening spread as a morning-fog early warning — was **deliberately not
  built**: it needs a number at which the spread becomes "tight", and nobody
  publishes one. The app's own 3 °C fog flag, and the "fog/low-cloud favorable"
  verdict that went with it, were removed for exactly that reason.

Skipped:
- **Probability precip is rain %** and **Nebraska State Summary** — low value
  for a single-DZ summer skydiving tool.

Design rule reminder: every added metric flags a condition and cites a source,
and none renders a go/no-go verdict. The stronger rule this branch added: a
metric only gets to raise a flag, or wear a warning colour, if a published
source sets the number it fires at. Otherwise it is printed plainly and the
reader judges it.
