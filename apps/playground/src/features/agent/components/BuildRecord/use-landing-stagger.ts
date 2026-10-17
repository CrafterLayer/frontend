import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

import type { RowState, SpineRowView } from '../../model/view-types';

/** The least time between two sections' landing strokes (SPEC §3.4, §5 moment 1). */
export const LAND_STAGGER_MS = 80;

/** Every element a landing inks carries its section's key (SpineRow, SpineSegment). */
const LAND_KEY = 'data-land-key';

/**
 * Staggers landings so they read as a sequence (SPEC §3.4: "each lands with its own 360ms
 * stroke, staggered by at least 80ms"). The engine lands in page order, and a drafted section
 * below one that just landed may land within milliseconds of it: without a stagger, two or
 * three strokes would fill as one.
 *
 * After each commit it finds the rows that turned `landed` since the last one and gives each
 * a start at least 80ms after the previous landing's, as `--ck-agent-land-delay` on every
 * element carrying that section's key: its row (node and title) and the stretch of spine
 * above its node. It writes a CSS variable before paint and holds no state, so nothing
 * re-renders; a record that is not live (read back from history) is left alone.
 */
export function useLandingStagger(
  root: RefObject<HTMLElement | null>,
  rows: readonly SpineRowView[],
  live: boolean,
): void {
  const seen = useRef<ReadonlyMap<string, RowState> | null>(null);
  /** When the next landing may start, by `performance.now()`. */
  const nextStart = useRef(0);

  useLayoutEffect(() => {
    const before = seen.current;
    seen.current = new Map(rows.map((row) => [row.key, row.state]));
    const element = root.current;
    if (!live || before === null || element === null) return;
    const landing = rows.filter((row) => {
      const was = before.get(row.key);
      return row.state === 'landed' && was !== undefined && was !== 'landed';
    });
    if (landing.length === 0) return;
    const now = performance.now();
    let start = Math.max(now, nextStart.current);
    const marked = [...element.querySelectorAll<HTMLElement>(`[${LAND_KEY}]`)];
    for (const row of landing) {
      const delay = `${String(Math.round(start - now))}ms`;
      for (const target of marked) {
        if (target.getAttribute(LAND_KEY) === row.key) {
          target.style.setProperty('--ck-agent-land-delay', delay);
        }
      }
      start += LAND_STAGGER_MS;
    }
    nextStart.current = start;
  }, [root, rows, live]);
}

/**
 * Whether `target` is on screen, watched only while `enabled` (a live build with writers):
 * the light on a writing stretch pauses off screen (SPEC §5 moment 2). Without an
 * IntersectionObserver (a test, an old engine) it reports on screen.
 */
export function useOnScreen(target: RefObject<Element | null>, enabled: boolean): boolean {
  const [onScreen, setOnScreen] = useState(true);
  useEffect(() => {
    const element = target.current;
    if (!enabled || element === null || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) setOnScreen(entry.isIntersecting);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [target, enabled]);
  return !enabled || onScreen;
}
