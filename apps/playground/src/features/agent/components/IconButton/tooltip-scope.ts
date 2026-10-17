/**
 * The panel's tooltip timing, and whether a shared provider is above a button.
 *
 * Radix shares its open delay through a Provider: inside one, moving from one icon to the
 * next shows the second tooltip at once (the "skip delay") instead of waiting again. The
 * panel mounts one AgentTooltipProvider at its root; an IconButton rendered anywhere else
 * (a story, a test, a host that never mounted the panel) brings its own, so it can never
 * throw Radix's "must be used within TooltipProvider".
 */
import { createContext } from 'react';

/** Hover this long before a tooltip opens. Keyboard focus opens it at once. */
export const TOOLTIP_DELAY_MS = 500;

/** After a tooltip closes, the next one within this window opens without the delay. */
export const TOOLTIP_SKIP_DELAY_MS = 300;

/** True below an AgentTooltipProvider. */
export const TooltipScopeContext = createContext(false);
