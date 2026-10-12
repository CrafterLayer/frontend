import { useCallback, useState } from 'react';

import type { AnnouncementView } from '../../model/view-types';

/** What a panel control asked the live region to say, numbered so a repeat is spoken again. */
export interface SpokenAside {
  readonly seq: number;
  readonly text: string;
}

/**
 * The panel's one live region speaks for its controls too (2026-10-12): the composer's `/`
 * command answers came from a second `role="status"` inside the panel, which the panel's
 * contract forbids (LiveStatus: "Nothing else in the panel is live"). A control hands its
 * sentence to `say`; the next run announcement takes over again.
 */
export function useSpokenAside(
  announcement: AnnouncementView | null,
): readonly [SpokenAside | null, (text: string) => void] {
  const [spoken, setSpoken] = useState<SpokenAside | null>(null);
  // A new announcement takes the region back: reset while rendering, not in an effect.
  const [heard, setHeard] = useState(announcement);
  if (heard !== announcement) {
    setHeard(announcement);
    setSpoken(null);
  }
  const say = useCallback((text: string) => {
    setSpoken((said) => ({ seq: (said?.seq ?? 0) + 1, text }));
  }, []);
  return [spoken, say] as const;
}
