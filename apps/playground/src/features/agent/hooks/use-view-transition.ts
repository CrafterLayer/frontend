/**
 * `document.startViewTransition` with its two fallbacks (SPEC §7.4
 * `hooks/use-view-transition.ts`, §5 moment 4 "Plan becomes build").
 *
 * The plan card inks into its build record in place: the rows hold still, the box fades.
 * That is one state change (the page-plan turn becomes a build turn under the same id),
 * wrapped in a view transition so the browser can morph the named rows
 * (`view-transition-name: ck-plan-row-{key}`). The update itself is always applied, and
 * applied exactly once:
 * - under `prefers-reduced-motion: reduce` it is applied directly (SPEC §5: "instant swap;
 *   no view transition");
 * - where the browser has no `startViewTransition` (Firefox before 144, jsdom) likewise;
 * - otherwise inside the transition's callback, flushed synchronously so the "after"
 *   snapshot is the new DOM. A transition the browser skips (another one started, the tab
 *   hid) still ran the update; its rejected promises are observed so they never surface
 *   as unhandled.
 */
import { useCallback } from 'react';
import { flushSync } from 'react-dom';

interface ViewTransitionLike {
  readonly ready?: Promise<unknown>;
  readonly finished?: Promise<unknown>;
  readonly updateCallbackDone?: Promise<unknown>;
}

type StartViewTransition = (update: () => void) => ViewTransitionLike | undefined;

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function reducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(REDUCED_MOTION).matches;
}

function starter(): StartViewTransition | null {
  if (typeof document === 'undefined') return null;
  const start: unknown = (document as unknown as { startViewTransition?: unknown })
    .startViewTransition;
  if (typeof start !== 'function') return null;
  return (update) =>
    (start as (this: Document, update: () => void) => ViewTransitionLike | undefined).call(
      document,
      update,
    );
}

const ignore = (): void => undefined;

/** Runs `update` inside a view transition when motion is welcome and the browser can. */
export function runViewTransition(update: () => void): void {
  const start = starter();
  if (start === null || reducedMotion()) {
    update();
    return;
  }
  // A box, not a `let`: the browser flips it from a callback the compiler cannot follow.
  const once = { ran: false };
  const apply = (): void => {
    if (once.ran) return;
    once.ran = true;
    flushSync(update);
  };
  try {
    /*
      The browser calls `apply` itself, after it has captured the old snapshot: later than
      this call returns, and even when it skips the animation (the spec still runs the
      update callback of a skipped transition).
    */
    const transition = start(apply);
    void transition?.ready?.catch(ignore);
    void transition?.finished?.catch(ignore);
    void transition?.updateCallbackDone?.catch(ignore);
  } catch {
    // The browser refused to start one at all: the state still has to change, now.
    if (!once.ran) {
      once.ran = true;
      update();
    }
  }
}

/** The hook form: a stable function components and the controller can call. */
export function useViewTransition(): (update: () => void) => void {
  return useCallback((update: () => void) => {
    runViewTransition(update);
  }, []);
}
