import type { ErrorClass, ErrorPageState, ErrorView } from '../model/view-types';

/* ── Errors (SPEC §4.14) ──────────────────────────────────────────────────── */

/** Every failure class, in SPEC §4.14's order. */
export const ERROR_CLASSES = [
  'unreachable',
  'timeout',
  'busy',
  'declined',
  'invalid',
  'tooLarge',
  'offline',
  'sourceChanged',
  'unknown',
] as const satisfies readonly ErrorClass[];

const RETRYABLE: Readonly<Record<ErrorClass, boolean>> = {
  unreachable: true,
  timeout: true,
  busy: true,
  declined: false,
  invalid: true,
  tooLarge: true,
  offline: true,
  sourceChanged: true,
  unknown: true,
};

/** An error record of `failure`, leaving the page as `pageState` says. */
export function errorView(
  failure: ErrorClass,
  pageState: ErrorPageState = { kind: 'unchanged' },
): ErrorView {
  return {
    turnId: `error-${failure}-${pageState.kind}`,
    failure,
    pageState,
    retryable: RETRYABLE[failure],
    // Technical text: the clipboard's, never the screen's (SPEC §4.14).
    details: `remote/${failure}: fill-3 exceeded 45000ms; setProp craftkit.hero ~11.2k tokens`,
    menu: ['reuse', 'copyError'],
  };
}

/**
 * §3.11 as drawn: the error with its run's final time (`0:31`) at the head's end. `ErrorView`
 * has no field for the time yet; ErrorRecord reads `elapsedMs` structurally, so this fixture
 * shows the frame the producer will reach once it sends one.
 */
export function errorViewTimed(
  failure: ErrorClass,
  elapsedMs: number,
  pageState: ErrorPageState = { kind: 'unchanged' },
): ErrorView & { readonly elapsedMs: number } {
  return { ...errorView(failure, pageState), elapsedMs };
}
