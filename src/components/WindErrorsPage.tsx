import { METAR_STATION_OFFSET, SITE, repoDoc } from '../config/site';
import {
  histogramLine,
  signed,
  spanDay,
  yStep,
  type Histogram,
  type WindErrorSection,
  type WindErrorsData,
} from '../domain/windErrors';
import type { SiteJsonState } from '../hooks/useSiteJson';
import { Panel } from './common/Panel';
import { OpenMeteoCredit } from './OpenMeteoCredit';

/**
 * "How far the wind forecasts were from KPMV": histograms of forecast minus
 * reported wind speed, gust and direction, for the NWS forecasts the keeper
 * saved hourly (by lead), the same forecast from NOAA's archive (by lead),
 * Open-Meteo's own archive of its forecasts (by run) and the surface-wind sample's Open-Meteo and NWS forecasts (by
 * source).
 *
 * The data is public/wind-errors/summary.json, written by
 * scripts/windErrorsData.ts with the binning in src/domain/windErrors.ts,
 * the same figures the docs' tables and drawings give. Like #parity: counts
 * and spreads, never a grade. A histogram off zero says which side a
 * forecast fell on at this station over these days, not that it is wrong
 * for a jump, and nothing on the dashboard reads any of it.
 */

/** One histogram as its own small chart, so the panels reflow to one column
 *  on a phone. Forecast minus reported along the bottom, zero dashed; each
 *  bar titled with its count, so a hover or a long press names it. */
function HistogramChart({ h, unitWord }: { h: Histogram; unitWord: string }): JSX.Element {
  const W = 300;
  const PH = 120;
  const top0 = 6;
  const max = Math.max(1, ...h.counts);
  const step = yStep(max);
  const top = Math.ceil(max / step) * step;
  const L = 28;
  const pw = W - L - 4;
  const bw = pw / h.counts.length;
  const xOf = (v: number) => L + ((v - h.lo) / h.bin + 0.5) * bw;
  const yOf = (c: number) => top0 + PH - (c / top) * PH;
  const tickEvery = h.bin === 1 ? 4 : 50;
  const ticks: number[] = [];
  for (let v = Math.ceil(h.lo / tickEvery) * tickEvery; v <= h.hi; v += tickEvery) ticks.push(v);
  const gridlines: number[] = [];
  for (let c = step; c <= top; c += step) gridlines.push(c);
  const base = top0 + PH;
  const summary = histogramLine(h);
  return (
    <figure className="werr-fig">
      <figcaption className="werr-cap">{summary}</figcaption>
      <svg
        className="werr-svg"
        viewBox={`0 0 ${W} ${base + 22}`}
        role="img"
        aria-label={`${h.title}, forecast minus reported: ${summary}`}
      >
        {gridlines.map((c) => (
          <g key={c}>
            <line className="werr-grid" x1={L} x2={L + pw} y1={yOf(c)} y2={yOf(c)} />
            <text className="werr-tick" x={L - 4} y={yOf(c) + 3} textAnchor="end">
              {c}
            </text>
          </g>
        ))}
        <line className="werr-zero" x1={xOf(0)} x2={xOf(0)} y1={top0 - 2} y2={base} />
        {h.counts.map((c, i) => {
          if (c === 0) return null;
          const v = h.lo + i * h.bin;
          const x = L + i * bw + 1;
          const w = Math.max(1, bw - 2);
          const y = yOf(c);
          const r = Math.min(3, w / 2, base - y);
          return (
            <path
              key={i}
              className="werr-bar"
              d={`M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${base} Z`}
            >
              <title>{`${signed(v)} ${h.unit}: ${c} ${unitWord}${c === 1 ? '' : 's'}`}</title>
            </path>
          );
        })}
        <line className="werr-base" x1={L} x2={L + pw} y1={base} y2={base} />
        {ticks.map((v) => (
          <text key={v} className="werr-tick" x={xOf(v)} y={base + 14} textAnchor="middle">
            {signed(v)}
          </text>
        ))}
      </svg>
      {h.outside > 0 && <p className="werr-out">{h.outside} beyond the axis</p>}
    </figure>
  );
}

function SectionPanel({ s, intro }: { s: WindErrorSection; intro: JSX.Element }): JSX.Element {
  const unitWord = s.unitWord;
  return (
    <Panel title={s.title} subtitle={`${spanDay(s.first)} to ${spanDay(s.last)} · ${unitWord}s per bin`}>
      {intro}
      {s.rows.map((row) => (
        <section key={row.label} className="werr-row">
          <h3 className="werr-row-head">{row.label}</h3>
          <div className="werr-grid-row">
            {row.panels.map((h) => (
              <div key={h.quantity} className="werr-cell">
                <p className="werr-title">{h.title}</p>
                <HistogramChart h={h} unitWord={unitWord} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </Panel>
  );
}

export function WindErrorsPage({ data, state }: { data: WindErrorsData | null; state: SiteJsonState }): JSX.Element {
  const kept = data?.sections.find((s) => s.id === 'nws-kept');
  const nwsArchive = data?.sections.find((s) => s.id === 'nws-archive');
  const archive = data?.sections.find((s) => s.id === 'om-archive');
  const sample = data?.sections.find((s) => s.id === 'surface-sample');
  const station = `${SITE.metarStation.id}, ~${Math.round(METAR_STATION_OFFSET.distanceMi)} mi ${METAR_STATION_OFFSET.compass} of the drop zone`;
  return (
    <div className="app">
      <header className="app-head">
        <div>
          <h1>How far the wind forecasts were from KPMV</h1>
          <p className="app-sub">
            Forecast minus reported surface wind · <a href="#">back to the dashboard</a>
          </p>
        </div>
      </header>

      <p className="disclaimer">
        <strong>Each chart counts how far a forecast was from the report.</strong> Right of the dashed
        line the forecast was above the report, left of it below. The reports are {station}. They are counts over
        these days at this one station, not a grade: which side a forecast fell on here says nothing
        about whether a jump was safe, and nothing on the dashboard reads them. The forecasts are for
        the drop zone, so part of every difference is the distance.
      </p>
      {(archive || sample) && (
        <p className="muted small">
          <OpenMeteoCredit scope="surface" surface={{ archive: archive != null, sample: sample != null }} />
        </p>
      )}

      {state === 'loading' && <p className="muted small">Loading the wind figures…</p>}
      {state === 'missing' && <p className="muted small">No wind figures have been published yet.</p>}
      {state === 'error' && <p className="muted small">The wind figures could not be read. Try again later.</p>}

      {kept && (
        <SectionPanel
          s={kept}
          intro={
            <p className="muted small">
              The NWS hourly forecast the dashboard&rsquo;s charts read, saved every hour, set against the
              KPMV report nearest each hour&rsquo;s start. One row per lead: the newest forecast made at
              least that long before the hour. Speed in whole knots, as a METAR reports; the gust only
              where KPMV reported one, since a METAR gives a gust only when there is one to report;
              direction only where the report gave one. How it was paired:{' '}
              <a href={repoDoc('docs/kept-forecasts-vs-kpmv.md')} target="_blank" rel="noopener noreferrer">
                docs/kept-forecasts-vs-kpmv.md
              </a>
              .
            </p>
          }
        />
      )}
      {nwsArchive && (
        <SectionPanel
          s={nwsArchive}
          intro={
            <p className="muted small">
              The same NWS forecast, read from NOAA&rsquo;s archive of it (NDFD), which holds the months
              before the keeper started. Four forecasts a day, so the newest one before an hour is usually
              up to six hours older than the dashboard&rsquo;s, and older where the archive lacks a file.
              Paired and read by the same code as the section above. How it
              was fetched and read:{' '}
              <a href={repoDoc('docs/nws-gust-archive.md')} target="_blank" rel="noopener noreferrer">
                docs/nws-gust-archive.md
              </a>
              .
            </p>
          }
        />
      )}
      {archive && (
        <SectionPanel
          s={archive}
          intro={
            <p className="muted small">
              Open-Meteo&rsquo;s 10&nbsp;m wind for the drop zone from its own archive of past forecasts,
              set against KPMV as the NWS forecasts above are: the report nearest each hour&rsquo;s start,
              speed rounded to whole knots, the gust only where KPMV reported one, direction only where
              the report gave one. Two rows: the first hours of each model run, its best case, and the
              forecast made a day earlier. The dashboard&rsquo;s hours ahead come from runs in between. How
              it was fetched:{' '}
              <a href={repoDoc('docs/surface-wind-sources.md')} target="_blank" rel="noopener noreferrer">
                docs/surface-wind-sources.md
              </a>
              .
            </p>
          }
        />
      )}
      {sample && (
        <SectionPanel
          s={sample}
          intro={
            <p className="muted small">
              A sample taken every five minutes: each KPMV report once, against each forecast as it stood
              while that report was the newest. Open-Meteo&rsquo;s hourly, 15-minute and current 10 m wind,
              then the NWS hour on the same reports for reference. Every row here is kept to a tenth of a
              knot, as the sample&rsquo;s summary keeps it, and binned to the knot, so a tenth either side
              of zero sits in the zero bar and counts on neither side. How it was taken:{' '}
              <a href={repoDoc('docs/surface-wind-sources.md')} target="_blank" rel="noopener noreferrer">
                docs/surface-wind-sources.md
              </a>
              .
            </p>
          }
        />
      )}
      {data && <p className="muted small">Figures written {spanDay(data.generatedAt)}.</p>}

      <footer className="app-foot">
        <a href="#">← Back to the dashboard</a>
      </footer>
    </div>
  );
}
