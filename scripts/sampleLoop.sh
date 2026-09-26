#!/usr/bin/env bash
# One hour-long slice of the live comparison sampler, run by
# .github/workflows/schulze-compare.yml. Samples every five minutes for the
# given number of minutes and appends every @@parity line to one file.
#
#   scripts/sampleLoop.sh <minutes> <out.jsonl> [end-iso]
#
# Why a loop inside one job rather than a cron line per sample: GitHub ran
# the old every-fifteen-minutes schedule under ten percent of the time
# (2026-09-24 to 26), and moving it off the quarter-hour marks did not help.
# A job that is already running is not subject to that throttling, so four
# starts a day, each sampling for hours, get the samples a schedule never
# delivered. Each start begins at a different minute of the hour, which is
# what spreads the samples across the half-past boundary where this card and
# Schulze's page start showing different hours.
#
# The Schulze comparison runs every sample. The usairnet one runs every third
# (every fifteen minutes): it scrapes a page whose observation changes every
# twenty minutes, so sampling it faster only adds requests. The count lives
# in a file so the cadence holds across the workflow's hour-long steps.
#
# Never fails: a sample that cannot read a source logs that as its record
# (the scripts already do), and a crashed sample is skipped. The workflow
# uploads whatever the file holds after each slice.
set -u

minutes="$1"
out="$2"
end_iso="${3:-}"
every="${SAMPLE_EVERY_SECONDS:-300}"
count_file="${SAMPLE_COUNT_FILE:-.sample-count}"

start=$(date -u +%s)
stop=$((start + minutes * 60))
if [ -n "$end_iso" ]; then
  end=$(date -u -d "$end_iso" +%s)
  if [ "$end" -lt "$stop" ]; then stop=$end; fi
fi

touch "$out"
n=$(cat "$count_file" 2>/dev/null || echo 0)
k=0
while :; do
  now=$(date -u +%s)
  [ "$now" -ge "$stop" ] && break
  files="scripts/schulzeCompare.live.ts"
  if [ $((n % 3)) -eq 0 ]; then files="$files scripts/usairnetCompare.live.ts"; fi
  echo "== sample $n at $(date -u +%Y-%m-%dT%H:%M:%SZ): $files"
  # shellcheck disable=SC2086
  npx vitest run --config vitest.live.config.ts $files 2>&1 | tee sample.log | grep -a -E 'app valid|unaligned at|largest difference|same observation|fields agree|could not' || true
  grep -a '@@parity ' sample.log >> "$out" || true
  n=$((n + 1))
  echo "$n" > "$count_file"
  k=$((k + 1))
  # Paced from the slice's start, so a slow sample shortens the wait after it
  # instead of pushing every later sample back.
  next=$((start + k * every))
  now=$(date -u +%s)
  [ "$next" -ge "$stop" ] && break
  [ "$next" -gt "$now" ] && sleep $((next - now))
done
echo "slice done: $(grep -c '@@parity ' "$out") records in $out"
