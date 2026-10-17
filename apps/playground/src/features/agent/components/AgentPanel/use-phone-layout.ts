import { useSyncExternalStore } from 'react';

/**
 * Whether the panel is on a phone: a viewport under 600px AND a coarse pointer (SPEC
 * §3.16, §4.19). Then the panel is the AgentSheet with its two detents; anywhere else it
 * is the docked column. A narrow desktop window keeps the dock (the editor's own layout
 * overlays it on the canvas), so a resize never throws a mouse user into a touch sheet.
 */
export const PHONE_QUERY = '(max-width: 599.98px) and (pointer: coarse)';

function mediaList(): MediaQueryList | null {
  // jsdom and old embeds have no `matchMedia`: no phone to detect, the dock it is.
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  return window.matchMedia(PHONE_QUERY);
}

function subscribe(listener: () => void): () => void {
  const list = mediaList();
  if (list === null) return () => undefined;
  list.addEventListener('change', listener);
  return () => {
    list.removeEventListener('change', listener);
  };
}

function getSnapshot(): boolean {
  return mediaList()?.matches ?? false;
}

const getServerSnapshot = (): boolean => false;

/** True while the viewport is a phone's (see `PHONE_QUERY`); follows rotation and resizes. */
export function usePhoneLayout(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
