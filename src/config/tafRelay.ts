/**
 * Where the dashboard reads Offutt's TAF and KPMV's NBM bulletin block:
 * the maintainer's relay (relay/, docs/taf-relay.md), deployed
 * 2026-10-27. Null would turn both off: the TAF card would read every TAF
 * from api.weather.gov, which has no Offutt TAF, and show Omaha's, and
 * the Ceiling & sky card's base row would go.
 *
 * The Worker's address, with a trailing slash dropped. The build's
 * Content-Security-Policy takes its origin from here (`connectSources`),
 * so this is the one line to change.
 *
 * vite.config.ts reads this file to build the policy, so it imports only
 * the relay's station file, which carries no Worker types.
 */
import { NBM_PATH, PATH, STATION } from '../../relay/src/station';

export const TAF_RELAY_URL: string | null = 'https://lspc-taf-relay.amelia-m.workers.dev';

/** Whether the relay is set: what the card, Data health, the source log
 *  and the checks ask of the setting. */
export const TAF_RELAY_SET = TAF_RELAY_URL != null;

/** The relay's URL for a station, or null when there is no relay or it does
 *  not serve that station (relay/src/station.ts). */
export function tafRelayUrlFor(station: string, base: string | null = TAF_RELAY_URL): string | null {
  return base != null && station === STATION ? `${base.replace(/\/+$/, '')}${PATH}` : null;
}

/** The relay's NBM path (relay/src/nbm.ts), or null without the relay. */
export function nbmRelayUrl(base: string | null = TAF_RELAY_URL): string | null {
  return base != null ? `${base.replace(/\/+$/, '')}${NBM_PATH}` : null;
}

/** The connect-src origins the app's policy allows: the live APIs, plus the
 *  relay's origin when there is one. */
export function connectSources(relay: string | null = TAF_RELAY_URL): string[] {
  const apis = ['https://api.weather.gov', 'https://api.open-meteo.com', 'https://mesonet.agron.iastate.edu'];
  return relay != null ? [...apis, new URL(relay).origin] : apis;
}
