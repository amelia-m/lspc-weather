# AXIS Flight School's tools at Skydive Arizona, beside this app

Read 2026-11-24 from twelve screenshots the maintainer sent of <https://axis.tools/tool_Cond.php> and four sibling pages (home, Manifest Calls, Exit Separation Calculator, Canopy Risk Quotient Calculator). The pages themselves were not opened: the sandbox's proxy refuses `axis.tools`, and the environment change to allow it was rejected. So this is what the screenshots show and nothing about the site's code or requests; the link is unchecked from here.

## What it reads that this app does not

| AXIS names | For | Here | Note |
|---|---|---|---|
| rucsoundings.noaa.gov | Winds aloft, a "1-h forecast" | Open-Meteo | Not read: the host reset the connection twice from the sandbox on 2026-11-24. Unknown from here: whether it sends a CORS header, its terms, and what it serves now that NCEP has brought in the RRFS. Its rows sit at uneven heights (460, 1,190, 1,940, 3,500, 5,130, 8,680, 12,730, 17,400 ft AGL), which reads as model levels as served, not interpolated (an inference from the heights). |
| aviationweather.gov | Conditions on the ground | IEM first, api.weather.gov second | Their server fetches it; a browser cannot (no CORS header, CLAUDE.md). Same METAR either way. |
| Its own weather station through Weather Underground ("experimenting") | Conditions on the ground at the landing area | None: KPMV is 11 mi ENE | The one source that would change what this app can say. Needs a station at Brown's and a Weather Underground key or another feed: hardware and an account, the maintainer's call. |
| Skydive Arizona's manifest | Loads on a call, today's loads by hour, refreshed every 15 s | None | Not weather. Whether LSPC's manifest has a feed is not known here. |

AXIS's server collects the data, at most 60 times an hour and only while someone has the page open; this app's fetches run in each reader's browser.

## What it shows that this app does not

| Feature | What AXIS does | Here | Triage |
|---|---|---|---|
| Exit separation | A calculator: group size (1 to 5, or 6 and over, which adds 2 s), intended separation (from 1,000 ft, its minimum), ground speed on jump run in knots ("from the pilot"); result in seconds (8 s at 1,000 ft and 80 kt; "Minimum exit separation: 6 sec") | The Winds aloft card's standing note cites SIM 4-7 C and says to plan exit separation; no figure | **Best candidate.** SIM 4-7 C gives the distances: "at least 1,000 feet of ground separation between individuals jumping solo" and "at least 1,500 feet ... between small groups, adding more as the size of the groups increase" (read at uspa.org 2026-11-24). Time is distance over ground speed, plain arithmetic on a published figure and a number the reader enters, so it raises no flag and invents no threshold. The app could also work the ground speed from an airspeed and heading the reader enters and the wind at exit altitude it already has. AXIS's 2 s add-on and 6 s floor are its own and would not come across; the SIM gives no figure for larger groups, so the reader's own distance is the only honest input there. Not read: whether the SIM or another published source treats the wind at opening altitude, which a ground-speed rule leaves out (recalled as a known argument, not checked). |
| Moon | Full-moon dates with moonrise over Phoenix the day before, of and after, six months ahead | Nothing on the moon (the hourly chart's crescent marks night, not phase) | Worth it only if LSPC runs night jumps: ask. Would need a moonrise method held to the Naval Observatory's API the way `sun.ts` is; what the SIM's night-jump section says about moonlight was not read. |
| Heat index | Shown on the ground above 80°F | None | Low. NWS publishes the formula (not read today); a figure beside Density altitude with no colour and no word. The maintainer's call whether it earns the space. |
| Wind chill aloft ("feels") | Per level, below 50°F and above 3 mph | Temperature per level, no wind chill | Skip. The figure takes the ambient wind at that level; a jumper meets the relative wind of freefall or the canopy's airspeed, which it does not describe. The temperature column is already there. |
| Two green rows | The levels nearest a hop and pop (about 5,000 ft) and a high exit (about 13,000 ft) | The table folds at the usual top exit | Low. A colour asserts; a plain marker on the exit row would not. Only if a reader finds the row hard to pick out. |
| Gusts called "insignificant" | Under 1.5 mph over the wind speed | Gusts as the METAR reports them | **No.** A worded judgement on a threshold of AXIS's own, what the governing rule removed. |
| "Do not use this page at all, if wind conditions are volatile" | A standing warning | "the latest report, not a forecast", with station, distance and time | Consider a plain sentence on the Surface wind card that a report is minutes old and 11 miles away, so it cannot show a wind that is changing. A caveat, not a threshold; a wording proposal for the maintainer. |
| Solar noon | With apparent sunrise and sunset | Sunrise and sunset; `sun.ts` computes solar noon and prints none | Skip: no use to a jumper named. |
| SI units | A USCS and SI switch (visibility in miles and km) | Knots or mph, °F or °C | Skip while the scope is US drop zones. |
| Winds to 17,400 ft | Eight levels | To 13,000 ft AGL | Skip: above a C-182's exits. |
| Canopy Risk Quotient | A questionnaire scored into one figure: experience and currency (jumps, time in the sport, jumps in the last 12 months, in the last month, at this DZ), the canopy (wing loading, size, design, jumps on it) and training (structured lessons, hop-and-pops for canopy practice, ten manoeuvres not done in the last 50 jumps). AXIS calls it "an electronic version of the USPA paper «Canopy Risk Quotient»" and says it "isn't a scientific survey" | None | **Not proposable until the paper is read.** USPA's link, `uspa.org/Portals/0/files/misc_sdriskquotient.pdf`, answers with its "404 Error Page" (a 200 status; read 2026-11-24), and uspa.org's own search returned no result for the title. The Wayback Machine was not tried: the sandbox's proxy refuses `web.archive.org` and `archive.org`, and the environment change to allow them was rejected; opening `web.archive.org/web/*/uspa.org/Portals/0/files/misc_sdriskquotient.pdf` in a browser would settle whether a copy exists. If it does: the score would be USPA's, shown as USPA's and dated, about the jumper and not the weather, and whether USPA still stands behind a paper it has taken down is a question for USPA. |
| Other tools on the menu (seen as tiles only) | Wing loading, canopy size by jump numbers, reserve repack date, a draw generator, ChronoPrism | Wing loading card | Canopy size is a recommendation on the jumper and would need a published chart shown as its publisher's; repack date is date arithmetic on 14 CFR 105.43 (not read today), not weather; the rest are competition tools. None proposed. |

## For the maintainer

1. Exit separation on the Winds aloft card, from SIM 4-7 C's two distances: build it?
2. Does LSPC run night jumps often enough for a moon line?
3. A weather station at the field: wanted, and who would own it?
4. Heat index, and the "a report cannot show a changing wind" sentence: either?
5. The Canopy Risk Quotient: is an archived copy of USPA's paper to be had (the Wayback Machine, from a browser, or allow its hosts for this environment in Settings), and if so, is a jumper's self-assessment something this weather page should carry?
