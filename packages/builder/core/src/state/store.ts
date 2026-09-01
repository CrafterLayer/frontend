import { createStore } from 'zustand/vanilla';

import type { KernelState, Node, NodeId, StateFacade } from '@craftkit/builder-schema';

/**
 * INTERNAL handle around the module-private zustand store (Law S). `write` is the
 * only mutation path and is never exported from the package's public entrypoint —
 * consumers see only the read-only `StateFacade`.
 */
export interface KernelStoreHandle {
  facade: StateFacade;
  getState(): Readonly<KernelState>;
  /**
   * Replace the state and notify exactly the subscribers of `changedNodes`
   * (FR-019: a single-property change reaches one node subscriber, not the world).
   */
  write(next: KernelState, changedNodes: Iterable<NodeId>): void;
}

function notifyObserver(callback: () => void): void {
  try {
    callback();
  } catch {
    // Store observers run after Zustand has accepted the new state. They are
    // views/telemetry, not transaction participants, so they cannot roll back
    // or make a committed command appear to have failed.
  }
}

export function createKernelStore(initial: KernelState): KernelStoreHandle {
  const store = createStore<KernelState>()(() => initial);
  const nodeListeners = new Map<NodeId, Set<(node: Node | undefined) => void>>();

  const facade: StateFacade = {
    getState: () => store.getState(),
    subscribe: (listener) =>
      store.subscribe((state) => {
        notifyObserver(() => {
          listener(state);
        });
      }),
    subscribeNode(id, listener) {
      let set = nodeListeners.get(id);
      if (set === undefined) {
        set = new Set();
        nodeListeners.set(id, set);
      }
      set.add(listener);
      return () => {
        set.delete(listener);
        if (set.size === 0) {
          nodeListeners.delete(id);
        }
      };
    },
    select(selector, listener) {
      let previous = selector(store.getState());
      return store.subscribe((state) => {
        notifyObserver(() => {
          const next = selector(state);
          if (!Object.is(next, previous)) {
            previous = next;
            listener(next);
          }
        });
      });
    },
  };

  return {
    facade,
    getState: () => store.getState(),
    write(next, changedNodes) {
      store.setState(next, true);
      for (const id of changedNodes) {
        const set = nodeListeners.get(id);
        if (set === undefined) {
          continue;
        }
        const node = next.doc.nodes[id];
        for (const listener of [...set]) {
          notifyObserver(() => {
            listener(node);
          });
        }
      }
    },
  };
}
