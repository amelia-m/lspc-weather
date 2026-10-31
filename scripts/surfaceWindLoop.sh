#!/usr/bin/env bash
# One slice of the surface-wind sampler, run by
# .github/workflows/surface-wind-sample.yml. Runs
# scripts/surfaceWindCompare.live.ts every SAMPLE_EVERY_SECONDS (default
# 300, five minutes; the workflow sets 1020, seventeen minutes) for the
# given number of minutes and appends every @@parity line to one file.
#
#   SAMPLE_ANCHOR=<epoch seconds> scripts/surfaceWindLoop.sh <minutes> <out.jsonl> [end-iso]
#
# The samples are paced from SAMPLE_ANCHOR (the job's start, which the
# workflow sets once for its five slices; this slice's start when unset),
# not from the slice's start: paced from each one-hour slice, the samples
# fell on the same minutes of every hour of a job, whatever the cadence,
# and with a cadence that divides sixty (five, fifteen) on the same
# minutes of every hour of every job that started on time. Seventeen
# shares no factor with sixty, so paced from one anchor the samples walk
# through every minute of the hour (the maintainer, 2026-10-30: so the
# sample is not always at the same offset from the hour; KPMV's reports
# come at :15, :35 and :55, and new runs reach Open-Meteo at particular
# minutes). The optional end time is from the sampler's first, time-boxed
# run (2026-10-09 to 10-30); since 2026-10-30 the workflow runs without one.
#
# A loop inside one job rather than a cron line per sample, for the reason
# the 2026-09-30 comparison sampler used one (scripts/sampleLoop.sh, in the
# history): GitHub ran an every-fifteen-minutes schedule under ten percent of
# the time, and a job that is already running is not throttled.
#
# The comparison gains one pair per KPMV report, which comes every twenty
# minutes, so any cadence under that sees every report; five minutes gave
# the first sample its cadence rows (how often each source changes), and
# seventeen, the standing cadence since 2026-10-30, keeps Open-Meteo at two
# forecast calls a sample, about 170 a day against its 10,000
# (docs/surface-wind-sources.md, "What a longer sample needs").
#
# Never fails: a sample that cannot read a source logs that in its record
# (the script does), and a crashed sample is skipped. The workflow uploads
# whatever the file holds after each slice.
set -u

minutes="$1"
out="$2"
end_iso="${3:-}"
every="${SAMPLE_EVERY_SECONDS:-300}"

start=$(date -u +%s)
stop=$((start + minutes * 60))
if [ -n "$end_iso" ]; then
  end=$(date -u -d "$end_iso" +%s)
  if [ "$end" -lt "$stop" ]; then stop=$end; fi
fi
anchor="${SAMPLE_ANCHOR:-$start}"

touch "$out"
# The first tick at or after this slice's start on the anchor's grid, then
# every `every` seconds on that grid: a slow sample shortens the wait after
# it instead of pushing every later sample back, and a slice boundary adds
# no sample of its own. A tick the slice started a little after (the
# workflow writes the anchor a second or two before the first slice) still
# counts, so a job's first sample is at once, not a cadence later.
grace=120
k=$(( (start - anchor + every - 1 - grace) / every ))
[ "$k" -lt 0 ] && k=0
while :; do
  next=$((anchor + k * every))
  now=$(date -u +%s)
  if [ "$next" -ge "$stop" ]; then
    # No tick left in this slice: hold it to its full length, so the next
    # slice carries on the same grid with no gap between them.
    [ "$stop" -gt "$now" ] && sleep $((stop - now))
    break
  fi
  [ "$next" -gt "$now" ] && sleep $((next - now))
  # A sample that ran long (Open-Meteo timeouts) can carry the slice past
  # its end; the slice ends there rather than taking one more.
  [ "$(date -u +%s)" -ge "$stop" ] && break
  echo "== sample at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  SURFACE_WIND_SAMPLE=1 npx vitest run --config vitest.live.config.ts scripts/surfaceWindCompare.live.ts 2>&1 \
    | tee sample.log | grep -a -E 'METAR|NWS gridpoint|Open-Meteo|error' || true
  grep -a '@@parity ' sample.log >> "$out" || true
  k=$((k + 1))
done
echo "slice done: $(grep -c '@@parity ' "$out") records in $out"
