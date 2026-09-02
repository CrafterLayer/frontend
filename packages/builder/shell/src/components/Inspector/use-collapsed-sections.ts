import { useCallback, useState } from 'react';

export interface CollapsedSections {
  readonly isCollapsed: (key: string) => boolean;
  /** One identity for the life of the panel — the section memo compares it. */
  readonly toggle: (key: string) => void;
}

/**
 * Which sections are collapsed, keyed `${nodeId}:${bucket}:${tab}:${section}`
 * so a collapse belongs to one block's one bucket and never leaks across a
 * selection change. A toggle re-renders the panel (cheap) and the toggled
 * section; every other section bails on its unchanged `expanded`.
 */
export function useCollapsedSections(): CollapsedSections {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = useCallback((key: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);
  return { isCollapsed: (key) => collapsed.has(key), toggle };
}
