import { createContext } from 'react';

import type { BuildNotice } from '../AssistantPanel/AssistantPanel.build';

/**
 * What the PANEL lends the two build cards beyond the props the thread passes.
 *
 * A context rather than props because the component between them — the thread,
 * which dispatches each turn to its card — is not this feature's to change, and
 * three new props threaded through it for two cards would be the wider edit.
 * The cards stay renderable without it: the default says nothing and offers
 * nothing, which is what a story or a revived conversation should show.
 */
export interface BuildCardSeam {
  /** The panel's language, for the sentences these cards say (notices, refusals). */
  readonly locale: 'ar' | 'en';
  /**
   * A build turn's notices, by turn id. The approval card is handed the list and
   * the direction but not the turn, so this is how it learns where the page will
   * land before the person decides.
   */
  readonly noticesOf: (turnId: string) => readonly BuildNotice[];
  /**
   * Remove the empty sections a build left, as ONE transaction. Absent: the
   * report never offers it.
   */
  readonly onRemoveUnfilled?: ((turnId: string) => void) | undefined;
}

const NO_NOTICES: readonly BuildNotice[] = [];

export const BuildCardSeamContext = createContext<BuildCardSeam>({
  locale: 'en',
  noticesOf: () => NO_NOTICES,
});
