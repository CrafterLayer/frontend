import { useCallback, useSyncExternalStore } from 'react';

import type { BuilderKernel } from '@craftkit/builder';

/**
 * The live facts the chrome reads from the page kernel's store: the document's
 * direction and whether undo / redo can move. Subscribed, never read bare.
 */
export function useKernelSnapshot(kernel: BuilderKernel | undefined) {
  // Every observable change pairs 1:1 with a transaction (Law S), so a live
  // counter is both a user-facing session gauge and the SC-004 arithmetic probe.
  const txSubscribe = useCallback(
    (onStoreChange: () => void) =>
      kernel === undefined ? () => undefined : kernel.context.store.subscribe(onStoreChange),
    [kernel],
  );
  // Subscribed read (never a bare render-body getState): the preview flip
  // derives from the LIVE document direction.
  const docDir = useSyncExternalStore(
    txSubscribe,
    useCallback(() => kernel?.getDocument().dir ?? 'ltr', [kernel]),
  );
  // History is external kernel state too. Primitive snapshots keep the top
  // bar truthful on first render and after every undo/redo cursor movement.
  const canUndo = useSyncExternalStore(
    txSubscribe,
    useCallback(() => kernel?.canUndo() ?? false, [kernel]),
  );
  const canRedo = useSyncExternalStore(
    txSubscribe,
    useCallback(() => kernel?.canRedo() ?? false, [kernel]),
  );
  return { docDir, canUndo, canRedo };
}

/** Whether a document's root holds no blocks at all (an empty page). */
function isEmptyDocument(kernel: BuilderKernel): boolean {
  const document = kernel.getDocument();
  const root = document.nodes[document.rootId];
  return Object.values(root?.slots ?? {}).every((children) => children.length === 0);
}

/**
 * Whether the page has no blocks: the canvas then shows its invitation (UX pass,
 * 2026-10-13). Subscribed like every other kernel fact here; false while there is no kernel.
 */
export function useDocumentIsEmpty(kernel: BuilderKernel | undefined): boolean {
  return useSyncExternalStore(
    useCallback(
      (onStoreChange: () => void) =>
        kernel === undefined ? () => undefined : kernel.context.store.subscribe(onStoreChange),
      [kernel],
    ),
    useCallback(() => (kernel === undefined ? false : isEmptyDocument(kernel)), [kernel]),
  );
}
