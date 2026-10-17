/**
 * A minimal external store: synchronous reads and writes, one listener set.
 *
 * The controller's runs are long async flows (a build is minutes of engine events), and
 * every step of them reads state that other steps, or the person, may have changed a
 * moment ago: is the lease still ours, is the queue paused, did the plan card become a
 * build. React state is read at the next render, which is too late for those questions;
 * this store is read NOW, and React subscribes to it through `useSyncExternalStore`, so
 * the screen and the flows agree on one value. No React here.
 */
export interface Store<T> {
  readonly getState: () => T;
  readonly setState: (next: T | ((previous: T) => T)) => void;
  readonly subscribe: (listener: () => void) => () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    setState: (next) => {
      const value = typeof next === 'function' ? (next as (previous: T) => T)(state) : next;
      if (Object.is(value, state)) return;
      state = value;
      for (const listener of [...listeners]) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
