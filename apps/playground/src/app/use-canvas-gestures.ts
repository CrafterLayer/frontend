import { useCallback } from 'react';

import { resolveElementTarget, type BuilderKernel, type ElementTarget } from '@craftkit/builder';

import type { EditorLabels, EditorLocale } from './editor-labels';
import { useInspectorFocus } from './use-inspector-focus';
// ── block-parts (2026-10-06) ──
import { usePartWiring } from './use-part-wiring';
// ── /block-parts ──
import type { EditorPanes } from './use-editor-panes';

export interface CanvasGesturesOptions {
  readonly kernel: BuilderKernel | undefined;
  readonly labels: EditorLabels;
  readonly editorLocale: EditorLocale;
  readonly announce: (text: string) => void;
  /** Stable state setters: every gesture here opens a pane. */
  readonly setRailSection: EditorPanes['setRailSection'];
  readonly setPanelOpen: EditorPanes['setPanelOpen'];
  readonly setAsideOpen: EditorPanes['setAsideOpen'];
  readonly setActiveSide: EditorPanes['setActiveSide'];
}

/**
 * The canvas's ways into the panels: Edit with AI opens the assistant, More and
 * Animate open the Inspector at a place, the part gestures, and Replace media
 * opens Assets.
 */
export function useCanvasGestures({
  kernel,
  labels,
  editorLocale,
  announce: announceChrome,
  setRailSection,
  setPanelOpen,
  setAsideOpen,
  setActiveSide,
}: CanvasGesturesOptions) {
  /*
    "Edit with AI" on the quick bar: the assistant, scoped to THIS element. The
    agent reads the kernel's selection and element focus as its context, so the
    seam is the focus itself — set it, open the assistant, put the cursor in its
    composer. No agent model file changes for it.
  */
  const editWithAi = useCallback(
    (target: ElementTarget) => {
      if (kernel === undefined) return;
      const resolved = resolveElementTarget(kernel, target, labels.elementWords);
      if (target.kind === 'tree') kernel.focusElement(target.nodeId, target.path);
      else kernel.setSelection([target.nodeId]);
      setRailSection('assistant');
      setPanelOpen(true);
      setActiveSide('panel');
      announceChrome(labels.chrome.askAssistant(resolved?.displayName));
      requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>('.pg-agent-host textarea, .pg-legacy-agent-host textarea')
          ?.focus();
      });
    },
    [
      kernel,
      labels.elementWords,
      labels.chrome,
      announceChrome,
      setRailSection,
      setPanelOpen,
      setActiveSide,
    ],
  );
  const openAside = useCallback(() => {
    setAsideOpen(true);
    setActiveSide('aside');
  }, [setAsideOpen, setActiveSide]);
  // The quick bar's More / Animate open the Inspector at that place, not just the aside.
  const inspectorFocus = useInspectorFocus(openAside);
  // ── block-parts (2026-10-06) ── the canvas's part gestures: image, style, Edit with AI
  const partWiring = usePartWiring({
    kernel,
    locale: editorLocale,
    openAside,
    openStyleSector: inspectorFocus.openStyleSector,
    editWithAi,
  });
  // ── /block-parts ──
  const openAssets = useCallback(() => {
    setRailSection('assets');
    setPanelOpen(true);
    setActiveSide('panel');
  }, [setRailSection, setPanelOpen, setActiveSide]);
  return { editWithAi, inspectorFocus, partWiring, openAssets };
}
