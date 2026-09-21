import type { SunTimes } from '../domain/types';
import { useNow } from '../hooks/useNow';
import { Panel } from './common/Panel';
import { fmtTime } from './format';
import { DATA_SOURCES } from '../config/sources';

/**
 * Sunrise, sunset, and how long is left before it.
 *
 * Sunset is the only instant on this card that a rule turns on: 14 CFR 105.19
 * makes parachute ops after it night ops, and that is where the daylight flag
 * fires. The card used to be framed around "last load" instead, which promised
 * something it no longer does — the minutes-before-sunset watch (45 min for
 * students, 30 for licensed) was a figure this dashboard picked, and no
 * published source sets one. The time remaining is printed for the reader to
 * plan against; how many loads fit in it is manifest's call, not the app's.
 */
export function SunPanel({ sun }: { sun: SunTimes | null }): JSX.Element {
  const now = useNow(30_000);
  const minsToSunset = sun ? Math.round((sun.sunset - now) / 60000) : null;
  return (
    <Panel
      title="Daylight"
      subtitle="sunrise, sunset, time remaining"
      sources={[DATA_SOURCES.computed]}
    >
      {!sun ? (
        <p className="muted">—</p>
      ) : (
        <dl className="kv">
          <dt>Sunrise</dt>
          <dd>{fmtTime(sun.sunrise)}</dd>
          <dt>Sunset</dt>
          <dd>{fmtTime(sun.sunset)}</dd>
          <dt>To sunset</dt>
          <dd>
            {minsToSunset != null && minsToSunset > 0
              ? `${Math.floor(minsToSunset / 60)}h ${minsToSunset % 60}m`
              : 'after sunset'}
          </dd>
        </dl>
      )}
    </Panel>
  );
}
