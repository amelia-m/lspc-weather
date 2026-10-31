#!/usr/bin/env bash
# The forecast keeper's loop, run by .github/workflows/forecast-keep.yml:
# for the given number of minutes, keep a snapshot at minute KEEP_AT_MINUTE
# (default 23) of every hour (scripts/forecastKeep.ts) and commit each one
# to the `forecast-archive` branch as data/YYYY/MM/DD/HHMMZ.json.gz, pushing
# it before the next.
#
#   scripts/forecastKeepLoop.sh <minutes>
#
# A loop inside one job rather than a cron line per snapshot: GitHub ran the
# hourly `23 * * * *` schedule 10 times in about 47 hours (2026-10-13 to 15,
# docs/open-questions.md), and a job that is already running is not
# throttled. Snapshots fall on fixed marks of the clock, not on the job's
# start, so a run that starts while the last one's final hour is still open
# does not keep a second snapshot in it.
#
# Each snapshot is pushed on its own, so a job cut short keeps every hour it
# reached. A snapshot whose fetches both fail is not committed; one source
# failing is recorded in the file as { error } and committed. The loop runs
# to its end either way and then exits 1 if any hour was not kept, so a
# lost hour shows as a failed run, as it did when each run kept one.
#
# KEEP_EVERY_SECONDS (default 3600) changes the spacing, for a trial run;
# under a minute, files are named to the second so a trial does not
# overwrite its own snapshots.
set -u

minutes="$1"
every="${KEEP_EVERY_SECONDS:-3600}"
at_minute="${KEEP_AT_MINUTE:-23}"
tmp="${RUNNER_TEMP:-/tmp}"
archive="$tmp/forecast-archive"

start=$(date -u +%s)
stop=$((start + minutes * 60))

# The archive branch in its own worktree, so the job's checkout of main is
# left as it is. Every git command below names the worktree with -C, never
# a cd, so a worktree that failed to appear cannot turn them on main.
git worktree remove --force "$archive" 2>/dev/null || true
if git ls-remote --exit-code --heads origin forecast-archive >/dev/null; then
  git fetch --quiet origin forecast-archive && git worktree add --quiet --detach "$archive" FETCH_HEAD \
    || { echo "could not check out forecast-archive"; exit 1; }
else
  # Only when the remote says the branch is not there (not on a failed
  # fetch): start it empty.
  git worktree add --quiet --detach "$archive" || exit 1
  git -C "$archive" checkout --quiet --orphan forecast-archive || exit 1
  git -C "$archive" rm -rf --quiet . || true
fi
git -C "$archive" config user.name "forecast-keep workflow"
git -C "$archive" config user.email "actions@users.noreply.github.com"

# The next mark: the coming minute `at_minute` of an hour, or with a trial
# spacing, the next multiple of it.
next_mark() {
  local now=$1
  if [ "$every" -eq 3600 ]; then
    local m=$(( (now / 3600) * 3600 + at_minute * 60 ))
    [ "$m" -le "$now" ] && m=$((m + 3600))
    echo "$m"
  else
    echo $(( (now / every + 1) * every ))
  fi
}

# Commit one snapshot to the archive branch and push it. Each step is
# checked by hand: errexit does not hold inside a function or subshell whose
# status is tested, so a failed commit must not fall through to a push that
# succeeds with nothing in it.
keep_one() {
  local stamp=$1 w=$archive
  # Nothing else writes the branch while this runs (one run at a time, by
  # the workflow's concurrency group); starting from the remote's tip and
  # retrying a rejected push once covers a commit pushed by hand.
  if git -C "$w" fetch --quiet origin forecast-archive; then
    git -C "$w" reset --quiet --hard FETCH_HEAD || return 1
  fi
  mkdir -p "$w/data/$(dirname "$stamp")" || return 1
  cp "$tmp/snapshot.json.gz" "$w/data/$stamp.json.gz" || return 1
  git -C "$w" add "data/$stamp.json.gz" || return 1
  # The branch shows Open-Meteo's data, so it carries the credit its
  # licence asks for next to them (docs/open-meteo-terms.md), written once
  # and committed with the next snapshot. Until 2026-10-31 it had none.
  if [ ! -f "$w/README.md" ]; then
    cat > "$w/README.md" <<'README' || return 1
# Kept forecasts

One gzipped JSON file an hour (`scripts/forecastKeep.ts` on `main`): the
NWS gridpoint fields the dashboard reads and Open-Meteo's 10-day outlook
for the drop zone, each as served, unchanged. The NWS fields are NOAA's.

Weather data by [Open-Meteo.com](https://open-meteo.com/), under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

What the kept forecasts are set against is in `docs/forecast-chances.md`
and `docs/kept-forecasts-vs-kpmv.md` on `main`.
README
    git -C "$w" add README.md || return 1
  fi
  git -C "$w" commit --quiet -m "Keep forecasts ($stamp)" || return 1
  git -C "$w" push --quiet origin HEAD:forecast-archive && return 0
  git -C "$w" pull --quiet --rebase origin forecast-archive || return 1
  git -C "$w" push --quiet origin HEAD:forecast-archive
}

name_format='%Y/%m/%d/%H%MZ'
[ "$every" -lt 60 ] && name_format='%Y/%m/%d/%H%M%SZ'

kept=0
lost=0
while :; do
  now=$(date -u +%s)
  mark=$(next_mark "$now")
  # Stop if the next mark would fall after the end, leaving a minute to keep it.
  [ $((mark + 60)) -gt "$stop" ] && break
  sleep $((mark - now))

  stamp=$(date -u +"$name_format")
  echo "== keep at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  if ! npx tsx scripts/forecastKeep.ts "$tmp/snapshot.json.gz"; then
    echo "both sources failed; nothing committed for $stamp"
    lost=$((lost + 1))
    continue
  fi
  if keep_one "$stamp"; then
    kept=$((kept + 1))
  else
    echo "commit or push failed for $stamp"
    lost=$((lost + 1))
  fi
done
echo "loop done: $kept snapshot(s) kept, $lost not"
[ "$lost" -eq 0 ]
