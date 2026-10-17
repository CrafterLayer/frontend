import { useEffect, useEffectEvent } from 'react';

import type { BuilderKernel } from '@craftkit/builder';

import type { EditorPanes } from './use-editor-panes';

type KernelState = ReturnType<BuilderKernel['context']['store']['getState']>;

/** BuilderShell's narrow breakpoint: below it a side column is drawn OVER the canvas. */
const OVERLAY_BELOW = 900;

/** What is selected, as one comparable key: the node, and the element or part inside it. */
function selectionKey(state: KernelState): string {
  return JSON.stringify([state.selection, state.elementFocus, state.partFocus]);
}

/** Whether the person is working inside the panel column (Layers, the library…). */
function focusIsInPanel(): boolean {
  const active = document.activeElement;
  return active !== null && active.closest('.bldr-shell__panel') !== null;
}

export type RevealInspectorPanes = Pick<
  EditorPanes,
  'visiblePanes' | 'asideOpen' | 'railSection' | 'setActiveSide'
>;

/**
 * At widths where only one side column fits (1024px and below), the panel wins and the
 * Inspector is hidden. Selecting a block ON THE CANVAS then looked like it did nothing —
 * the outline appeared, and the settings that go with it stayed out of reach (UX pass,
 * 2026-10-13). A canvas selection now brings the Inspector forward. A selection made in
 * the panel column (Layers) keeps the panel, because the person is working there; a
 * closed Inspector stays closed; the Assistant is never pushed aside; and where a column
 * would overlay the canvas (a phone), nothing is pushed over the page.
 */
export function useRevealInspector(kernel: BuilderKernel | undefined, panes: RevealInspectorPanes) {
  const reveal = useEffectEvent(() => {
    const { visiblePanes, asideOpen, railSection, setActiveSide } = panes;
    // Below the shell's narrow breakpoint a side column overlays the canvas, and clicking
    // the page must not cover it; there the Inspector toggle stays the way in.
    const covered = window.innerWidth < OVERLAY_BELOW;
    if (visiblePanes.aside || covered || !asideOpen || railSection === 'assistant') return;
    if (focusIsInPanel()) return;
    setActiveSide('aside');
  });
  useEffect(() => {
    if (kernel === undefined) return undefined;
    const store = kernel.context.store;
    let previous = selectionKey(store.getState());
    return store.subscribe(() => {
      const state = store.getState();
      const next = selectionKey(state);
      if (next === previous) return;
      previous = next;
      if (state.selection.length > 0) reveal();
    });
  }, [kernel]);
}
