import { useCallback, useEffect, useRef, useState } from 'react';

import type { BuilderKernel } from '@craftkit/builder-core';

/** A polite message and its nonce: a repeat must still change the live region's text. */
export interface CanvasMessage {
  text: string;
  nonce: number;
}

/**
 * Gesture outcomes reach their own polite channel (setState happens only at
 * session ENDS — commit/cancel — never per pointer move, so the zero-render
 * law is untouched mid-drag). {text, nonce}: a REPEATED outcome ("Already
 * last" twice) must still mutate the live region's text node or AT hears
 * nothing the second time — a zero-width space toggles on odd nonces.
 *
 * The announcer is a stable ref so plain-TS machinery can call it without
 * ever re-subscribing.
 */
export function useGestureAnnouncer() {
  const [gestureMessage, setGestureMessage] = useState<CanvasMessage>({ text: '', nonce: 0 });
  const announceGestureRef = useRef((message: string) => {
    setGestureMessage((current) => ({ text: message, nonce: current.nonce + 1 }));
  });
  // The same announcer as a plain stable function, for render-time wiring.
  const announceGesture = useCallback((message: string) => {
    setGestureMessage((current) => ({ text: message, nonce: current.nonce + 1 }));
  }, []);
  return { gestureMessage, announceGesture, announceGestureRef };
}

/**
 * A live region announces DOM mutations, not semantic equality. Selection
 * itself is the signal: moving from one "Text" block to another must still
 * toggle the region even though its spoken message is unchanged.
 */
export function useSelectionNonce(kernel: BuilderKernel): number {
  const [selectionNonce, setSelectionNonce] = useState(0);
  useEffect(
    () =>
      kernel.context.store.select(
        (state) => state.selection,
        () => {
          setSelectionNonce((current) => current + 1);
        },
      ),
    [kernel],
  );
  return selectionNonce;
}
