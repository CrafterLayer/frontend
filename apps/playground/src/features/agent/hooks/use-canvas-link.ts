/**
 * The panel's link to the canvas (SPEC §7.4 `hooks/use-canvas-link.ts`, §4.8 SpineRow,
 * §4.9 "Show on page", §4.8 FactsDisclosure rows).
 *
 * Phase 1 (this): `reveal(nodeId)` selects the section through the kernel, the same door a
 * click on the canvas uses, so the canvas scrolls to it (where it does) and the Inspector
 * follows; a node that is no longer on the page is not selected (a stale row or chip must
 * not clear the person's selection for nothing). `peek` is phase 2's hover outline
 * (SPEC §4.20 `pointed`, engine E8): until the canvas stage exists it goes to the host's
 * `onPeek` when one is given, and otherwise does nothing.
 */
import { useCallback, useMemo } from 'react';

import type { BuilderKernel, NodeId } from '@craftkit/builder';

export interface CanvasLink {
  readonly reveal: (nodeId: NodeId) => void;
  readonly peek: (nodeId: NodeId | null) => void;
}

export interface UseCanvasLinkOptions {
  /** Phase 2: the canvas stage's pointed outline (`onStageHandle`, WP-21). */
  readonly onPeek?: ((nodeId: NodeId | null) => void) | undefined;
}

export function useCanvasLink(kernel: BuilderKernel, options: UseCanvasLinkOptions = {}): CanvasLink {
  const { onPeek } = options;
  const reveal = useCallback(
    (nodeId: NodeId) => {
      const document = kernel.getDocument();
      if (document.nodes[nodeId] === undefined || nodeId === document.rootId) return;
      kernel.setSelection([nodeId]);
    },
    [kernel],
  );
  const peek = useCallback(
    (nodeId: NodeId | null) => {
      onPeek?.(nodeId);
    },
    [onPeek],
  );
  return useMemo(() => ({ reveal, peek }), [reveal, peek]);
}
