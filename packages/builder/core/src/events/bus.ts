import type { EventBus, KernelEvents } from '@craftkit/builder-schema';

type AnyListener = (payload: KernelEvents[keyof KernelEvents]) => void;

/** Typed synchronous event bus; unsubscribe is the returned function. */
export function createEventBus(): EventBus {
  const listeners = new Map<keyof KernelEvents, Set<AnyListener>>();

  return {
    emit(event, payload) {
      const set = listeners.get(event);
      if (set === undefined) {
        return;
      }
      for (const listener of [...set]) {
        listener(payload);
      }
    },
    on(event, cb) {
      let set = listeners.get(event);
      if (set === undefined) {
        set = new Set();
        listeners.set(event, set);
      }
      // Safe narrowing: a listener registered for K is only ever invoked with
      // KernelEvents[K] — emit() looks up the same key it publishes under.
      const listener = cb as AnyListener;
      set.add(listener);
      return () => {
        set.delete(listener);
      };
    },
  };
}
