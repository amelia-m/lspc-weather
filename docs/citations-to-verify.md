# Citations to verify against a current SIM

Every USPA reference in this dashboard was derived by an AI assistant and **none
has been checked against a current SIM**. The environment the code was written in
cannot reach `uspa.org`, so no section number below was confirmed against the
live document.

This list exists so that check can actually happen. It is written to be usable by
someone who has never seen the code: each row gives the claim as a jumper sees it
on screen, the number behind it, and where to find it in the app.

**Part A** needs someone with a current SIM open — it is section numbers and
whether the rule says what we claim. **Part B** needs an instructor's judgement
rather than a lookup: these are numbers the app invented, and the question is
whether they are sensible, not whether they are cited. **Part C** is work that
needs no SIM at all; it is listed so nobody spends time verifying something that
should simply be removed.

Mark each row **OK**, **WRONG SECTION**, **WRONG AUTHORITY**, or **CLAIM IS
WRONG**, and note what it should say.

---

## Part A — needs a current SIM

### A1. Student ground-wind limit — the most-acted-on number in the app

| | |
|---|---|
| **On screen** | "USPA recommends max ~14 mph (~12 kt) ground winds for solo students on ram-air reserves." |
| **Value** | 14 mph, stored as 12 kt (`STUDENT_WIND_KT`); caution at 12 kt, watch at 10 kt |
| **Where** | Surface wind card, and the "Surface wind" flag in Conditions to note, with Student selected |
| **Cites** | USPA SIM, Section 2-1 (BSR) → `uspa.org/sim/2-1` |
| **Confidence** | Section: **high**. Wording: **low** — see below |

Three separate things to rule on:

1. **Is Section 2-1 the Basic Safety Requirements?** Everything else in Part A
   depends on this being right.
2. **"Recommends" or requires?** The app says *recommends*, but cites the Basic
   Safety **Requirements**, and the club's own waiver document treats this limit
   as something needing on-site instructor approval to exceed — which a
   recommendation would not. If it is a requirement, the wording understates it.
3. **"on ram-air reserves" — is this backwards?** The suspicion is that the
   canopy-type distinction historically ran the other way, with the *lower* limit
   applying to round canopies. If so, this qualifier is inverted and should be
   corrected or dropped.

**Verdict:** ______________________________________________

### A2. Minimum opening altitudes

| | |
|---|---|
| **On screen** | "USPA BSR minimum container-opening altitudes: **students & A-license 3,000 ft AGL**, B-license 2,500 ft, C/D 2,000 ft (tandem 5,000 ft). These are floors — deploy above your minimum, not at it." |
| **Where** | Freefall drift / spot card, below the drift estimate |
| **Cites** | USPA SIM, Section 2-1 (BSR) |
| **Confidence** | Section: **high**. Figures: **medium** |

These also drive the Deploy dropdown default (3,000 ft for students and all
waiver tiers, 2,500 ft for licensed).

**Verify the tandem 5,000 ft figure specifically** — tandem minimums have changed
across recent SIM editions, and this number is printed to users.

Also worth a moment: the Deploy default returns 2,500 ft for "licensed", which is
the B-licence floor, even though C/D is 2,000 ft. That is deliberately
conservative and user-changeable, but confirm it is not confusing.

**Verdict:** ______________________________________________

### A3. Night jumps — a claim with no supporting citation

| | |
|---|---|
| **On screen** | "Parachute ops between sunset and sunrise require a light visible for at least 3 statute miles (14 CFR 105.19); **USPA also requires a B license (min 50 jumps) for night jumps.** Not a daytime operation." |
| **Where** | Conditions to note, after sunset |
| **Cites** | 14 CFR 105.19 only |
| **Confidence** | **None** — section unknown |

**This is the weakest citation in the app.** One sentence makes two claims from
two authorities and offers one source. 14 CFR 105.19 is a lighting rule; it says
nothing about USPA, B licences, or 50 jumps. A jumper who follows the link to
check whether *they* may jump will not find the answer there.

Two things to establish:

1. **Which SIM section carries the night-jump licence requirement**, and whether
   "B licence, minimum 50 jumps" is accurate.
2. **Does USPA define "night" at civil sunset?** The flag fires the moment the
   sun sets, because that is the 14 CFR 105.19 trigger. If USPA uses a different
   boundary, the app is asserting a USPA requirement at an FAA timestamp.

**Verdict:** ______________________________________________

### A4. "No USPA wind limit for licensed jumpers" — verifying an absence

| | |
|---|---|
| **On screen** | "No USPA hard wind limit for licensed jumpers — included for awareness; consider canopy size and currency. Note: most jump pilots will not take off in winds above ~30–35 mph." |
| **Value** | Watch at 17 kt, caution at 25 kt — both app-invented (see B1) |
| **Where** | Surface wind card with Licensed selected |
| **Cites** | USPA SIM, Section 2-1 (BSR), cited for the *absence* of a limit |
| **Confidence** | Section: **high**. The absence claim: **medium** |

Confirm the BSRs really state no wind limit for licensed jumpers. An absence is
exactly the kind of claim that is easy to get wrong and hard to notice.

The "~30–35 mph" pilot figure has **no source** and is not a USPA matter —
takeoff limits belong to the PIC and the aircraft's operating limitations. It is
listed in Part C for removal or re-attribution, but flag it if you think the
number itself is wrong, since jumpers will read it.

**Verdict:** ______________________________________________

### A5. The BSR-excursion rule behind the club waiver

| | |
|---|---|
| **On screen** | "…Any excursion above the USPA BSR requires on-site approval by a USPA instructor; consult the S&TA." |
| **Where** | Surface wind card and wind flags, with any LSPC waiver tier selected |
| **Cites** | LSPC waivered wind limits (club policy doc) |
| **Confidence** | Section: **medium** |

Citing club policy is correct for the sentence as printed, since it is quoted
from the club document. But the underlying mechanism — that a student wind limit
exists in the BSRs and an instructor may authorise exceeding it — is a SIM claim,
and it is the claim that decides whether a student gets on the plane. Likely
wants a dual citation.

**Verdict:** ______________________________________________

### A6. General weather guidance — six flags pointing at the SIM contents page

| | |
|---|---|
| **On screen** | Source line reads "USPA SIM" and links to the table of contents |
| **Where** | Six flags: gusty wind (spread), fog / low cloud, thunderstorm reported, precipitation chance, forecast thunderstorm chance, winds aloft |
| **Cites** | `uspa.org/sim` — no section |
| **Confidence** | **None — deliberately not guessed** |

The BSRs govern winds, opening altitudes and cloud clearance; none of those cover
"it is gusty" or "40% chance of storms". The section carrying general weather
guidance could not be identified, so the link stays on the contents page and now
says so in its tooltip rather than pretending to a precision it lacks.

**What is needed:** which section (or sections) govern this material. It probably
splits — turbulence and canopy flight in wind is a different subject from
convection, which is different again from spotting and exit separation.

Note two of these six may not be USPA's business at all: "a small temperature–dew
point spread favours fog" is meteorology, not skydiving practice (see C2).

**Verdict:** ______________________________________________

### A7. Exit separation and spotting in strong upper winds

| | |
|---|---|
| **On screen** | "Strong upper winds increase freefall drift and lengthen the spot — plan jump run and exit separation accordingly." |
| **Where** | Winds aloft flag in Conditions to note |
| **Cites** | USPA SIM contents page (as A6) |
| **Confidence** | That *some* section covers it: **moderate-high**. Which one: **none** |

This is an operational instruction with real collision consequences, and the
source offered is a document index. If the SIM covers exit separation or group
separation, this should point there.

**Verdict:** ______________________________________________

---

## Part B — instructor judgement, no lookup needed

These numbers were **invented by the app**. None is claimed to come from USPA or
the FAA. The question is whether they are sensible for this drop zone, and
whether the app should say plainly that they are house heuristics.

| # | Threshold | Value | Where it shows |
|---|---|---|---|
| B1 | Licensed wind watch / caution | 17 kt / 25 kt | Surface wind, Licensed |
| B2 | Gust spread → "Gusty wind" | 8 kt students, 10 kt licensed | Gusty wind flag |
| B3 | Ceiling watch / caution | 5,000 / 3,000 ft students; 4,000 / 2,500 ft licensed | Ceiling flag |
| B4 | Density altitude excess | 2,000 / 3,500 ft students; 2,500 / 4,000 ft licensed | Density altitude flag |
| B5 | Last load before sunset | 45 min students, 30 min licensed | Daylight flag |
| B6 | Precipitation chance | watch 25%, caution 50% | Precipitation flag |
| B7 | Thunderstorm chance | watch 10%, caution 30% | Thunderstorm flag |
| B8 | Fog / dew-point spread | watch 3 °C, caution 1 °C | Fog / low cloud flag |
| B9 | Winds aloft info / watch | 20 kt / 30 kt | Winds aloft flag |
| B10 | Winds aloft highlighted red | ≥ 30 kt | Winds aloft table |
| B11 | Daily gust highlighted | ≥ 25 kt | 10-day outlook |

B9–B11 are worth particular attention: a number rendered in red is an assertion
even without words attached.

The club waiver tiers (0–5 jumps: 15 mph wind / 16 mph gust; 6–10: 16/18; 10–20:
18/19; 21+: 18/20) are transcribed from the club's posted policy and are **not**
in this list — but confirm the transcription matches the current posted waiver.

---

## Part C — no SIM needed, fix regardless

Listed so no one wastes time verifying these. I can make all of them.

- **C1 — Ceiling flag cites a regulation that sets no ceiling.** The ceiling
  thresholds (B3) are app-invented, but the flag cites 14 CFR 105.17, which
  governs cloud *clearance* and flight visibility. On screen it reads "Ceiling
  2,800 ft AGL · Caution · Source: 14 CFR § 105.17", implying the regulation
  prohibits that ceiling. Right regulation, wrong number.
- **C2 — USPA cited for meteorology.** "A small temperature–dew point spread
  favours fog and low ceilings" is atmospheric physics; the authority is NWS/AMS,
  not USPA.
- **C3 — A regulation named without a link.** The flight-category guidance names
  14 CFR 91.155 but cites AIM 7-1-7, which is non-regulatory and does not contain
  91.155. The ceiling & sky card names 14 CFR 105.17 in prose and renders no link
  at all.
- **C4 — Surface wind card shows no citation.** The most-read card on the page
  renders "Watch ≥ … · Caution ≥ …" under a heading calling them *limits*, with
  no source — despite already receiving the citation in its props.
- **C5 — Gust-spread flag cites the wrong one of two available.** It hardcodes
  the generic weather citation while the adjacent wind flags use the profile's
  citation. For a waiver student, it cites the SIM index while the club waiver —
  which states an explicit gust ceiling for that exact tier — sits one line away.
- **C6 — README overclaims provenance.** It says the numbers "reflect
  well-established USPA (SIM/BSR) and FAA guidance"; per Part B, most reflect no
  such thing.
- **C7 — "~30–35 mph" pilot takeoff figure** (A4) has no source and is not a USPA
  matter.
- **C8 — Winds aloft data-source label.** Labelled "NOAA winds aloft (FD) · OMA"
  but the link goes to a generic page that does not select OMA — the same class
  of defect as a section-less SIM link.

---

## What was checked and found correct

Not everything needs review. These were audited and judged right, so they are not
in the list above: the 3 SM visibility floor → 14 CFR 105.17 (the rule literally
says 3 SM); overcast / no gaps → 105.17; flight category → AIM 7-1-7; density
altitude → FAA-P-8740-2 (FAA is the correct authority — a SIM citation here would
be *wrong*); and the waiver gust ceiling → club policy.

The opening-altitude passage (A2) is the best-cited thing in the app in form — it
names the figures, links the section, calls them floors rather than targets, and
flags itself as AI-derived. Its *numbers* still need checking, but its shape is
the pattern the rest should follow.
