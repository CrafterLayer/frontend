import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * One identity for a callback whose implementation the host may re-create on
 * every render. The latest function is written in a layout effect, so a call
 * during the commit phase already reaches it.
 *
 * `undefined` stays `undefined`: the colour control hides its picker when no
 * `onRetheme` exists, and a stable wrapper around nothing would show a control
 * that appears to accept a colour it has nowhere to put.
 */
export function useStableCallback<A extends unknown[]>(
  fn: ((...args: A) => void) | undefined,
): ((...args: A) => void) | undefined {
  const ref = useRef(fn);
  useLayoutEffect(() => {
    ref.current = fn;
  });
  const stable = useCallback((...args: A) => {
    ref.current?.(...args);
  }, []);
  return fn === undefined ? undefined : stable;
}
