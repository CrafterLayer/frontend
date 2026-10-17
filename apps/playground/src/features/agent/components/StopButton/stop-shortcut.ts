/**
 * The Stop shortcut (SPEC §4.17, §6.7): ⌘. on Apple platforms, Ctrl+. everywhere else.
 *
 * Kept beside StopButton because the button and the key must never disagree: the tooltip
 * names the chord, `aria-keyshortcuts` announces it, and the Composer (and AgentPanel, at
 * the panel's root) listen for it through the same predicate.
 */
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

import { stopShortcut } from '../../copy';

/** Whether this browser runs on an Apple platform, where ⌘ is the command modifier. */
function detectApple(): boolean {
  if (typeof navigator === 'undefined') return false;
  // Client hints where the browser has them; the user agent string everywhere else.
  const hinted = (navigator as Navigator & { userAgentData?: { platform?: string } })
    .userAgentData?.platform;
  return /mac|iphone|ipad|ipod/iu.test(hinted ?? navigator.userAgent);
}

/** Read once: the platform does not change while the page is open. */
export const IS_APPLE_PLATFORM = detectApple();

/** The chord's printed name for `stop.tooltip` (`⌘.` / `Ctrl+.`). */
export function stopShortcutLabel(apple: boolean = IS_APPLE_PLATFORM): string {
  return stopShortcut(apple);
}

/** The chord for `aria-keyshortcuts`, in the attribute's own key names. */
export function stopKeyShortcuts(apple: boolean = IS_APPLE_PLATFORM): string {
  return apple ? 'Meta+.' : 'Control+.';
}

/**
 * Whether a key press is the Stop chord. Both modifiers are accepted on every platform:
 * ⌘. on a Mac, Ctrl+. elsewhere, and the other one does nothing else in a browser, so a
 * person who learned it on the other platform is not left pressing it in vain. Shift or
 * Alt makes it a different chord, and a press held down does not repeat the stop.
 *
 * A handler that acts on it calls `preventDefault()`, so a panel-level listener above the
 * Composer (`AgentPanel`) can skip an event the Composer already spent.
 */
export function isStopShortcut(event: KeyboardEvent | ReactKeyboardEvent): boolean {
  return (
    event.key === '.' &&
    (event.ctrlKey || event.metaKey) &&
    !event.shiftKey &&
    !event.altKey &&
    !event.repeat &&
    !event.defaultPrevented
  );
}
