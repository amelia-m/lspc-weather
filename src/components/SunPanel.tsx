import type { SunTimes } from '../domain/types';
import { Panel } from './common/Panel';
import { fmtTime } from './format';

export function SunPanel({ sun }: { sun: SunTimes | null }): JSX.Element {
  const minsToSunset = sun ? Math.round((sun.sunset - Date.now()) / 60000) : null;
  return (
    <Panel title="Daylight" subtitle="last load planning">
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
