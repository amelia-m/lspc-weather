/**
 * Where the dashboard reads Offutt's TAF, once the relay is deployed
 * (relay/, docs/taf-relay.md). Null until then: the card reads every TAF
 * from api.weather.gov, which has no Offutt TAF, and shows Omaha's.
 *
 * Set it to the Worker's address with no trailing slash, for example
 * 'https://lspc-taf-relay.example.workers.dev'. The build's
 * Content-Security-Policy takes its origin from here (`connectSources`), so
 * this is the one line to change.
 *
 * No imports: vite.config.ts reads this file to build the policy.
 */
export const TAF_RELAY_URL: string | null = null;

/** The stations the relay serves (relay/src/index.ts, `PATH`). */
export const TAF_RELAY_STATIONS: readonly string[] = ['KOFF'];

/** The relay's URL for a station, or null when there is no relay or it does
 *  not serve that station. */
export function tafRelayUrlFor(station: string, base: string | null = TAF_RELAY_URL): string | null {
  return base != null && TAF_RELAY_STATIONS.includes(station) ? `${base}/taf/${station}` : null;
}

/** The connect-src origins the app's policy allows: the live APIs, plus the
 *  relay's origin when there is one. */
export function connectSources(relay: string | null = TAF_RELAY_URL): string[] {
  const apis = ['https://api.weather.gov', 'https://api.open-meteo.com', 'https://mesonet.agron.iastate.edu'];
  return relay != null ? [...apis, new URL(relay).origin] : apis;
}
