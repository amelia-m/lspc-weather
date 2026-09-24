import type { SkyLayer, SourceStatus, TafForecast } from '../domain/types';
import { compass } from '../domain/units';
import { haversineMiles, initialBearingDeg } from '../domain/geo';
import {
  decodeTaf,
  describeWx,
  periodFlightCategory,
  type TafPeriod,
  type TafWind,
} from '../domain/taf';
import { SITE } from '../config/site';
import { DATA_SOURCES } from '../config/sources';
import { CITATIONS } from '../config/thresholds';
import { Panel } from './common/Panel';
import { FlightCategoryPill } from './common/FlightCategoryPill';
import { SourceLink } from './common/SourceLink';
import { fmtClock } from './format';

/** What each kind of change group means, in the words a reader can check
 *  against AC 00-45H chapter 5. The label is the row's first column; the
 *  sentence is the legend under the table. */
const GROUP_WORDS: Record<TafPeriod['change'], { label: string; means: string }> = {
  BASE: { label: 'Prevailing', means: 'the forecast from the start of the period' },
  FM: { label: 'From', means: 'a new prevailing forecast from that time; every element is restated' },
  TEMPO: {
    label: 'Temporary',
    means: 'fluctuations lasting under an hour at a time inside the window; only the stated elements change',
  },
  BECMG: { label: 'Becoming', means: 'a gradual change through the window to the stated elements' },
  PROB: { label: 'Chance', means: 'the stated elements have that chance inside the window' },
};

/** "Sun 1:00 PM" over "to 9:00 PM", repeating the weekday only when it
 *  changes. Two lines, so the widest column fits a two-column card. */
function whenLines(fromMs: number | null, toMs: number | null): JSX.Element | string {
  if (fromMs == null || toMs == null) return '—';
  const from = fmtClock(fromMs);
  const to = fmtClock(toMs);
  const day = from.slice(0, 3);
  return (
    <>
      <span className="taf-layer">{from}</span>
      <span className="taf-layer">to {to.startsWith(day) ? to.slice(4) : to}</span>
    </>
  );
}

function windText(w: TafWind | null): string {
  if (!w) return '';
  if (w.speedKt === 0) return 'calm';
  const dir = w.variable ? 'VRB' : `${String(w.directionDeg).padStart(3, '0')}°`;
  return `${dir} ${w.speedKt}${w.gustKt != null ? ` G${w.gustKt}` : ''} kt`;
}

function visText(p: TafPeriod): string {
  if (p.visibilitySm == null) return '';
  return `${p.visibilityPlus ? '6+' : p.visibilitySm} SM`;
}

/** One line per layer, so a wrap never splits a base from its unit. */
function skyLines(layers: SkyLayer[] | null): JSX.Element[] {
  if (!layers) return [];
  return layers.map((l, i) => (
    <span className="taf-layer" key={i}>
      {l.baseFtAgl != null ? `${l.cover} ${l.baseFtAgl.toLocaleString()} ft` : l.cover}
    </span>
  ));
}

export function TafPanel({
  taf,
  status,
}: {
  taf: TafForecast | null;
  status: SourceStatus;
}): JSX.Element {
  const { dz, tafStations } = SITE;
  const primary = tafStations[0];
  // The chain reports which station's TAF it found; fall back to the primary
  // for labeling when there is no TAF at all.
  const st = tafStations.find((s) => s.id === taf?.station) ?? primary;
  const miles = Math.round(haversineMiles(dz.lat, dz.lon, st.lat, st.lon));
  const bearing = compass(initialBearingDeg(dz.lat, dz.lon, st.lat, st.lon));
  const decoded = taf ? decodeTaf(taf.raw, taf.issuedMs) : null;
  const kindsUsed = new Set(decoded?.periods.map((p) => p.change) ?? []);

  return (
    <Panel
      title="TAF (forecast)"
      subtitle={taf ? `${st.id} · ~${miles} mi ${bearing} of DZ` : 'nearest available'}
      sources={[DATA_SOURCES.taf]}
    >
      <p className="muted small">
        Terminal Aerodrome Forecast for {st.name} ({st.id}), ~{miles} mi {bearing} of the drop zone
        (KPMV issues no TAF). Regional guidance, not field-specific to NE69.
      </p>
      {taf && taf.station !== primary.id && (
        <p className="muted small">
          {primary.id} ({primary.name}) had no TAF on the NWS feed — its USAF-issued TAF isn&rsquo;t
          always carried there — so this is the next-nearest station.
        </p>
      )}
      {!taf ? (
        <p className="muted">
          {status.error
            ? `TAF unavailable — ${status.error}. Retrying automatically; the raw TAF is on the AWC link below.`
            : status.pending
              ? 'Fetching TAF…'
              : `No TAF available from ${tafStations.map((s) => s.id).join(', ')}.`}
        </p>
      ) : (
        <>
          <dl className="kv">
            <dt>Issued</dt>
            <dd>{taf.issuedMs != null ? fmtClock(taf.issuedMs) : '—'}</dd>
            <dt>Valid</dt>
            <dd>{taf.validRaw ? `${taf.validRaw} (UTC day/hr)` : '—'}</dd>
          </dl>
          <pre className="metar-raw">{taf.raw}</pre>
          {decoded && decoded.periods.length > 0 && (
            <>
              {/* The raw text stays above: a decode can be wrong, and the
                  text is what a pilot or S&TA cross-checks. The table says
                  what each group states and leaves the rest blank rather
                  than fill it in. */}
              <div className="taf-scroll">
                <table className="taf-table">
                  <thead>
                    <tr>
                      <th>Group</th>
                      <th>When (local)</th>
                      <th>Wind</th>
                      <th>Vis</th>
                      <th>Sky</th>
                      <th>Weather</th>
                      <th>Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {decoded.periods.map((p, i) => {
                      const cat = periodFlightCategory(decoded.periods, i);
                      const label =
                        p.change === 'PROB' && p.probability != null
                          ? `${p.probability}% chance`
                          : GROUP_WORDS[p.change].label;
                      return (
                        <tr key={p.raw + i} title={p.raw}>
                          <td>{label}</td>
                          <td>{whenLines(p.fromMs, p.toMs)}</td>
                          <td>{windText(p.wind)}</td>
                          <td>{visText(p)}</td>
                          <td className="taf-wrap">{skyLines(p.skyLayers)}</td>
                          <td className="taf-wrap">{p.wxString != null ? describeWx(p.wxString) : ''}</td>
                          <td>{cat ? <FlightCategoryPill category={cat} /> : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="muted small">
                Decoded from the text above.{' '}
                {[...kindsUsed].map((k) => `${GROUP_WORDS[k].label}: ${GROUP_WORDS[k].means}.`).join(' ')}{' '}
                {kindsUsed.has('TEMPO') || kindsUsed.has('BECMG') || kindsUsed.has('PROB')
                  ? 'A blank cell on a change row means that element stays as the prevailing row says. '
                  : ''}
                Category is the FAA classification of the row&rsquo;s ceiling and visibility, a
                description of the weather and not a jump rule. Source:{' '}
                <SourceLink citation={CITATIONS.aimFlightCategory} />
                {decoded.undecoded.length > 0 && (
                  <>
                    {' '}
                    Not decoded: <code>{decoded.undecoded.join(' ')}</code>.
                  </>
                )}
              </p>
            </>
          )}
        </>
      )}
    </Panel>
  );
}
