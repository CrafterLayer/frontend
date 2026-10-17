import { useEffect, useMemo, useState, type ComponentType } from 'react';

import type { BuilderKernel } from '@craftkit/builder-core';
import type {
  InlineEditableKind,
  InlineEditorProps,
  InlineFormatAction,
} from '@craftkit/builder-schema';

import {
  RICH_TEXT_ACTION_LABELS_AR,
  RICH_TEXT_ACTION_LABELS_EN,
  localizeRichActions,
  type RichTextActionLabels,
} from '../../overlay/inline-dock-anchor';
import type { InlineSession } from '../../overlay/inline-session';
import type { CanvasRefs } from './use-canvas-refs';

/** Stable empty list, so "no bubble" never allocates a new array per render. */
const NO_ACTIONS: InlineFormatAction[] = [];

export interface InlineEditorChromeInputs {
  kernel: BuilderKernel;
  inlineSession: InlineSession | null;
  textActions: InlineFormatAction[];
  richTextLabels: RichTextActionLabels | undefined;
  locale: string | undefined;
  refs: CanvasRefs;
}

/**
 * What an OPEN inline session puts around itself: the layer's editing class,
 * the formatting bubble's localized actions, and the contributed editor —
 * resolved lazily from the registry (009 §11) before anything swaps in.
 */
export function useInlineEditorChrome({
  kernel,
  inlineSession,
  textActions,
  richTextLabels,
  locale,
  refs,
}: InlineEditorChromeInputs) {
  const { layerRef, machineryRef, textMeasureRef, returnFocusToEditorRef, onToolErrorRef } = refs;
  // The contributed editor, KEYED by the kind it serves. Loaded on demand — a
  // session that never inline-edits rich text never pulls an editing engine in —
  // and kept afterwards, so reopening the same kind costs nothing.
  const [loadedEditor, setLoadedEditor] = useState<{
    kind: InlineEditableKind;
    /** Null means the contribution failed and the built-in fallback won. */
    Component: ComponentType<InlineEditorProps> | null;
  } | null>(null);

  // While a block's text is open IN PLACE, the editing surface's own focus ring
  // is the chrome. Stacking the selection outline and its name label on top
  // reads as three competing borders around one paragraph — the double-chrome
  // defect. A class on the layer, so the hot path stays untouched.
  useEffect(() => {
    layerRef.current?.classList.toggle('bldr-overlay--editing', inlineSession !== null);
  }, [inlineSession, layerRef]);

  // Closing the session retires the LIVE measurement source HERE rather than
  // trusting the editor to report its own farewell. Geometry never enters
  // React state; the channel invokes the source on every observer-driven flush.
  useEffect(() => {
    if (inlineSession !== null) {
      return;
    }
    textMeasureRef.current = null;
    machineryRef.current?.anchors.setText(null);
  }, [inlineSession, textMeasureRef, machineryRef]);

  // ── block-parts (2026-10-06) ── the editor's actions in the editor's language
  const richLabels =
    richTextLabels ?? (locale === 'ar' ? RICH_TEXT_ACTION_LABELS_AR : RICH_TEXT_ACTION_LABELS_EN);
  const visibleTextActions = useMemo(
    () => (inlineSession === null ? NO_ACTIONS : localizeRichActions(textActions, richLabels)),
    [inlineSession, textActions, richLabels],
  );
  // ── /block-parts ──

  useEffect(() => {
    if (inlineSession === null || visibleTextActions.length === 0) {
      returnFocusToEditorRef.current = null;
    }
  }, [inlineSession, visibleTextActions.length, returnFocusToEditorRef]);

  /**
   * Resolve the OPEN session's editor from the registry (009 §11). The
   * contribution is lazy by contract, so this is the one moment an editing
   * engine may load — and only for a session that actually needs it, which is
   * exactly the containment law the loader counter proves (SC-005). A kind with
   * no contribution never opens a session at all, so the only fallback here is
   * the canvas's own plain-text surface.
   */
  useEffect(() => {
    if (inlineSession === null) {
      return undefined;
    }
    const kind = inlineSession.kind;
    const def = kernel.context.registry.inlineEditor(kind);
    if (def === undefined || loadedEditor?.kind === kind) {
      return undefined;
    }
    let live = true;
    void def
      .load()
      .then((module) => {
        if (live) {
          setLoadedEditor({ kind, Component: module.default });
        }
        return undefined;
      })
      .catch((error: unknown) => {
        // A broken contribution must not take the canvas down: the session
        // stays open on the built-in surface, and the failure is reported
        // through the same sink a failing canvas tool uses. Nothing mounted
        // while the loader was pending, so the fallback is still the ONE
        // surface this session ever mounts.
        if (live) {
          setLoadedEditor({ kind, Component: null });
        }
        onToolErrorRef.current?.(def.id, error);
      });
    return () => {
      live = false;
    };
  }, [inlineSession, kernel, loadedEditor, onToolErrorRef]);

  // Derived, never cleared by an effect: an editor loaded for another kind is
  // simply not this session's editor.
  const contributedEditor =
    inlineSession !== null &&
    loadedEditor?.kind === inlineSession.kind &&
    loadedEditor.Component !== null
      ? loadedEditor.Component
      : null;
  const contributedEditorPending =
    inlineSession !== null &&
    kernel.context.registry.inlineEditor(inlineSession.kind) !== undefined &&
    loadedEditor?.kind !== inlineSession.kind;

  return { richLabels, visibleTextActions, contributedEditor, contributedEditorPending };
}
