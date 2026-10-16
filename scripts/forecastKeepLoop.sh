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
# reached. A snapshot whose fetches both fail is not committed (the script
# exits 1, as the one-shot workflow's step did); one source failing is
# recorded in the file as { error } and committed.
#
# KEEP_EVERY_SECONDS (default 3600) changes the spacing, for a trial run.
set -u

minutes="$1"
every="${KEEP_EVERY_SECONDS:-3600}"
at_minute="${KEEP_AT_MINUTE:-23}"
tmp="${RUNNER_TEMP:-/tmp}"
archive="$tmp/forecast-archive"

start=$(date -u +%s)
stop=$((start + minutes * 60))

# The archive branch in its own worktree, so the job's checkout of main is
# left as it is.
git worktree remove --force "$archive" 2>/dev/null || true
if git fetch --quiet origin forecast-archive; then
  git worktree add --quiet --detach "$archive" FETCH_HEAD
else
  # First run on a repository without the branch: start it empty.
  git worktree add --quiet --detach "$archive"
  git -C "$archive" checkout --quiet --orphan forecast-archive
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

kept=0
while :; do
  now=$(date -u +%s)
  mark=$(next_mark "$now")
  # Stop if the next mark would fall after the end, leaving a minute to keep it.
  [ $((mark + 60)) -gt "$stop" ] && break
  sleep $((mark - now))

  stamp=$(date -u +%Y/%m/%d/%H%MZ)
  echo "== keep at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  if ! npx tsx scripts/forecastKeep.ts "$tmp/snapshot.json.gz"; then
    echo "both sources failed; nothing committed for $stamp"
    continue
  fi
  # Push this one before the next; another writer (a dispatched run) may
  # have pushed in between, so start from the branch as it stands and
  # retry once on a rejected push.
  (
    set -e
    cd "$archive"
    if git fetch --quiet origin forecast-archive; then git reset --quiet --hard FETCH_HEAD; fi
    mkdir -p "data/$(dirname "$stamp")"
    cp "$tmp/snapshot.json.gz" "data/$stamp.json.gz"
    git add "data/$stamp.json.gz"
    git commit --quiet -m "Keep forecasts ($stamp)"
    git push --quiet origin HEAD:forecast-archive \
      || { git pull --quiet --rebase origin forecast-archive && git push --quiet origin HEAD:forecast-archive; }
  ) && kept=$((kept + 1)) || echo "commit or push failed for $stamp"
done
echo "loop done: $kept snapshot(s) kept"
