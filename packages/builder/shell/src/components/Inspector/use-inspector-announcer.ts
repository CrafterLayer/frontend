import { useState, useSyncExternalStore } from 'react';

import type { Announcer, AnnouncerState } from './types';

/**
 * A per-instance external store for the panel's polite region.
 *
 * `{text, nonce}`: repeated outcomes must still mutate the live region's text
 * node or AT hears nothing the second time (the established shell pattern).
 * Held OUTSIDE React state so that announcing re-renders only the region that
 * subscribes to it — a commit's "updated" message must not cost the panel a
 * render, and `announce` keeps one identity for the life of the Inspector.
 */
export function createAnnouncer(): Announcer {
  let state: AnnouncerState = { text: '', nonce: 0 };
  const listeners = new Set<() => void>();
  return {
    announce: (text) => {
      state = { text, nonce: state.nonce + 1 };
      for (const listener of [...listeners]) {
        listener();
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => state,
  };
}

export function useAnnouncer(): Announcer {
  return useState(createAnnouncer)[0];
}

export function useAnnouncement(announcer: Announcer): AnnouncerState {
  return useSyncExternalStore(announcer.subscribe, announcer.getSnapshot, announcer.getSnapshot);
}
