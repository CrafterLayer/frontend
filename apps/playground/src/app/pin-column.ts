import { useLayoutEffect, type RefObject } from 'react';

/**
 * The Assistant never scrolls the shared panel column (2026-10-12).
 *
 * Every rail destination draws into one column (`.bldr-shell__panel`, `overflow: auto`), and
 * Layers, Assets, Design and Code are taller than it, so the column scrolls for them. The agent
 * panel is exactly as tall as the column and scrolls inside its own thread. A column left
 * scrolled by another destination (Safari keeps the offset while the content swaps; a focus or
 * a wheel can move it too) showed the composer at the top with an empty column under it — the
 * person's report. While the Assistant is shown the column is held at its top: set on entry,
 * and put back whenever anything scrolls it.
 */
export function usePinnedColumn(anchor: RefObject<HTMLElement | null>, active: boolean): void {
  useLayoutEffect(() => {
    if (!active) return undefined;
    const column = anchor.current?.closest<HTMLElement>('.bldr-shell__panel');
    if (column === null || column === undefined) return undefined;
    const pin = (): void => {
      if (column.scrollTop !== 0) column.scrollTop = 0;
    };
    pin();
    column.addEventListener('scroll', pin, { passive: true });
    return () => {
      column.removeEventListener('scroll', pin);
    };
  }, [anchor, active]);
}
