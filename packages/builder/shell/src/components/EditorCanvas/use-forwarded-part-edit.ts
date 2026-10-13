import { useCallback, useEffect, useRef } from 'react';

import type { BuilderKernel } from '@craftkit/builder-core';
import { getAtPropPath, parsePropPath, type NodeId, type PartRef } from '@craftkit/builder-schema';

import { beginInPlaceTextEdit, type InPlaceTextEdit } from '../../overlay/in-place-text-edit';
import { partInlineTargetOf, type InlineSession } from '../../overlay/inline-session';
import { partInlineCommit } from '../../overlay/part-inline';
import { partInstanceName } from '../../overlay/part-target';
import type { CanvasRefs } from './use-canvas-refs';

export interface ForwardedPartEditInputs {
  kernel: BuilderKernel;
  refs: CanvasRefs;
}

// ── block-parts (2026-10-06) ──
/**
 * Typing in place on a part a PARENT draws for this node (a tab trigger,
 * `data-ck-part-owner`). The node's own render never draws that text, so
 * the inline-edit seam cannot swap an editor into it; the drawn element is
 * edited where it is instead (in-place-text-edit.ts), and the commit takes
 * the part planner's door: ONE labelled transaction, one Undo.
 *
 * Returns the opener; false when the part holds no plain text of its own.
 */
export function useForwardedPartEdit({
  kernel,
  refs,
}: ForwardedPartEditInputs): (nodeId: NodeId, part: PartRef) => boolean {
  const {
    sessionRef,
    treeSessionRef,
    machineryRef,
    layerRef,
    hostRef,
    canvasLabelsRef,
    announceGestureRef,
  } = refs;
  const forwardedEditRef = useRef<InPlaceTextEdit | null>(null);
  const beginForwardedPartText = useCallback(
    (nodeId: NodeId, part: PartRef): boolean => {
      const element = machineryRef.current?.index.partElement?.(nodeId, part) ?? null;
      const target = partInlineTargetOf(kernel, nodeId, part);
      const node = kernel.getDocument().nodes[nodeId];
      if (element === null || target?.kind !== 'text' || node === undefined) {
        return false;
      }
      const stored = getAtPropPath(node.props, parsePropPath(target.bind));
      if (typeof stored !== 'string') {
        return false;
      }
      treeSessionRef.current?.commit();
      sessionRef.current?.end();
      forwardedEditRef.current?.commit();
      const session: InlineSession = { nodeId, ...target };
      const name = partInstanceName(kernel, nodeId, part, canvasLabelsRef.current.locale ?? 'en');
      const opened: InPlaceTextEdit = beginInPlaceTextEdit({
        element,
        storedText: stored,
        singleLine: target.singleLine,
        label: name,
        onCommit: (text) => {
          const result = partInlineCommit(kernel, session, text);
          return result.ok ? { ok: true } : { ok: false, message: result.message };
        },
        onEnd: (outcome, exit, message) => {
          if (forwardedEditRef.current === opened) {
            forwardedEditRef.current = null;
          }
          layerRef.current?.classList.remove('bldr-overlay--tree-editing');
          machineryRef.current?.anchors.refresh();
          if (outcome === 'rejected' && message !== undefined) {
            announceGestureRef.current(message);
          }
          if (exit === 'keyboard') {
            hostRef.current?.focus({ preventScroll: true });
          }
        },
      });
      forwardedEditRef.current = opened;
      layerRef.current?.classList.add('bldr-overlay--tree-editing');
      machineryRef.current?.anchors.refresh();
      announceGestureRef.current(canvasLabelsRef.current.editing(name));
      return true;
    },
    [
      kernel,
      sessionRef,
      treeSessionRef,
      machineryRef,
      layerRef,
      hostRef,
      canvasLabelsRef,
      announceGestureRef,
    ],
  );
  // Any other write while the trigger is open (an agent, Undo) ends the edit
  // FIRST, so React's own nodes are back before it reconciles them; unmount
  // keeps what was typed.
  useEffect(() => {
    const off = kernel.context.events.on('tx.applied', () => {
      forwardedEditRef.current?.commit();
    });
    return () => {
      off();
      forwardedEditRef.current?.commit();
    };
  }, [kernel]);
  return beginForwardedPartText;
}
// ── /block-parts ──
