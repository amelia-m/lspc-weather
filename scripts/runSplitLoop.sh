#!/usr/bin/env bash
# One slice of the run-split sampler, run by
# .github/workflows/run-split-sample.yml. Runs scripts/runSplit.live.ts
# every SAMPLE_EVERY_SECONDS (default 240, four minutes) for the given
# number of minutes and appends every @@parity line to one file.
#
#   scripts/runSplitLoop.sh <minutes> <out.jsonl> [end-iso]
#
# A loop inside one job, as scripts/surfaceWindLoop.sh is, because GitHub
# throttles a cron line per sample and does not throttle a running job.
# Four minutes, the pace the 2026-09-30 sampler asked Mark Schulze's
# endpoint at for five days: each sample asks it twice (both hours) and
# Open-Meteo twice, about 720 of each a day (docs/run-split.md). A slice of
# an hour starts a moment after the last, so the minutes sampled drift and
# every part of the hour is covered.
#
# Never fails: a sample that cannot read a side records that (the script
# does), and a crashed sample is skipped.
set -u

minutes="$1"
out="$2"
end_iso="${3:-}"
every="${SAMPLE_EVERY_SECONDS:-240}"

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
  RUN_SPLIT_SAMPLE=1 npx vitest run --config vitest.live.config.ts scripts/runSplit.live.ts 2>&1 \
    | tee sample.log | grep -a -E '^(run split|offset|app vs|errors)' || true
  grep -a '@@parity ' sample.log >> "$out" || true
  k=$((k + 1))
  # Paced from the slice's start, so a slow sample shortens the wait after it.
  next=$((start + k * every))
  now=$(date -u +%s)
  [ "$next" -ge "$stop" ] && break
  [ "$next" -gt "$now" ] && sleep $((next - now))
done
echo "slice done: $(grep -c '@@parity ' "$out") records in $out"
