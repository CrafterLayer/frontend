import { useEffect, useEffectEvent } from 'react';

import { isPaletteShortcut } from './command-model';

/**
 * Ctrl/⌘ K toggles the palette from anywhere in the editor document (Studio Indigo,
 * 2026-10-12). The browser's own Ctrl K (focus the address bar's search) is prevented only
 * while the editor is enabled; the canvas frame is a separate document and keeps its keys.
 */
export function useCommandPaletteShortcut(onToggle: () => void, enabled = true): void {
  const toggle = useEffectEvent(onToggle);
  useEffect(() => {
    if (!enabled) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isPaletteShortcut(event)) return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [enabled]);
}
