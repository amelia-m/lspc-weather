import type { AltitudeSpread, ParitySummary } from '../domain/paritySummary';
import { Panel } from './common/Panel';

/**
 * "How different from other sources": what the live comparison logs add up
 * to, as figures a reader can weigh, with no grade attached.
 *
 * The data is public/parity/summary.json, written by the parity-summary
 * workflow from the @@parity lines the live scripts print (see
 * domain/paritySummary.ts). The site is static, so the page shows whatever
 * the last summary run published and says when that was. Two comparisons:
 * this dashboard's winds-aloft table against Mark Schulze's Winds Aloft at the
 * same valid hour (and, separately, what the two pages show at the same
 * minute), and this dashboard's decode of the latest KPMV observation against
 * usairnet's, field by field.
 */

export type ParityState = 'loading' | 'missing' | 'error' | 'ready';

const fmtDay = (iso: string | null): string =>
  iso == null
    ? '—'
    : new Date(iso).toLocaleString('en-US', {
        timeZone: 'America/Chicago',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });

const pct = (part: number, whole: number): string =>
  whole === 0 ? '—' : `${Math.round((100 * part) / whole)}%`;

const deg = (n: number | null): string => (n == null ? '—' : `${Math.round(n)}°`);
const kt = (n: number | null): string => (n == null ? '—' : `${Math.round(n)} kt`);

export function ParityPage({
  summary,
  state,
}: {
  summary: ParitySummary | null;
  state: ParityState;
}): JSX.Element {
  return (
    <div className="app">
      <header className="app-head">
        <div>
          <h1>How different from other sources</h1>
          <p className="app-sub">
            What the live comparison logs add up to · <a href="#">back to the dashboard</a>
          </p>
        </div>
      </header>

      <p className="disclaimer">
        <strong>Two comparisons, run on a schedule from a GitHub runner.</strong> The winds-aloft
        table against Mark Schulze&rsquo;s Winds Aloft, which reads the same Open-Meteo data, and
        this dashboard&rsquo;s decode of the latest KPMV observation against usairnet&rsquo;s page.
        The figures below are counts and spreads across those runs. They say how far apart the
        sources were, not which was right; where a cause is known it is written in{' '}
        <code>docs/markschulze-altitude-reference.md</code> and the open questions.
      </p>

      {state === 'loading' && <p className="muted small">Loading the latest summary…</p>}
      {state === 'missing' && (
        <p className="muted small">
          No summary has been published yet. The parity-summary workflow writes one daily from
          the comparison logs.
        </p>
      )}
      {state === 'error' && (
        <p className="muted small">The summary could not be read. Try again later.</p>
      )}

      {summary && (
        <>
          <p className="muted small cite-intro">
            Runs from {fmtDay(summary.from)} to {fmtDay(summary.to)} (local), summarised{' '}
            {fmtDay(summary.generatedAt)}.
          </p>
          <SchulzePanel s={summary} />
          <UsairnetPanel s={summary} />
        </>
      )}

      <footer className="app-foot">
        <a href="#">← Back to the dashboard</a>
      </footer>
    </div>
  );
}

function SchulzePanel({ s }: { s: ParitySummary }): JSX.Element {
  const w = s.schulze;
  return (
    <Panel title="Winds aloft vs Mark Schulze’s" subtitle={`${w.runs} runs, ${w.aligned} with a same-hour table`}>
      <p className="muted small">
        Same valid hour on both sides, row by row. Median and 90th-percentile absolute
        differences across runs, and the largest seen. {w.unreadable > 0 && `${w.unreadable} runs could not read one side.`}
      </p>
      <div className="sky-scroll">
        <table className="aloft-table">
          <thead>
            <tr>
              <th>ft AGL</th>
              <th>runs</th>
              <th>dir median</th>
              <th>dir 90th</th>
              <th>dir max</th>
              <th>speed median</th>
              <th>speed 90th</th>
              <th>speed max</th>
            </tr>
          </thead>
          <tbody>
            {w.byAltitude.map((r: AltitudeSpread) => (
              <tr key={r.ft}>
                <td>{r.ft.toLocaleString()}</td>
                <td>{r.n}</td>
                <td>{deg(r.medianAbsDir)}</td>
                <td>{deg(r.p90AbsDir)}</td>
                <td>{deg(r.maxAbsDir)}</td>
                <td>{kt(r.medianAbsSpd)}</td>
                <td>{kt(r.p90AbsSpd)}</td>
                <td>{kt(r.maxAbsSpd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="kv">
        <dt>Runs with any row over 10° apart</dt>
        <dd>
          {w.runsWithRowOver10Deg} of {w.aligned} ({pct(w.runsWithRowOver10Deg, w.aligned)})
        </dd>
        <dt>Runs with any row over 3 kt apart</dt>
        <dd>
          {w.runsWithRowOver3Kt} of {w.aligned} ({pct(w.runsWithRowOver3Kt, w.aligned)})
        </dd>
        <dt>Raw profiles disagreed (a newer forecast on one side)</dt>
        <dd>
          {w.rawMismatch.mismatched} of {w.rawMismatch.judged} ({pct(w.rawMismatch.mismatched, w.rawMismatch.judged)})
        </dd>
        <dt>Pages showed different hours at that minute</dt>
        <dd>
          {w.unaligned.hoursDiffered} of {w.unaligned.runs} ({pct(w.unaligned.hoursDiffered, w.unaligned.runs)}); when
          they did, the largest row difference was {deg(w.unaligned.medianMaxDirWhenDiffer)} median,{' '}
          {deg(w.unaligned.p90MaxDirWhenDiffer)} at the 90th percentile
        </dd>
        <dt>Ground row, median</dt>
        <dd>
          this dashboard {kt(w.ground.medianOurKt)}, Schulze&rsquo;s {kt(w.ground.medianTheirKt)}
          {w.ground.medianRatio != null && ` (ratio ${w.ground.medianRatio})`}, over {w.ground.n} runs
        </dd>
      </dl>
      <p className="muted small">
        The two pages show different hours in the second half of every hour: this card snaps to the
        nearest hour, Schulze&rsquo;s shows the hour in progress. That row measures what a reader
        comparing both pages at that minute sees; the table above measures the data.
      </p>
    </Panel>
  );
}

function UsairnetPanel({ s }: { s: ParitySummary }): JSX.Element {
  const u = s.usairnet;
  const readable = u.runs - u.unreadable;
  return (
    <Panel title="Latest observation vs usairnet’s decode" subtitle={`${u.runs} runs`}>
      <p className="muted small">
        Both sides showed the same observation time in {u.sameReport} of {readable} readable runs (
        {pct(u.sameReport, readable)}); the rest compared a report against the one before it.
        {u.unreadable > 0 && ` ${u.unreadable} runs could not read one side.`}
      </p>
      <div className="sky-scroll">
        <table className="aloft-table">
          <thead>
            <tr>
              <th>field</th>
              <th>runs</th>
              <th>agreed</th>
              <th>share</th>
            </tr>
          </thead>
          <tbody>
            {u.fields.map((f) => (
              <tr key={f.name}>
                <td>{f.name}</td>
                <td>{f.n}</td>
                <td>{f.agree}</td>
                <td>{pct(f.agree, f.n)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        A one-degree gap in temperature or dew point is the METAR body&rsquo;s whole degrees
        against the remarks&rsquo; tenths, which this dashboard reads.
      </p>
    </Panel>
  );
}
