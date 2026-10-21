import type { SkyLayer, SourceStatus, TafForecast } from '../domain/types';
import { compass, fmtTemp, type TempUnit } from '../domain/units';
import { haversineMiles, initialBearingDeg } from '../domain/geo';
import {
  decodeTaf,
  describeWx,
  periodFlightCategory,
  type TafPeriod,
  type TafWind,
} from '../domain/taf';
import { SITE } from '../config/site';
import { TAF_RELAY_URL } from '../config/tafRelay';
import { awcTafFor, DATA_SOURCES } from '../config/sources';
import { CITATIONS } from '../config/thresholds';
import { Panel } from './common/Panel';
import { FlightCategoryPill } from './common/FlightCategoryPill';
import { SourceLink } from './common/SourceLink';
import { fmtClock, fmtDateClock, shortError } from './format';
import { useNow } from '../hooks/useNow';

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
  relay = TAF_RELAY_URL != null,
  tempUnit = 'F',
}: {
  taf: TafForecast | null;
  status: SourceStatus;
  /** The page's °F/°C setting, for the forecast's TX/TN temperatures. */
  tempUnit?: TempUnit;
  /** Whether Offutt's TAF is read through the relay; a prop so the tests
   *  can render both wordings. */
  relay?: boolean;
}): JSX.Element {
  const { dz, tafStations } = SITE;
  const primary = tafStations[0];
  // The chain reports which station's TAF it found; fall back to the primary
  // for labeling when there is no TAF at all.
  const st = tafStations.find((s) => s.id === taf?.station) ?? primary;
  const miles = Math.round(haversineMiles(dz.lat, dz.lon, st.lat, st.lon));
  const bearing = compass(initialBearingDeg(dz.lat, dz.lon, st.lat, st.lon));
  const decoded = taf ? decodeTaf(taf.raw, taf.issuedMs) : null;
  // The chain passes over an ended TAF when it fetches, but a TAF can end
  // while it is on screen, and a failed refresh keeps the last one.
  const now = useNow(60_000);
  const endedMs = decoded?.validToMs != null && decoded.validToMs <= now ? decoded.validToMs : null;
  const nameOf = (id: string): string => {
    const s = tafStations.find((t) => t.id === id);
    return s ? `${s.name} (${id})` : id;
  };
  const kindsUsed = new Set(decoded?.periods.map((p) => p.change) ?? []);
  // The groups a joint-use airport's TAF adds (Offutt's; no NWS TAF has
  // them): each period's lowest altimeter setting, as a column of the table
  // so it sits beside its own row's label and times, and the forecast's
  // maximum and minimum temperatures, said in words under it.
  const hasQnh = decoded?.periods.some((p) => p.qnhInHg != null) ?? false;
  const jointUse: string[] = [];
  if (decoded) {
    if (hasQnh) jointUse.push('QNH: the lowest altimeter setting forecast for the row’s period, inches of mercury.');
    for (const t of decoded.temperatures) {
      jointUse.push(
        `${t.kind === 'max' ? 'Maximum' : 'Minimum'} temperature ${fmtTemp(t.tempC, tempUnit)}${t.atMs != null ? ` at ${fmtClock(t.atMs)}` : ''}.`,
      );
    }
  }

  return (
    <Panel
      title="TAF (forecast)"
      subtitle={taf ? `${st.id} · ~${miles} mi ${bearing} of DZ` : 'nearest available'}
      sources={[taf?.via === 'aviationweather' ? awcTafFor(taf.station) : DATA_SOURCES.taf]}
    >
      <p className="muted small">
        Terminal Aerodrome Forecast for {st.name} ({st.id}), ~{miles} mi {bearing} of the drop zone
        (KPMV issues no TAF). Regional guidance, not field-specific to NE69.
      </p>
      {/* The nearest station's "no TAF" has its own note below, with the
          link to read it elsewhere. */}
      {taf?.passedOver?.filter((p) => !('none' in p && p.station === primary.id)).map((p) => (
        <p className="muted small" key={p.station}>
          {'none' in p
            ? `${nameOf(p.station)} had no TAF in its feed.`
            : 'failed' in p
            ? `${nameOf(p.station)}’s TAF could not be fetched (${shortError(p.failed)}).`
            : 'endedMs' in p
            ? `${nameOf(p.station)}’s latest TAF ended at ${fmtDateClock(p.endedMs)}, and the feed has no newer one.`
            : p.noForecast === 'CNL'
              ? `${nameOf(p.station)}’s latest TAF is a cancellation (CNL).`
              : `${nameOf(p.station)}’s latest TAF carries no forecast (NIL).`}
        </p>
      ))}
      {/* Shown when the nearest station answered with no TAF, the everyday
          case without the relay; not when it was passed over for a reason
          of its own, which the notes above give. */}
      {taf && taf.station !== primary.id && !taf.passedOver?.some((p) => p.station === primary.id && !('none' in p)) && (
        <p className="muted small">
          {relay
            ? `${primary.name} (${primary.id}) is nearer, but aviationweather.gov had no TAF for it when this was fetched.`
            : `${primary.name} (${primary.id}) is nearer, but its TAF is issued by the USAF and the NWS feed this page reads does not carry it.`}{' '}
          Read{' '}
          {primary.id}&rsquo;s TAF at{' '}
          <a href={DATA_SOURCES.awcTafPrimary.url} target="_blank" rel="noopener noreferrer">
            aviationweather.gov
          </a>
          .
        </p>
      )}
      {!taf ? (
        <p className="muted">
          {status.error
            ? `TAF unavailable — ${status.error}. Retrying automatically; the raw TAF is on the AWC link below.`
            : status.pending
              ? 'Fetching TAF…'
              : `No current TAF available from ${tafStations.map((s) => s.id).join(', ')}.`}
        </p>
      ) : (
        <>
          <dl className="kv">
            <dt>Issued</dt>
            <dd>{taf.issuedMs != null ? fmtClock(taf.issuedMs) : '—'}</dd>
            <dt>Valid</dt>
            <dd>{taf.validRaw ? `${taf.validRaw} (UTC day/hr)` : '—'}</dd>
          </dl>
          {endedMs != null && (
            <p className="small">
              This TAF&rsquo;s valid period ended at {fmtDateClock(endedMs)}, and no newer one has
              been fetched since.
            </p>
          )}
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
                      {hasQnh && <th>QNH</th>}
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
                          {hasQnh && <td>{p.qnhInHg != null ? `${p.qnhInHg.toFixed(2)} inHg` : ''}</td>}
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
                {jointUse.length > 0 && (
                  <>
                    {' '}
                    {jointUse.join(' ')} Source: <SourceLink citation={CITATIONS.faaJointUseTaf} />
                  </>
                )}
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
