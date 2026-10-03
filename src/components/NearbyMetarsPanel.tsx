import { useState } from 'react';
import { NEARBY_METAR_NETWORK, NEARBY_METAR_STATIONS, SITE } from '../config/site';
import { DATA_SOURCES } from '../config/sources';
import { fetchIemNetwork } from '../api/nearbyMetars';
import { nearbyRows, type NearbyRow } from '../domain/nearbyMetars';
import { compass } from '../domain/units';
import { usePolling } from '../hooks/usePolling';
import { useNow } from '../hooks/useNow';
import { Panel } from './common/Panel';
import { FlightCategoryPill } from './common/FlightCategoryPill';
import { fmtAgo, shortError } from './format';

/** Every five minutes while the card is on screen. The stations report every
 *  20 to 60 minutes, so this keeps a row at most a few minutes behind IEM;
 *  the card is on the Pilots tab only, so the Jumpers tab never asks. */
const REFRESH_MS = 5 * 60_000;

/** "190° 15G22", "VRB 4", "Calm": the wind as a METAR states it, in knots
 *  (the column heading carries the unit, so a phone row stays narrow). */
function windText(r: NearbyRow): string {
  const w = r.current?.wind;
  if (!w || w.speedKt == null) return '—';
  if (w.speedKt === 0) return 'Calm';
  const dir = w.directionDeg == null ? 'VRB' : `${String(Math.round(w.directionDeg)).padStart(3, '0')}°`;
  return `${dir} ${w.speedKt}${w.gustKt != null ? `G${w.gustKt}` : ''}`;
}

/** "BKN 3,500", "CLR", or a dash when the report had no sky group. */
function skyText(r: NearbyRow): string {
  const layers = r.current?.skyLayers ?? [];
  if (layers.length === 0) return '—';
  return layers
    .map((l) => (l.baseFtAgl == null ? l.cover : `${l.cover} ${l.baseFtAgl.toLocaleString()}`))
    .join(', ');
}

/**
 * The latest METAR at the airports around the drop zone, nearest first: what
 * a jump pilot reads beside KPMV's before a load. Each row is the station's
 * own report, decoded as KPMV's is, with how old it is; the raw text of all
 * of them is one tap away.
 */
export function NearbyMetarsPanel(): JSX.Element {
  const [rows, setRows] = useState<NearbyRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Re-render each minute so a report's age ("12 min ago") keeps counting
  // between the five-minute checks rather than standing still.
  useNow(60_000);

  usePolling(() => {
    fetchIemNetwork(NEARBY_METAR_NETWORK)
      .then((recs) => {
        setRows(nearbyRows(recs, NEARBY_METAR_STATIONS, SITE.dz));
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, REFRESH_MS);

  return (
    <Panel title="Nearby METARs" subtitle="nearest first" sources={[DATA_SOURCES.iemNebraska]}>
      <NearbyMetarsBody rows={rows} error={error} />
    </Panel>
  );
}

/** The card's body, apart from its fetching, so it renders in tests. */
export function NearbyMetarsBody({ rows, error }: { rows: NearbyRow[] | null; error: string | null }): JSX.Element {
  if (!rows) {
    return <p className="muted">{error ? `Could not load the reports (${shortError(error)}).` : 'Loading…'}</p>;
  }
  return (
    <>
      <div className="sky-scroll">
        <table className="aloft-table nearby-table">
          <thead>
            <tr>
              <th>station</th>
              <th>from DZ</th>
              <th>wind kt</th>
              <th>vis SM</th>
              <th>sky</th>
              <th>cat.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.id}</strong>
                  <br />
                  <span className="muted small">{r.name}</span>
                  <br />
                  {/* The report's age under the name, not in a column of its
                      own: at phone width a seventh column scrolled out of
                      view, and how old a report is matters as much as what
                      it says. */}
                  <span className="muted small">{r.current ? fmtAgo(r.current.observedAt) : 'no report'}</span>
                </td>
                <td>
                  {r.distanceMi == null || r.bearingDeg == null
                    ? '—'
                    : `${Math.round(r.distanceMi)} mi ${compass(r.bearingDeg)}`}
                </td>
                <td>{windText(r)}</td>
                <td>{r.current?.visibilitySm == null ? '—' : r.current.visibilitySm}</td>
                <td>{skyText(r)}</td>
                <td>{r.category ? <FlightCategoryPill category={r.category} /> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="nearby-raw">
        <summary className="small">Raw METARs</summary>
        <pre className="metar-raw">
          {rows.map((r) => r.current?.raw || `${r.id} no report`).join('\n')}
        </pre>
      </details>
      <p className="muted small">
        Distances from the drop zone. Category is the FAA&rsquo;s classification of each
        report&rsquo;s ceiling and visibility (AIM 7-1-7), withheld where a report has no sky
        group. Reports come in every 20 to 60 minutes; this card checks every five.
        {error && ` The last check failed (${shortError(error)}); these are the reports before it.`}
      </p>
    </>
  );
}
