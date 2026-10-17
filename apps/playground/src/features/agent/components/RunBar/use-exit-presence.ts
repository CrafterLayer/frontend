/**
 * Keep a piece of chrome on screen for its exit, then let it go (SPEC §4.17: the RunBar
 * "enters with `grid-template-rows` 0fr→1fr over `enter`, leaves over `exit`").
 *
 * A view that turns `null` would unmount its component at once, and a component that is
 * gone cannot fold away. This keeps the last value for `exitMs`, flagged `leaving`, so the
 * owner draws it inert while its exit plays and then drops it. Under reduced motion, and
 * where there is no `matchMedia` at all (jsdom), there is no exit to play: the value goes
 * in the same render, so tests and people who asked for stillness see it leave at once.
 */
import { useEffect, useState } from 'react';

/** `--bldr-duration-exit`: the CSS exit plays over the token, this only ends the stay. */
export const EXIT_MS = 140;

export interface Presence<T> {
  /** What to draw: the live value, or the last one while its exit plays. */
  readonly value: T | null;
  /** The value is gone and its exit is playing: draw it `inert`. */
  readonly leaving: boolean;
}

function motionAllowed(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function useExitPresence<T>(value: T | null, exitMs: number = EXIT_MS): Presence<T> {
  const [last, setLast] = useState<T | null>(value);
  const [leaving, setLeaving] = useState(false);
  const [seen, setSeen] = useState<T | null>(value);

  // React's "adjusting state when a prop changes": decided while rendering, so the frame
  // that loses the value already draws it leaving, with no flash of nothing in between.
  if (seen !== value) {
    setSeen(value);
    if (value !== null) {
      setLast(value);
      setLeaving(false);
    } else if (last !== null && motionAllowed()) {
      setLeaving(true);
    } else {
      setLast(null);
    }
  }

  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => {
      setLeaving(false);
      setLast(null);
    }, exitMs);
    return () => {
      clearTimeout(timer);
    };
  }, [leaving, exitMs]);

  if (value !== null) return { value, leaving: false };
  return leaving ? { value: last, leaving: true } : { value: null, leaving: false };
}
