import type { ObservationSource, SkyDecodeCheck, SourceKey, TafForecast, WeatherSnapshot } from './types';
import { SITE } from '../config/site';
import { TAF_RELAY_URL } from '../config/tafRelay';

/** Which provider a source is currently served from, and whether that is the
 *  primary source or a fallback (e.g. Open-Meteo unreachable → NOAA FD). */
export interface SourceProvenance {
  detail: string;
  fallback: boolean;
}

/** Amber ("fallback") when the feed's decode was missing or disagreed: the
 *  state a reader should glance at the raw METAR for. Both feeds serve a
 *  decode beside the text (IEM's skyc/skyl, NWS's cloudLayers), and the chip
 *  names the feed, so the wording here does not. Text with no sky group — most
 *  often no METAR text at all, which api.weather.gov serves in quantity (37 of
 *  the last 40 at KLNK and KAUS on 2026-09-23, 4 of 40 at KPMV), but also a
 *  report whose text simply lacks the group — is not amber when the decode
 *  supplies the sky: it is the only sky there is, and the chip says so.
 *  Exported for the fetch hook, which logs exactly the amber states. */
export const METAR_SKY_PROVENANCE: Record<SkyDecodeCheck, SourceProvenance> = {
  agrees: { detail: 'sky from METAR text · decode agrees', fallback: false },
  'decode-empty': { detail: 'sky from METAR text · decode had none', fallback: true },
  'decode-differs': { detail: 'sky from METAR text · decode differs', fallback: true },
  'text-empty': { detail: 'sky from decode · no sky group in the METAR text', fallback: false },
  'not-reported': { detail: 'sky not reported', fallback: true },
};

const FEED_LABEL: Record<ObservationSource, string> = { iem: 'IEM', nws: 'NWS' };

/**
 * The observation's feed and how the other feed's latest report compared:
 * "IEM · NWS 20 min older". NWS serving is amber, because it means IEM
 * missed the newest report or failed, and IEM is what keeps the card minutes
 * rather than half an hour behind the station. The comparison is there so a
 * reader can see that for themselves rather than take the chip's word.
 */
export function describeObservationFeed(
  source: ObservationSource,
  observedAt: number,
  otherObservedAt: number | null | undefined,
): SourceProvenance {
  const other = FEED_LABEL[source === 'iem' ? 'nws' : 'iem'];
  let vs: string;
  if (otherObservedAt == null) vs = `${other} had no report`;
  else if (otherObservedAt === observedAt) vs = `${other} same report`;
  else vs = `${other} ${Math.round((observedAt - otherObservedAt) / 60_000)} min older`;
  return { detail: `${FEED_LABEL[source]} · ${vs}`, fallback: source === 'nws' };
}

/**
 * The TAF chip: the station shown and, when it is not the nearest, why the
 * nearer ones were passed over. Amber whenever it is not the nearest, as
 * before; what the reasons add is that a fault reads differently from the
 * ordinary cases. Without the relay Offutt's TAF is never in the NWS feed,
 * so "KOMA · KOFF not in the NWS feed" is the everyday chip. With it,
 * "KOFF fetch failed" is the relay down and "KOFF TAF ended" or "no KOFF
 * TAF on aviationweather.gov" is Offutt's weekend gap. Until 2026-10-21 the
 * chip said only "KOMA" in every one of these.
 */
export function describeTafSource(taf: TafForecast, relay: boolean = TAF_RELAY_URL != null): SourceProvenance {
  const primary = SITE.tafStations[0].id;
  if (taf.station === primary) {
    return { detail: taf.via === 'aviationweather' ? `${primary} · aviationweather.gov via the relay` : primary, fallback: false };
  }
  const passed = taf.passedOver ?? [];
  const reasons = passed.map((p) =>
    'failed' in p ? `${p.station} fetch failed` : 'endedMs' in p ? `${p.station} TAF ended` : `${p.station} TAF ${p.noForecast}`,
  );
  // A station that answered with nothing is not in passedOver: for the
  // nearest, say which feed had nothing.
  if (!passed.some((p) => p.station === primary)) {
    reasons.unshift(relay ? `no ${primary} TAF on aviationweather.gov` : `${primary} not in the NWS feed`);
  }
  return { detail: [taf.station, ...reasons].join(' · '), fallback: true };
}

/** Describe which provider each fallback-capable source is currently served
 *  from, so Data health can show primary vs fallback. The NWS forecast has a
 *  single provider and no chip. The METAR comes from one of two feeds (IEM,
 *  then NWS; see describeObservationFeed), each carrying two decodes of the
 *  report: the text, which the app parses, and the feed's own sky decode. Its
 *  chip says which feed served it and whether the decodes agreed, because on
 *  2026-09-23 the NWS decode was empty through a two-hour overcast and the
 *  card read "Clear" with nothing on screen to say why. Pure so it can be
 *  unit-tested without rendering. */
export function deriveProvenance(
  snapshot: WeatherSnapshot,
): Partial<Record<SourceKey, SourceProvenance>> {
  const prov: Partial<Record<SourceKey, SourceProvenance>> = {};

  if (snapshot.windsAloftSource === 'open-meteo') {
    prov.windsAloft = { detail: 'Open-Meteo 10–180 m and pressure levels', fallback: false };
  } else if (snapshot.windsAloftSource === 'nws-fd') {
    prov.windsAloft = { detail: `NOAA FD winds · ${SITE.fdWindsStation}`, fallback: true };
  }

  if (snapshot.dailySource === 'open-meteo') {
    prov.daily = { detail: 'Open-Meteo (10-day)', fallback: false };
  } else if (snapshot.dailySource === 'nws-gridpoint') {
    prov.daily = { detail: 'NWS gridpoint (~7-day)', fallback: true };
  }

  const cur = snapshot.current;
  const sky = cur?.skyDecode !== undefined ? METAR_SKY_PROVENANCE[cur.skyDecode] : undefined;
  const feed = cur?.source
    ? describeObservationFeed(cur.source, cur.observedAt, snapshot.currentOtherObservedAt)
    : undefined;
  if (feed && sky) {
    prov.metar = { detail: `${feed.detail} · ${sky.detail}`, fallback: feed.fallback || sky.fallback };
  } else if (feed ?? sky) {
    prov.metar = feed ?? sky;
  }

  if (snapshot.taf) prov.taf = describeTafSource(snapshot.taf);

  return prov;
}
