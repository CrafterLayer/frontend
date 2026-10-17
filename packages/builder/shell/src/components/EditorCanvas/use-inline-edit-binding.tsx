import { useLayoutEffect, useMemo, type ComponentType } from 'react';

import type { BuilderKernel } from '@craftkit/builder-core';
import type {
  InlineEditorProps,
  InlineFormatAction,
  InlineSelectionAnchorReport,
} from '@craftkit/builder-schema';

import type { InlineSession } from '../../overlay/inline-session';
import { partInlineCommit } from '../../overlay/part-inline';
import { partInstanceName } from '../../overlay/part-target';
import { InlineRichSurface } from '../InlineRichSurface';
import { InlineTextSurface } from '../InlineTextSurface';
import type { EditorCanvasLabels } from './EditorCanvas.labels';
import type { FloatingMounts } from './EditorCanvas.types';
import type {
  InlineEditBinding,
  InlineEditEntryPoint,
  MutableInlineEditSeam,
} from './inline-edit-seam';
import type { CanvasRefs } from './use-canvas-refs';

export interface InlineEditBindingInputs {
  kernel: BuilderKernel;
  seam: MutableInlineEditSeam;
  inlineSession: InlineSession | null;
  inlineEntryPoint: InlineEditEntryPoint | null;
  inlineRejection: string | null;
  inlineRejectionId: string;
  setInlineRejection: (message: string | null) => void;
  contributedEditor: ComponentType<InlineEditorProps> | null;
  contributedEditorPending: boolean;
  floating: FloatingMounts | null;
  /** The canvas locale: the only thing a part session's label reads from the labels. */
  locale: EditorCanvasLabels['locale'];
  reportTextAnchor: (report: InlineSelectionAnchorReport | null) => void;
  reportTextActions: (actions: InlineFormatAction[]) => void;
  requestFormattingMenuFocus: (returnFocusToEditor: () => void) => boolean;
  endInlineEditFromSurfaceKeyboard: () => void;
  refs: CanvasRefs;
}

/**
 * The descriptor written into the stable node-keyed seam. A contributed
 * implementation is CHOSEN before anything swaps into the block: while its
 * loader is pending `render` is null, so the block keeps its ordinary output
 * and exactly one editing surface mounts when resolution finishes.
 *
 * Keyed on the canvas LOCALE rather than the labels object (render-cost pass,
 * 2026-10-13): a new descriptor notifies the edited node, so a host that
 * re-rendered with an equal-but-new labels object used to re-render the open
 * editor on every host render.
 */
export function useInlineEditBinding({
  kernel,
  seam,
  inlineSession,
  inlineEntryPoint,
  inlineRejection,
  inlineRejectionId,
  setInlineRejection,
  contributedEditor,
  contributedEditorPending,
  floating,
  locale,
  reportTextAnchor,
  reportTextActions,
  requestFormattingMenuFocus,
  endInlineEditFromSurfaceKeyboard,
  refs,
}: InlineEditBindingInputs): void {
  const { announceGestureRef } = refs;
  const inlineEditBinding = useMemo<InlineEditBinding | null>(() => {
    if (inlineSession === null) {
      return null;
    }
    const { nodeId, propKey, kind } = inlineSession;
    // ── block-parts (2026-10-06) ──
    // A PART session edits a nested bound value: NodeView swaps the editor in
    // at `bind`, the surface is named after the part, and the commit goes
    // through the part planner as ONE labelled transaction (one Undo).
    const session = inlineSession;
    const bind = session.bind;
    const part = session.part;
    const label =
      bind === undefined || part === undefined
        ? propKey
        : partInstanceName(kernel, nodeId, part, locale ?? 'en');
    const singleLine = session.singleLine ?? true;
    // ── /block-parts ──
    const commit = (next: unknown) => {
      // ── block-parts (2026-10-06) ──
      if (bind !== undefined) {
        const result = partInlineCommit(kernel, session, next);
        if (result.ok) {
          setInlineRejection(null);
        } else {
          setInlineRejection(result.message);
          announceGestureRef.current(result.message);
        }
        return;
      }
      // ── /block-parts ──
      // The SAME door as the inspector: one dispatch per commit, and history's
      // typing merge owns undo granularity (FR-003).
      try {
        kernel.dispatch('setProp', { id: nodeId, key: propKey, value: next }, 'user');
        setInlineRejection(null);
      } catch (error) {
        // A door rejection leaves the document untouched; the surface keeps
        // what was typed so the editor can correct it in place. The reason is
        // visible next to, and described by, the same live control.
        setInlineRejection(error instanceof Error ? error.message : String(error));
        announceGestureRef.current(`${propKey} rejected`);
      }
    };
    const exit = () => {
      endInlineEditFromSurfaceKeyboard();
    };
    const Contributed = contributedEditor;
    return {
      nodeId,
      target: {
        propKey,
        // ── block-parts (2026-10-06) ──
        ...(bind === undefined ? {} : { bind }),
        // ── /block-parts ──
        render: contributedEditorPending
          ? null
          : ({ value }) => {
              // A contributed editor outranks the built-ins wherever an
              // extension registered one (009 §11). A resolved loader failure
              // uses the built-in, but a PENDING loader never mounts it first.
              if (Contributed !== null) {
                return (
                  <Contributed
                    value={value}
                    label={label}
                    onCommit={commit}
                    onExit={exit}
                    onAnchor={reportTextAnchor}
                    onActions={reportTextActions}
                    requestFormattingMenuFocus={requestFormattingMenuFocus}
                    formattingMenuElement={floating?.text ?? null}
                  />
                );
              }
              return kind === 'rich' ? (
                <InlineRichSurface
                  value={value}
                  label={label}
                  onCommit={commit}
                  onExit={exit}
                  onAnchor={reportTextAnchor}
                  onActions={reportTextActions}
                  requestFormattingMenuFocus={requestFormattingMenuFocus}
                  formattingMenuElement={floating?.text ?? null}
                />
              ) : (
                <InlineTextSurface
                  value={value}
                  label={label}
                  singleLine={singleLine}
                  onCommit={commit}
                  onExit={exit}
                />
              );
            },
        ...(inlineEntryPoint === null ? {} : { entryPoint: inlineEntryPoint }),
        ...(inlineRejection === null
          ? {}
          : { rejection: { id: inlineRejectionId, message: inlineRejection } }),
      },
    };
  }, [
    inlineSession,
    kernel,
    contributedEditor,
    contributedEditorPending,
    inlineEntryPoint,
    inlineRejection,
    inlineRejectionId,
    setInlineRejection,
    reportTextAnchor,
    reportTextActions,
    requestFormattingMenuFocus,
    floating,
    endInlineEditFromSurfaceKeyboard,
    announceGestureRef,
    // ── block-parts (2026-10-06) ──
    locale,
    // ── /block-parts ──
  ]);

  useLayoutEffect(() => {
    seam.set(inlineEditBinding);
  }, [inlineEditBinding, seam]);
}
