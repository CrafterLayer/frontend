import { useMemo, useState, useSyncExternalStore } from 'react';

import type { AgentStorage } from '../model/migrate-sessions';
import {
  createStoryBibleStore,
  type StoryBibleStore,
  type StoryBibleView,
} from '../model/story-bible';

function browserStorage(): AgentStorage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    // A sandboxed frame can throw on the property read itself.
    return undefined;
  }
}

export interface UseStoryBibleResult {
  /** The store the controller's flows read and teach (stable for the panel's life). */
  readonly store: StoryBibleStore;
  /** What the panel renders: the current bible and the person's edits. */
  readonly view: StoryBibleView;
}

/**
 * The project's story bible (creative agent, 2026-10-12), persisted like the conversations:
 * `undefined` storage is the browser's localStorage, `null` keeps it in memory only.
 */
export function useStoryBible(storage: AgentStorage | null | undefined): UseStoryBibleResult {
  const [store] = useState(() =>
    createStoryBibleStore(storage === null ? undefined : (storage ?? browserStorage())),
  );
  const memory = useSyncExternalStore(store.subscribe, store.get, store.get);
  const view = useMemo<StoryBibleView>(
    () => ({
      memory,
      addCharacter: store.addCharacter,
      addFact: store.addFact,
      removeCharacter: store.removeCharacter,
      removeAsset: store.removeAsset,
      removeLocation: store.removeLocation,
      removeFact: store.removeFact,
      clear: store.clear,
    }),
    [memory, store],
  );
  return { store, view };
}
