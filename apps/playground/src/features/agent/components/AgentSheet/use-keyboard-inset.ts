/**
 * How much of the layout viewport the on-screen keyboard covers, in CSS px (SPEC §4.19:
 * "the composer rides `visualViewport`").
 *
 * iOS Safari does not resize the layout viewport when the keyboard opens: a sheet fixed
 * to the bottom stays under the keyboard, composer and all. The visual viewport does
 * shrink, so the covered part is what lies below it: the layout viewport's height, less
 * the visual viewport's height and its offset from the top. The sheet lifts its bottom
 * edge by that much, so the composer sits on the keyboard and the thread above shrinks.
 *
 * Chrome on Android with `interactive-widget=resizes-content` resizes the layout viewport
 * itself, and this reads 0 there: the two never add up.
 *
 * A pinch zoom also shrinks the visual viewport; while zoomed (scale above 1) this reads
 * 0, so zooming in to read never throws the sheet upward.
 */
import { useSyncExternalStore } from 'react';

const ZOOMED = 1.01;

function subscribe(onChange: () => void): () => void {
  const viewport = typeof window === 'undefined' ? undefined : window.visualViewport;
  if (viewport === undefined || viewport === null) return () => undefined;
  viewport.addEventListener('resize', onChange);
  viewport.addEventListener('scroll', onChange);
  window.addEventListener('resize', onChange);
  return () => {
    viewport.removeEventListener('resize', onChange);
    viewport.removeEventListener('scroll', onChange);
    window.removeEventListener('resize', onChange);
  };
}

function unsubscribed(): () => void {
  return () => undefined;
}

function covered(): number {
  const viewport = typeof window === 'undefined' ? undefined : window.visualViewport;
  if (viewport === undefined || viewport === null || viewport.scale > ZOOMED) return 0;
  return Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
}

const none = (): number => 0;

/** The keyboard's height over the layout viewport while `active`; 0 otherwise. */
export function useKeyboardInset(active: boolean): number {
  return useSyncExternalStore(active ? subscribe : unsubscribed, active ? covered : none, none);
}
