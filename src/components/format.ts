import { SITE } from '../config/site';

export const fmtTime = (ms: number): string =>
  new Date(ms).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: SITE.timeZone,
  });

export const fmtClock = (ms: number): string =>
  new Date(ms).toLocaleString('en-US', {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: SITE.timeZone,
  });

export const fmtAgo = (ms: number | null): string => {
  if (ms == null) return '—';
  const mins = Math.round((Date.now() - ms) / 60000);
  if (mins < 1) return 'just now';
  if (mins === 1) return '1 min ago';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  return h === 1 ? '1 hr ago' : `${h} hr ago`;
};
