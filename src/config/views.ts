/**
 * Which cards each tab of the dashboard shows, in order.
 *
 * Jumpers opens on the two wind cards, then drift, conditions now and the
 * day's planning. Pilots gathers what the jump pilot plans the load on: the
 * sectional, the terminal forecast, density altitude for the climb, winds
 * aloft for the jump run, and links to the services a pilot briefs from.
 * Cards both read from (conditions now, sky, winds aloft, daylight, radar)
 * appear on both. The advisories, Data health and the settings sit outside
 * the grid and show on both.
 *
 * Order is the reading order on a phone, where the grid is one column; at
 * wider widths MasonryGrid packs cards into the shortest column.
 */
export type View = 'jumpers' | 'pilots';

export type CardId =
  | 'metar'
  | 'surfaceWind'
  | 'ceilingSky'
  | 'windsAloft'
  | 'drift'
  | 'hourly'
  | 'daily'
  | 'precip'
  | 'densityAltitude'
  | 'sun'
  | 'radar'
  | 'sectional'
  | 'taf'
  | 'pilotLinks'
  | 'nearbyMetars';

export const VIEW_CARDS: Readonly<Record<View, readonly CardId[]>> = {
  // The two wind cards first, the ones a jumper reads before anything else
  // (ground wind against the limit, then the winds through the climb and
  // freefall). Drift directly after Winds aloft: it works from the hour that
  // card's buttons step to, and on a phone a card further down would change
  // off screen. Then the rest of now (conditions, sky), planning (hourly,
  // outlook, precip), daylight and radar.
  jumpers: ['surfaceWind', 'windsAloft', 'drift', 'metar', 'ceilingSky', 'hourly', 'daily', 'precip', 'sun', 'radar'],
  // Now (conditions, sky, the airports around), then the chart and the
  // forecast for the flight (sectional, TAF), the climb and the jump run
  // (density altitude, winds aloft), then daylight, radar and the briefing
  // links.
  pilots: [
    'metar',
    'ceilingSky',
    'nearbyMetars',
    'sectional',
    'taf',
    'densityAltitude',
    'windsAloft',
    'sun',
    'radar',
    'pilotLinks',
  ],
};

export const VIEW_LABEL: Readonly<Record<View, string>> = {
  jumpers: 'Jumpers',
  pilots: 'Pilots',
};

/** The hash that selects each view: none for Jumpers, so the page's plain
 *  address keeps opening the dashboard it always has. */
export const VIEW_HASH: Readonly<Record<View, string>> = {
  jumpers: '',
  pilots: '#pilots',
};
