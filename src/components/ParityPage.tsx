import type {
  OverCauses,
  ParitySummary,
  Spread,
  TimeGapGroup,
  TimeGapKey,
  ArrivalLag,
  ArrivalSource,
  GroundBand,
  GroundDay,
  UsairnetField,
  UsairnetOutages,
  UsairnetTiming,
} from '../domain/paritySummary';
import { METAR_STATION_OFFSET, SITE } from '../config/site';
import { Panel } from './common/Panel';
import { OpenMeteoCredit } from './OpenMeteoCredit';
import { ParityContext } from './ParityContext';
import { ParityTimeline } from './ParityTimeline';

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
        timeZone: SITE.timeZone,
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });

const pct = (part: number, whole: number): string =>
  whole === 0 ? '—' : `${Math.round((100 * part) / whole)}%`;

const num = (n: number | null | undefined): string =>
  n == null ? '—' : Number.isInteger(n) ? String(n) : n.toFixed(n < 10 ? 2 : 1);
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
      {/* Any summary carries Open-Meteo figures: the winds comparison, and
          the context notes quote its sunset and 10 m wind. This page renders
          instead of the dashboard, footer and all. */}
      {summary && (
        <p className="muted small">
          <OpenMeteoCredit scope="winds" />
        </p>
      )}

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
          <GlancePanel s={summary} />
          <SchulzePanel s={summary} />
          <UsairnetPanel s={summary} />
          <ParityTimeline />
          <ParityContext />
        </>
      )}

      <footer className="app-foot">
        <a href="#">← Back to the dashboard</a>
      </footer>
    </div>
  );
}

/**
 * The few figures the sections below add up to, each computed from the
 * summary, so they move with it. Sentences that state a count or a spread
 * and stop: no line says whether a figure is good enough, which is the
 * reader's call (the page's rule, and the dashboard's).
 */
function GlancePanel({ s }: { s: ParitySummary }): JSX.Element | null {
  const sameRun = s.schulze.byTimeGap?.find((g) => g.key === 'same-hour-same-run');
  const u = s.usairnet;
  const fields = u.fieldsSameReport?.filter((f) => f.n > 0) ?? [];
  const always = fields.filter((f) => f.agree === f.n);
  const sometimes = fields.filter((f) => f.agree < f.n);
  const t = u.timingSinceIem;
  const lags = u.arrival?.filter((a) => a.lagMin != null) ?? [];
  const lines: JSX.Element[] = [];
  if (sameRun?.dir && sameRun.spd) {
    lines.push(
      <li key="winds">
        <strong>Winds aloft, same hour and forecast run:</strong> {num(sameRun.dir.medianAbs)}° and{' '}
        {num(sameRun.spd.medianAbs)} kt apart at the median, {num(sameRun.dir.maxAbs)}° and{' '}
        {num(sameRun.spd.maxAbs)} kt at the most, over {sameRun.runs} runs (1,000 ft and up).
      </li>,
    );
  }
  if (fields.length > 0) {
    lines.push(
      <li key="fields">
        <strong>Latest observation, same report on both sides:</strong> {always.length} of{' '}
        {fields.length} fields agreed on every run
        {sometimes.length > 0 &&
          `; the others differed on some runs: ${sometimes
            .map((f) =>
              f.spread ? `${f.name} by up to ${num(f.spread.maxAbs)}` : `${f.name} on ${f.n - f.agree} of ${f.n}`,
            )
            .join(', ')}`}
        .
      </li>,
    );
  }
  if (t && t.timed > 0) {
    lines.push(
      <li key="newer">
        <strong>When the two showed different reports</strong> (since this dashboard reads IEM first):
        this dashboard had the newer one in {t.dashboardNewer} of {t.timed} runs.
      </li>,
    );
  }
  if (lags.length > 0) {
    lines.push(
      <li key="arrival">
        <strong>Median minutes from a report to each source:</strong>{' '}
        {lags.map((a) => `${ARRIVAL_SHORT[a.source]} ${mins(a.lagMin?.medianAbs)}`).join(', ')}.
      </li>,
    );
  }
  if (lines.length === 0) return null;
  return (
    <Panel title="At a glance" subtitle="from the sections below">
      <ul className="cite-found">{lines}</ul>
    </Panel>
  );
}

/** One quantity per table, six columns, so a phone can read it without the
 *  eight-column squeeze one combined table would need. Old summaries without a
 *  spread for a row render dashes rather than failing. */
function SpreadTable({
  title,
  unit,
  rows,
}: {
  title: string;
  unit: string;
  rows: [number, Spread | undefined][];
}): JSX.Element {
  const v = (x: number | undefined): string => (x == null ? '—' : `${num(x)}${unit}`);
  return (
    <div className="sky-scroll">
      <table className="aloft-table">
        <thead>
          <tr>
            <th>{title}, ft AGL</th>
            <th>runs</th>
            <th>avg diff</th>
            <th>median</th>
            <th>90th</th>
            <th>min diff</th>
            <th>max diff</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([ft, sp]) => (
            <tr key={ft}>
              <td>{ft.toLocaleString()}</td>
              <td>{sp?.n ?? '—'}</td>
              <td>{v(sp?.meanAbs)}</td>
              <td>{v(sp?.medianAbs)}</td>
              <td>{v(sp?.p90Abs)}</td>
              <td>{v(sp?.minAbs)}</td>
              <td>{v(sp?.maxAbs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const GAP_LABEL: Record<TimeGapKey, string> = {
  'same-hour-same-run': 'Same hour, same forecast run',
  'same-hour-different-run': 'Same hour, one side on a newer run',
  'one-hour-apart': 'One hour apart',
};

/** The differences grouped by the time the two tables represented, one row
 *  per group, direction and speed side by side so the rows compare at a
 *  glance. Dashes where a group has no runs yet. */
function TimeGapTable({ groups }: { groups: TimeGapGroup[] }): JSX.Element {
  const d = (x: number | undefined): string => (x == null ? '—' : `${num(x)}°`);
  const k = (x: number | undefined): string => (x == null ? '—' : `${num(x)} kt`);
  return (
    <div className="sky-scroll">
      <table className="aloft-table">
        <thead>
          <tr>
            <th>Time the tables represent</th>
            <th>runs</th>
            <th>avg dir</th>
            <th>median dir</th>
            <th>90th dir</th>
            <th>max dir</th>
            <th>avg speed</th>
            <th>median speed</th>
            <th>90th speed</th>
            <th>max speed</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.key}>
              <td>{GAP_LABEL[g.key]}</td>
              <td>{g.runs}</td>
              <td>{d(g.dir?.meanAbs)}</td>
              <td>{d(g.dir?.medianAbs)}</td>
              <td>{d(g.dir?.p90Abs)}</td>
              <td>{d(g.dir?.maxAbs)}</td>
              <td>{k(g.spd?.meanAbs)}</td>
              <td>{k(g.spd?.medianAbs)}</td>
              <td>{k(g.spd?.p90Abs)}</td>
              <td>{k(g.spd?.maxAbs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SchulzePanel({ s }: { s: ParitySummary }): JSX.Element {
  const w = s.schulze;
  return (
    <Panel title="Winds aloft vs Mark Schulze’s" subtitle={`${w.runs} runs, ${w.aligned} with a same-hour table`}>
      {w.byTimeGap && (
        <>
          <p className="muted small">
            By how far apart in time the two tables were, every row from 1,000 ft up pooled. The
            surface row is left out because it differs for a reason of its own (the ground-row
            line below). &ldquo;One hour apart&rdquo; is what a reader comparing both pages sees
            after half past each hour, and fills from runs logged since Sep 26.
          </p>
          <TimeGapTable groups={w.byTimeGap} />
        </>
      )}
      {w.asSchulze && (
        <>
          <h4 className="cite-found-head">Built as Schulze&rsquo;s tool builds it</h4>
          <p className="muted small">
            Since Oct 8 each run also builds the same hour the way his tool does (his pressure
            levels below 18,000 ft, his ground, his Surface row, which is a rule inferred from his output)
            and sets it against his table: the check that this dashboard reproduces his.{' '}
            {w.asSchulze.runs > 0 ? (
              <>
                Every row within 1° and 1 kt, which is rounding, in {w.asSchulze.runsAllWithin1} of{' '}
                {w.asSchulze.runs} runs ({pct(w.asSchulze.runsAllWithin1, w.asSchulze.runs)}); a row
                over 10° in {w.asSchulze.runsWithRowOver10Deg}, over 3 kt in{' '}
                {w.asSchulze.runsWithRowOver3Kt}. Runs where the two were served different forecast
                runs fall outside rounding here too (the open question below).
              </>
            ) : (
              `No run has had rows to compare yet (${w.asSchulze.notBuilt} logged it empty).`
            )}
            {w.asSchulze.runs > 0 &&
              w.asSchulze.notBuilt > 0 &&
              ` Another ${w.asSchulze.notBuilt} ${w.asSchulze.notBuilt === 1 ? 'run' : 'runs'} logged it with no rows to compare and ${w.asSchulze.notBuilt === 1 ? 'is' : 'are'} left out.`}
          </p>
          {w.asSchulze.runs > 0 && (
            <>
              <SpreadTable title="Direction, as Schulze" unit="°" rows={w.asSchulze.byAltitude.map((r) => [r.ft, r.dir])} />
              <SpreadTable title="Speed, as Schulze" unit=" kt" rows={w.asSchulze.byAltitude.map((r) => [r.ft, r.spd])} />
            </>
          )}
          <h4 className="cite-found-head">This dashboard&rsquo;s table</h4>
        </>
      )}
      <p className="muted small">
        Same valid hour on both sides, row by row: how far apart the two tables were, as the
        average, median, 90th-percentile, smallest and largest absolute difference across runs.
        Since Oct 8 the table takes Open-Meteo&rsquo;s 80, 120 and 180&nbsp;m winds and seven
        pressure levels his does not, so from then these spreads include what those add.{' '}
        {w.unreadable > 0 && `${w.unreadable} runs could not read one side.`}
      </p>
      <SpreadTable title="Direction" unit="°" rows={w.byAltitude.map((r) => [r.ft, r.dir])} />
      <SpreadTable title="Speed" unit=" kt" rows={w.byAltitude.map((r) => [r.ft, r.spd])} />
      {/* Sentences, not a key-value grid: the kv layout is for short values
          beside short labels and wraps a sentence one word per line on a
          phone. */}
      <ul className="cite-found">
        <li>
          <strong>Runs with any row over 10° apart:</strong> {w.runsWithRowOver10Deg} of {w.aligned} (
          {pct(w.runsWithRowOver10Deg, w.aligned)}).
          {w.overCauses && <OverCauseText c={w.overCauses.dir} />}
        </li>
        <li>
          <strong>Runs with any row over 3 kt apart:</strong> {w.runsWithRowOver3Kt} of {w.aligned} (
          {pct(w.runsWithRowOver3Kt, w.aligned)}).
          {w.overCauses && <OverCauseText c={w.overCauses.spd} />}
        </li>
        <li>
          <strong>Raw profiles disagreed</strong> (a newer forecast on one side):{' '}
          {w.rawMismatch.mismatched} of {w.rawMismatch.judged} ({pct(w.rawMismatch.mismatched, w.rawMismatch.judged)}).
        </li>
        <li>
          <strong>Pages showed different hours at that minute:</strong> {w.unaligned.hoursDiffered} of{' '}
          {w.unaligned.runs} ({pct(w.unaligned.hoursDiffered, w.unaligned.runs)}). When they did, the largest
          row difference was {deg(w.unaligned.medianMaxDirWhenDiffer)} median,{' '}
          {deg(w.unaligned.p90MaxDirWhenDiffer)} at the 90th percentile.
        </li>
        <li>
          <strong>Ground row, median:</strong> this dashboard {kt(w.ground.medianOurKt)}, Schulze&rsquo;s{' '}
          {kt(w.ground.medianTheirKt)}
          {w.ground.medianRatio != null && ` (ratio ${w.ground.medianRatio})`}, over {w.ground.n} runs.
        </li>
      </ul>
      <p className="muted small">
        The two pages show different hours in the second half of every hour: this card snaps to the
        nearest hour, Schulze&rsquo;s shows the hour in progress. That line and the &ldquo;One hour
        apart&rdquo; row measure what a reader comparing both pages at that minute sees; the
        per-altitude tables measure the same hour on both sides.
      </p>
      <GroundSection bands={w.groundByLocalHour} days={w.groundByLocalDay} />
    </Panel>
  );
}

/** "12–3\u00a0AM", "9\u00a0AM–12\u00a0PM": a three-hour block of the local day,
 *  the suffix written once when both ends share it, and held to its number
 *  so a phone column does not split "3" from "AM". */
const blockLabel = (from: number): string => {
  const to = (from + 3) % 24;
  const twelve = (h: number): number => (h % 12 === 0 ? 12 : h % 12);
  const half = (h: number): string => (h < 12 ? 'AM' : 'PM');
  return half(from) === half(to)
    ? `${twelve(from)}\u2013${twelve(to)}\u00a0${half(to)}`
    : `${twelve(from)}\u00a0${half(from)}\u2013${twelve(to)}\u00a0${half(to)}`;
};

/** Why the runs over a threshold were over, in one sentence: the Surface
 *  row alone (the two rows are different heights), a newer forecast run on
 *  one side, the same run, or unjudged. Counts, never a grade. */
function OverCauseText({ c }: { c: OverCauses }): JSX.Element {
  return (
    <>
      {' '}
      Of those, {c.surfaceOnly} only on the Surface row, which is a different height on each side
      (the ground row, below); {c.newerRun} with a newer forecast run on one side; {c.sameRunAloft}{' '}
      on the same run, from 1,000&nbsp;ft up
      {c.unjudgedAloft > 0 ? `; ${c.unjudgedAloft} from 1,000\u00a0ft up that could not be judged` : ''}.
    </>
  );
}

/** Knots to one decimal, whole numbers bare: the ground medians are of whole
 *  knots, so they end in .0 or .5; other figures can carry a tenth. */
const kt1 = (x: number): string => (Number.isInteger(x) ? String(x) : x.toFixed(1));

/**
 * Why the ground rows differ, and how far apart they ran through the day.
 * The two rows are different heights, worked out from 72 hours of Schulze's
 * output at four sites on 2026-10-03 (docs/markschulze-altitude-reference.md,
 * "How the surface row was worked out"); the Winds aloft card says Schulze's reads
 * higher most of all at night, and the table is the count behind that.
 */
/** "Oct 2" for the summary's local date "2026-10-02". Built from the parts,
 *  not parsed as a Date, which would read it as UTC midnight and show the
 *  day before in Nebraska. */
const fmtDate = (ymd: string): string => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
  });
};

function GroundSection({
  bands,
  days,
}: {
  bands: GroundBand[] | undefined;
  days: GroundDay[] | undefined;
}): JSX.Element {
  const k = (x: number | null): string => (x == null ? '—' : `${kt1(x)} kt`);
  const signed = (x: number | null): string => (x == null ? '—' : `${x > 0 ? '+' : ''}${kt1(x)} kt`);
  return (
    <>
      <h4 className="cite-found-head">The ground row</h4>
      <p className="muted small">
        The two Surface rows are different heights. This dashboard&rsquo;s is the model&rsquo;s
        wind at 10&nbsp;m (33&nbsp;ft), read at the field&rsquo;s elevation and in whole knots as
        the card shows it. Schulze&rsquo;s is a straight line through the model&rsquo;s
        pressure levels read at 0&nbsp;ft: at this drop zone, between a level the model places below
        the ground and the next one up; where no level is below ground, the two lowest extended
        down. That rule matched Schulze&rsquo;s Surface row in 72 of 72 hours at four sites on Oct 3 (written
        up in <code>docs/markschulze-altitude-reference.md</code>). So Schulze&rsquo;s reads more like the wind a
        couple of hundred feet up.
      </p>
      {bands && bands.some((b) => b.runs > 0) && (
        <div className="sky-scroll">
          <table className="aloft-table">
            <caption className="parity-caption">
              Same hour on both sides, by the local time of the forecast hour
            </caption>
            <thead>
              <tr>
                <th>local hours</th>
                <th>runs</th>
                <th>this dashboard</th>
                <th>Schulze&rsquo;s</th>
                <th>Schulze&rsquo;s minus ours</th>
              </tr>
            </thead>
            <tbody>
              {bands.map((b) => (
                <tr key={b.fromHour}>
                  <td>{blockLabel(b.fromHour)}</td>
                  <td>{b.runs}</td>
                  <td>{k(b.medianOurKt)}</td>
                  <td>{k(b.medianTheirKt)}</td>
                  <td>{signed(b.medianGapKt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {bands && bands.some((b) => b.runs > 0) && (
        <p className="muted small">
          Medians over the runs in each block. The last column is the median of each run&rsquo;s
          own difference, so it need not equal the gap between the two columns before it.
        </p>
      )}
      {days && days.length > 0 && (
        <div className="sky-scroll">
          <table className="aloft-table">
            <caption className="parity-caption">By local day of the forecast hour</caption>
            <thead>
              <tr>
                <th>day</th>
                <th>runs</th>
                <th>this dashboard</th>
                <th>Schulze&rsquo;s</th>
                <th>Schulze&rsquo;s minus ours</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.date}>
                  <td>{fmtDate(d.date)}</td>
                  <td>{d.runs}</td>
                  <td>{k(d.medianOurKt)}</td>
                  <td>{k(d.medianTheirKt)}</td>
                  <td>{signed(d.medianGapKt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/** The fields in the order a jumper reads a report, under a heading row
 *  each, so the surface wind can be read off without hunting through
 *  thirteen rows. A name not listed (a field added later) goes under
 *  "Other" rather than vanishing. */
const FIELD_GROUPS: { title: string; names: string[] }[] = [
  { title: 'Surface wind', names: ['wind mph', 'wind gust mph', 'wind dir °'] },
  { title: 'Sky and visibility', names: ['clouds', 'ceiling ft (theirs implied)', 'visibility mi', 'flight rule'] },
  { title: 'Temperature and moisture', names: ['temperature °F', 'dew point °F', 'humidity % (derived)'] },
  { title: 'Pressure', names: ['pressure inHg'] },
  { title: 'Sun', names: ['sunrise (min past midnight)', 'sunset (min past midnight)'] },
];

function groupFields(fields: readonly UsairnetField[]): { title: string; fields: UsairnetField[] }[] {
  const listed = new Set(FIELD_GROUPS.flatMap((g) => g.names));
  const groups = FIELD_GROUPS.map((g) => ({
    title: g.title,
    fields: g.names.flatMap((n) => fields.filter((f) => f.name === n)),
  }));
  groups.push({ title: 'Other', fields: fields.filter((f) => !listed.has(f.name)) });
  return groups.filter((g) => g.fields.length > 0);
}

/** One field per row: runs, agreements, and the absolute gaps where both
 *  sides were numbers. */
function FieldTable({ fields, caption }: { fields: UsairnetField[]; caption: string }): JSX.Element {
  return (
    <div className="sky-scroll">
      <table className="aloft-table">
        <caption className="parity-caption">{caption}</caption>
        <thead>
          <tr>
            <th>field</th>
            <th>runs</th>
            <th>agreed</th>
            <th>share</th>
            <th>avg diff</th>
            <th>min diff</th>
            <th>max diff</th>
          </tr>
        </thead>
        {groupFields(fields).map((g) => (
          <tbody key={g.title}>
            <tr className="parity-group">
              <th colSpan={7} scope="rowgroup">
                {g.title}
              </th>
            </tr>
            {g.fields.map((f) => (
              <tr key={f.name}>
                <td>{f.name}</td>
                <td>{f.n}</td>
                <td>{f.agree}</td>
                <td>{pct(f.agree, f.n)}</td>
                <td>{f.spread ? num(f.spread.meanAbs) : '—'}</td>
                <td>{f.spread ? num(f.spread.minAbs) : '—'}</td>
                <td>{f.spread ? num(f.spread.maxAbs) : '—'}</td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

const ARRIVAL_LABEL: Record<ArrivalSource, string> = {
  rawFile: 'NOAA raw METAR file',
  iem: 'IEM (the dashboard reads first)',
  usairnet: 'usairnet',
  nwsList: 'NWS observation list',
  nwsLatest: 'NWS latest (the dashboard’s backup)',
};

/** The same sources, short enough to list in one sentence. */
const ARRIVAL_SHORT: Record<ArrivalSource, string> = {
  rawFile: 'NOAA raw file',
  iem: 'IEM',
  usairnet: 'usairnet',
  nwsList: 'NWS list',
  nwsLatest: 'NWS latest',
};

/**
 * How long after each report each source first had it. Only counted where
 * two samples a few minutes apart bracket the report's arrival, which the
 * two-minute sampler provided (2026-09-30 to 10-05, its logs archived in
 * data/parity/) and runs hours apart rarely do; so the table shows the
 * sampler's cycles, and is hidden if there are none.
 */
function ArrivalTable({ lags }: { lags: ArrivalLag[] }): JSX.Element | null {
  if (!lags.some((a) => a.reports > 0)) return null;
  return (
    <>
      <div className="sky-scroll">
        <table className="aloft-table">
          <caption className="parity-caption">How soon each source had each report</caption>
          <thead>
            <tr>
              <th>source</th>
              <th>reports</th>
              <th>median</th>
              <th>90% within</th>
              <th>fastest</th>
              <th>slowest</th>
            </tr>
          </thead>
          <tbody>
            {lags.map((a) => (
              <tr key={a.source}>
                <td>{ARRIVAL_LABEL[a.source]}</td>
                <td>{a.reports}</td>
                <td>{mins(a.lagMin?.medianAbs)}</td>
                <td>{mins(a.lagMin?.p90Abs)}</td>
                <td>{mins(a.lagMin?.minAbs)}</td>
                <td>{mins(a.lagMin?.maxAbs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        Minutes from the time a KPMV report was taken to the first sample that found it at each
        source. The samples were two minutes apart, taken by a sampler that ran from Sep 30 to
        Oct 5, so each figure is up to two minutes later than the report really arrived, never
        earlier. The comparison runs since are hours apart and add a report only when two land
        within five minutes of each other.
      </p>
    </>
  );
}

/** "20 min" for a signed minute gap, as its size. */
const mins = (n: number | null | undefined): string => (n == null ? '—' : `${Math.round(Math.abs(n))} min`);

/** Which side had the newer report, over runs whose observation times
 *  differed. The NWS-list line only means something while NWS was the
 *  dashboard's only feed. */
function TimingList({ t, nwsOnly }: { t: UsairnetTiming; nwsOnly: boolean }): JSX.Element {
  return (
    <ul className="cite-found">
      <li>
        <strong>Which side was behind:</strong>{' '}
        {t.timed === 0
          ? `none of the ${t.mismatched} runs with different times logged both times yet (logged since Sep 27).`
          : `of the ${t.timed} runs with different times that logged both, usairnet had the newer report in ${t.usairnetNewer} and this dashboard in ${t.dashboardNewer}${
              t.timed < t.mismatched ? ` (${t.mismatched - t.timed} earlier runs did not log the times)` : ''
            }.`}
      </li>
      {t.gapMin && (
        <li>
          <strong>How far apart the two reports were:</strong> {mins(t.gapMin.medianAbs)} median,{' '}
          {mins(t.gapMin.minAbs)} to {mins(t.gapMin.maxAbs)}. KPMV reports every 20 minutes, so
          20 min is one report behind.
        </li>
      )}
      {nwsOnly && t.usairnetNewer > 0 && (
        <li>
          <strong>When this dashboard was behind:</strong> NWS&rsquo;s own observation list
          already held the newer report in {t.dashboardBehindNwsListHadIt} of {t.usairnetNewer}{' '}
          (the endpoint this dashboard read had not caught up), and did not yet have it in{' '}
          {t.dashboardBehindNwsListLacked}.
        </li>
      )}
    </ul>
  );
}

/**
 * Why a field can differ on the same report, for the causes that are known
 * and are neither side decoding the METAR wrongly. Shown only for a field
 * that did differ, so a cause is never offered for a row that has nothing
 * to explain. `upTo` is the largest gap the cause accounts for; a larger one
 * on the page gets a sentence saying the cause does not cover it, so the
 * line cannot pass for an explanation of a gap it does not explain (the
 * sunset rows logged before the app's sun times were corrected ran 4 min
 * apart, which no distance accounts for).
 *
 * The sun lines: usairnet's almanac is KPMV's, this dashboard's the drop
 * zone's; by NOAA's method (domain/sun.ts) the sun rises and sets 30 to 63
 * seconds earlier at KPMV through 2026, so rounded to the minute the two
 * can be one apart.
 */
const KNOWN_CAUSE: Record<string, { why: string; upTo: number | null }> = {
  'temperature °F': {
    why: 'usairnet shows the METAR body\u2019s whole degrees; this dashboard reads the remarks\u2019 tenths.',
    upTo: 1,
  },
  'dew point °F': {
    why: 'usairnet shows the METAR body\u2019s whole degrees; this dashboard reads the remarks\u2019 tenths.',
    upTo: 1,
  },
  'humidity % (derived)': {
    why: 'a METAR carries no humidity; each side works it out from its own temperature and dew point, so it carries their rounding.',
    upTo: null,
  },
  'sunrise (min past midnight)': {
    why: `usairnet's times are for ${SITE.metarStation.id}, ~${Math.round(METAR_STATION_OFFSET.distanceMi)} mi ${METAR_STATION_OFFSET.compass} of the drop zone, where the sun rises up to about a minute earlier; this dashboard's are for the drop zone.`,
    upTo: 1,
  },
  'sunset (min past midnight)': {
    why: `usairnet's times are for ${SITE.metarStation.id}, ~${Math.round(METAR_STATION_OFFSET.distanceMi)} mi ${METAR_STATION_OFFSET.compass} of the drop zone, where the sun sets up to about a minute earlier; this dashboard's are for the drop zone.`,
    upTo: 1,
  },
};

function KnownCauses({ fields }: { fields: UsairnetField[] }): JSX.Element | null {
  const explained = fields.filter((f) => f.agree < f.n && KNOWN_CAUSE[f.name]);
  if (explained.length === 0) return null;
  return (
    <>
      <h4 className="cite-found-head">Known reasons a field differs on the same report</h4>
      <ul className="cite-found">
        {explained.map((f) => {
          const cause = KNOWN_CAUSE[f.name];
          const beyond = cause.upTo != null && f.spread != null && f.spread.maxAbs > cause.upTo;
          return (
            <li key={f.name}>
              <strong>{f.name}</strong> ({f.n - f.agree} of {f.n} runs
              {f.spread ? `, by up to ${num(f.spread.maxAbs)}` : ''}): {cause.why}
              {beyond && ` That accounts for a gap of ${cause.upTo}, not the larger ones here.`}
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** Runs where one side could not be read, and the longest stretch
 *  usairnet's page stayed unreadable. */
function OutageLine({ o }: { o: UsairnetOutages }): JSX.Element | null {
  if (o.theirs === 0 && o.ours === 0) return null;
  const minutes = o.longest ? Math.round((Date.parse(o.longest.to) - Date.parse(o.longest.from)) / 60_000) : 0;
  return (
    <ul className="cite-found">
      <li>
        <strong>Runs that could not read one side:</strong> usairnet&rsquo;s page in {o.theirs}, this
        dashboard&rsquo;s feeds in {o.ours}.
        {o.longest &&
          o.longest.samples > 1 &&
          ` usairnet\u2019s failures came in ${o.stretches} unbroken ${o.stretches === 1 ? 'stretch' : 'stretches'}; the longest ran ${minutes} min, from ${fmtDay(o.longest.from)} to ${fmtDay(o.longest.to)} (${o.longest.samples} samples in a row).`}
      </li>
    </ul>
  );
}

/**
 * Two comparisons that must not share a table. When both sides show the
 * same observation, a difference is a decode difference. When they show two
 * observations twenty minutes apart, most of the difference is the weather
 * changing between them, and pooling the two would let that pass for a
 * decode gap (or hide one). So each gets its own table, and the runs where
 * the times differed also say which side was behind.
 */
function UsairnetPanel({ s }: { s: ParitySummary }): JSX.Element {
  const u = s.usairnet;
  const readable = u.runs - u.unreadable;
  const t = u.timing;
  return (
    <Panel title="Latest observation vs usairnet’s decode" subtitle={`${u.runs} runs`}>
      <p className="muted small">
        Both sides showed the same observation time in {u.sameReport} of {readable} readable runs (
        {pct(u.sameReport, readable)}); in the rest each showed a different report.
        {u.unreadable > 0 && !u.outages && ` ${u.unreadable} runs could not read one side.`}
      </p>
      {u.outages && <OutageLine o={u.outages} />}
      {u.timingSinceIem && u.feeds && u.feeds.iem + u.feeds.nws > 0 && (
        <>
          <h4 className="cite-found-head">Since this dashboard reads IEM first (Sep 29)</h4>
          <p className="muted small">
            IEM served the dashboard&rsquo;s report in {u.feeds.iem} of {u.feeds.iem + u.feeds.nws}{' '}
            runs, NWS in {u.feeds.nws} (NWS is shown only when its report is the newer one).
          </p>
          <TimingList t={u.timingSinceIem} nwsOnly={false} />
        </>
      )}
      {t && t.mismatched > 0 && (
        <>
          {u.feeds && u.feeds.iem + u.feeds.nws > 0 && (
            <h4 className="cite-found-head">Before, when NWS was its only feed</h4>
          )}
          <TimingList t={t} nwsOnly />
        </>
      )}
      {u.arrival && <ArrivalTable lags={u.arrival} />}
      {u.fieldsSameReport ? (
        <>
          <FieldTable fields={u.fieldsSameReport} caption="Same observation on both sides" />
          <KnownCauses fields={u.fieldsSameReport} />
          <FieldTable
            fields={u.fieldsDifferentReport ?? []}
            caption="Different observations, usually one report (20 min) apart"
          />
          <p className="muted small">
            The second table compares two reports taken at different times, so its differences
            are mostly the weather changing between them, not how either side decodes a report.
          </p>
          {u.arrival && (
            <p className="muted small">
              Some rows count only runs since the comparison or the app was corrected. Temperature
              and clouds count from Sep 30: before then usairnet&rsquo;s page was misread for rain or
              fog in its heading and for every overcast layer, which it writes &ldquo;Solid
              Overcast&rdquo;. Wind direction, visibility, sunrise and sunset count from Oct 3: before
              then gusting winds, fractional visibility and 360&deg; against the page&rsquo;s 0&deg;
              were misread, and this app&rsquo;s own sunrise and sunset ran up to 3 minutes late.
            </p>
          )}
        </>
      ) : (
        u.fields && (
          <>
            <FieldTable fields={u.fields} caption="All runs" />
            <p className="muted small">
              This summary was written before same-observation and different-observation runs
              were kept apart, so this one table pools both.
            </p>
          </>
        )
      )}
      <p className="muted small">
        Differences are absolute, in each field&rsquo;s own unit, over the runs that recorded a
        numeric gap; text fields (clouds, flight rule) only agree or differ.
      </p>
    </Panel>
  );
}
