/*
  The browser autoplay policy (pixi-studio DESIGN D12): an AudioContext may
  start only inside a user gesture. These are the gestures every browser
  (iOS Safari included) accepts for `resume()`: pointerdown, keydown, touchend.
  Listeners are passive and capture-phase, so a page that stops propagation
  still unlocks, and none of them ever prevents a default.
*/

export const UNLOCK_EVENTS = ['pointerdown', 'keydown', 'touchend'] as const;

/** Call `onGesture` on every unlocking gesture until the returned function is called. */
export function listenForGestures(target: EventTarget, onGesture: () => void): () => void {
  const options: AddEventListenerOptions = { capture: true, passive: true };
  const handler = (): void => {
    onGesture();
  };
  for (const type of UNLOCK_EVENTS) target.addEventListener(type, handler, options);
  return () => {
    for (const type of UNLOCK_EVENTS) target.removeEventListener(type, handler, options);
  };
}
