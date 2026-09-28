import * as Tooltip from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';

import { TOOLTIP_DELAY_MS, TOOLTIP_SKIP_DELAY_MS, TooltipScopeContext } from './tooltip-scope';

export interface AgentTooltipProviderProps {
  readonly children: ReactNode;
  /** Hover time before a tooltip opens. Tests pass 0. */
  readonly delayDuration?: number | undefined;
}

/**
 * One tooltip clock for the whole panel. AgentPanel mounts it at its root, so moving the
 * pointer from Conversations to New conversation opens the second tooltip at once rather
 * than after another half second.
 */
export function AgentTooltipProvider({
  children,
  delayDuration = TOOLTIP_DELAY_MS,
}: AgentTooltipProviderProps) {
  return (
    <TooltipScopeContext value={true}>
      <Tooltip.Provider delayDuration={delayDuration} skipDelayDuration={TOOLTIP_SKIP_DELAY_MS}>
        {children}
      </Tooltip.Provider>
    </TooltipScopeContext>
  );
}
