#!/usr/bin/env bash
# One slice of the surface-wind sampler, run by
# .github/workflows/surface-wind-sample.yml. Runs
# scripts/surfaceWindCompare.live.ts every SAMPLE_EVERY_SECONDS (default
# 300, five minutes) for the given number of minutes and appends every
# @@parity line to one file.
#
#   scripts/surfaceWindLoop.sh <minutes> <out.jsonl> [end-iso]
#
# A loop inside one job rather than a cron line per sample, for the reason
# the 2026-09-30 comparison sampler used one (scripts/sampleLoop.sh, in the
# history): GitHub ran an every-fifteen-minutes schedule under ten percent of
# the time, and a job that is already running is not throttled.
#
# Five minutes because the comparison gains one pair per KPMV report (one in
# four samples sees a new one) and Open-Meteo is asked twice a sample, about
# 576 forecast calls a day against its 10,000 (docs/surface-wind-sources.md,
# "What a longer sample needs").
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

touch "$out"
k=0
while :; do
  now=$(date -u +%s)
  [ "$now" -ge "$stop" ] && break
  echo "== sample at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  SURFACE_WIND_SAMPLE=1 npx vitest run --config vitest.live.config.ts scripts/surfaceWindCompare.live.ts 2>&1 \
    | tee sample.log | grep -a -E 'METAR|NWS gridpoint|Open-Meteo|error' || true
  grep -a '@@parity ' sample.log >> "$out" || true
  k=$((k + 1))
  # Paced from the slice's start, so a slow sample shortens the wait after it
  # instead of pushing every later sample back.
  next=$((start + k * every))
  now=$(date -u +%s)
  [ "$next" -ge "$stop" ] && break
  [ "$next" -gt "$now" ] && sleep $((next - now))
done
echo "slice done: $(grep -c '@@parity ' "$out") records in $out"
