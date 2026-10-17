import { useCallback, useSyncExternalStore } from 'react';

import type { StyleSource } from './style-source';

const SEPARATOR = '\u0000';

/**
 * The class strings of a StyleSource's targets, as React state: re-renders
 * when any target's stored classes change (undo, an agent edit, another
 * control). The snapshot is one joined string, a primitive, so an unrelated
 * write never re-renders the panel.
 */
export function useStyleSourceClasses(source: StyleSource): readonly string[] {
  const subscribe = useCallback((onChange: () => void) => source.subscribe(onChange), [source]);
  const read = useCallback(() => source.read().join(SEPARATOR), [source]);
  const joined = useSyncExternalStore(subscribe, read, read);
  return joined === '' && source.targetCount <= 1 ? [''] : joined.split(SEPARATOR);
}
