import { useEffect, useRef, useState } from 'react';
import type { SectionIcon, ViewSection } from '../config/sections';
import { activeSection } from '../domain/sectionNav';

/** One line-drawn glyph per section, 24 px square; the word under it is the
 *  label, so these are decoration and hidden from a screen reader. */
const ICON: Record<SectionIcon, string> = {
  wind: 'M3 8h10a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7',
  aloft: 'M12 3v18M6 9l6-6 6 6M5 15h4M15 15h4M5 20h4M15 20h4',
  sky: 'M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18z',
  outlook: 'M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM4 10h16M9 3v4M15 3v4',
  radar: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 12l6-6',
  now: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 7v5l3 2',
  chart: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14',
  taf: 'M5 4h14v16H5zM8 9h8M8 13h8M8 17h5',
};

/** How far down the viewport a card's top has to come before its section is
 *  the current one. */
const LINE_PX = 120;

const cardEl = (card: string): HTMLElement | null => document.querySelector<HTMLElement>(`[data-card="${card}"]`);

/**
 * The section bar (option B of docs/mockups/layout-options-2026-11-25.html;
 * the maintainer, 2026-11-25): five labelled icons that jump to a section
 * of the page and mark the one in view. At the bottom of a phone's screen,
 * in reach of a thumb, and a rail down the left side on a wide one
 * (app.css `.section-bar`). The page itself is unchanged: the flags and the
 * surface wind are still first, and the bar only shortens the trip.
 *
 * Buttons, not links: the address's `#` is the tab (`#pilots`), so a
 * section cannot be one too. A section whose card is not on the page (a
 * card with nothing to show renders nothing) is disabled, not hidden, so
 * the bar's places do not move under the thumb.
 */
export function SectionBar({ sections }: { sections: readonly ViewSection[] }): JSX.Element | null {
  const [active, setActive] = useState<string | null>(sections[0]?.id ?? null);
  const [missing, setMissing] = useState<readonly string[]>([]);
  // The section last chosen from the bar: it settles which of two cards
  // standing level is current (activeSection).
  const chosen = useRef<string | null>(null);

  useEffect(() => {
    let frame = 0;
    const read = (): void => {
      frame = 0;
      const found = sections.flatMap((s) => {
        const el = cardEl(s.card);
        return el ? [{ id: s.id, top: el.getBoundingClientRect().top }] : [];
      });
      const doc = document.documentElement;
      const atEnd = window.innerHeight + window.scrollY >= doc.scrollHeight - 2;
      setActive(activeSection(found, LINE_PX, { atEnd, chosen: chosen.current }));
      const gone = sections.filter((s) => !found.some((f) => f.id === s.id)).map((s) => s.id);
      setMissing((prev) => (prev.join() === gone.join() ? prev : gone));
    };
    const onScroll = (): void => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    // Cards arrive with the data and change height as it loads, which moves
    // every card below them: read again on a slow tick as well as on scroll.
    const tick = window.setInterval(read, 1500);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.clearInterval(tick);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [sections]);

  if (sections.length === 0) return null;
  const go = (id: string, card: string): void => {
    chosen.current = id;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    cardEl(card)?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
  };
  return (
    <nav className="section-bar" aria-label="Jump to a section">
      {sections.map((s) => (
        <button
          key={s.id}
          type="button"
          aria-current={s.id === active ? 'true' : undefined}
          disabled={missing.includes(s.id)}
          onClick={() => go(s.id, s.card)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={ICON[s.icon]} />
          </svg>
          {s.label}
        </button>
      ))}
    </nav>
  );
}
