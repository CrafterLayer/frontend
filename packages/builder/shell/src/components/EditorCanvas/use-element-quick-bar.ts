import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import type { BuilderKernel } from '@craftkit/builder-core';
import type { Theme } from '@craftkit/builder-renderer';
import type {
  BuilderDocument,
  CustomCodeRoot,
  NodeId,
  PaletteColor,
  StyleBucket,
  StyleSectorId,
  StyleState,
} from '@craftkit/builder-schema';

import type { ElementNameWords, ElementTarget } from '../../custom-code/element-target';
import {
  createMemoryStyleClipboard,
  performElementAction,
  resolveElementActions,
  type ElementActionId,
  type StyleClipboard,
} from '../../overlay/element-actions';
import { createElementSelection, type ElementSelection } from '../../selection/element-selection';
import { COLOR_ROLE_NAMES_AR } from '../DesignSystemPanel/DesignSystemPanel.labels';
import {
  createElementBarModel,
  paletteSwatches,
  themeColorSwatches,
  type ElementQuickBarLabels,
} from '../ElementQuickBar';
import type { CanvasRefs } from './use-canvas-refs';

type CanvasState = ReturnType<BuilderKernel['context']['store']['getState']>;
type TreeTarget = Extract<ElementTarget, { kind: 'tree' }>;

/**
 * A private multi-selection store when the host shares none. The store
 * subscribes to the kernel, so it is created (and disposed) by an effect
 * rather than during render; React needs it for the bar.
 */
export function useElementSelectionStore(
  kernel: BuilderKernel,
  elementSelection: ElementSelection | undefined,
): ElementSelection | null {
  const [ownSelection, setOwnSelection] = useState<ElementSelection | null>(null);
  useEffect(() => {
    if (elementSelection !== undefined) {
      return undefined;
    }
    const own = createElementSelection(kernel);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    setOwnSelection(own);
    return () => {
      own.dispose();
      setOwnSelection(null);
    };
  }, [kernel, elementSelection]);
  return elementSelection ?? ownSelection;
}

export interface ElementQuickBarInputs {
  kernel: BuilderKernel;
  doc: BuilderDocument;
  theme: Theme;
  dir: 'ltr' | 'rtl';
  selectedId: NodeId | null;
  elementFocus: CanvasState['elementFocus'];
  selectionStore: ElementSelection | null;
  bucket: StyleBucket;
  styleState: StyleState;
  elementNameWords: ElementNameWords;
  namedStyleClasses: Readonly<Record<string, string>> | undefined;
  symbolTree: ((symbolId: string) => CustomCodeRoot | undefined) | undefined;
  quickBarLabels: ElementQuickBarLabels;
  palette: readonly PaletteColor[] | undefined;
  styleClipboard: StyleClipboard | undefined;
  onSaveTemplate: ((target: ElementTarget) => void) | undefined;
  onAnimate: ((target: ElementTarget) => void) | undefined;
  onOpenStyleSector: ((sector: StyleSectorId, target: ElementTarget) => void) | undefined;
  /** Quick bar "Edit with AI" for the element. Absent ⇒ no sparkle button. */
  onEditWithAi: ((target: ElementTarget) => void) | undefined;
  /** Image/video "Replace" for the element. Absent ⇒ disabled. */
  onReplaceMedia: ((target: ElementTarget) => void) | undefined;
  refs: CanvasRefs;
}

/**
 * P7: the element quick bar (style-manager DESIGN.md §A.6) — its targets (the
 * kernel's element focus first, then the multi-selection's other tree
 * members), its model, its colours and its element actions.
 */
export function useElementQuickBar({
  kernel,
  doc,
  theme,
  dir,
  selectedId,
  elementFocus,
  selectionStore,
  bucket,
  styleState,
  elementNameWords,
  namedStyleClasses,
  symbolTree,
  quickBarLabels,
  palette,
  styleClipboard,
  onSaveTemplate,
  onAnimate,
  onOpenStyleSector,
  onEditWithAi,
  onReplaceMedia,
  refs,
}: ElementQuickBarInputs) {
  const { hostRef, machineryRef, announceGestureRef } = refs;
  const fallbackClipboard = useMemo(() => createMemoryStyleClipboard(), []);
  const clipboard = styleClipboard ?? fallbackClipboard;
  // Bumped after Copy style so the bar re-renders with Paste style enabled.
  const [, setClipboardNonce] = useState(0);

  const emptyTargets = useMemo<readonly ElementTarget[]>(() => [], []);
  const subscribeSelection = useCallback(
    (listener: () => void) => selectionStore?.subscribe(listener) ?? (() => undefined),
    [selectionStore],
  );
  const readSelection = useCallback(
    () => selectionStore?.targets() ?? emptyTargets,
    [selectionStore, emptyTargets],
  );
  const selectedTargets = useSyncExternalStore(subscribeSelection, readSelection, readSelection);

  /** Primary first (the kernel's element focus), then the multi-selection's other tree members. */
  const elementTargets = useMemo<readonly TreeTarget[]>(() => {
    if (elementFocus?.id !== selectedId) {
      return [];
    }
    const primary = {
      kind: 'tree' as const,
      nodeId: elementFocus.id,
      path: [...elementFocus.path],
    };
    const extras = selectedTargets.filter(
      (target): target is TreeTarget =>
        target.kind === 'tree' &&
        !(
          target.nodeId === primary.nodeId &&
          target.path.length === primary.path.length &&
          target.path.every((value, at) => primary.path[at] === value)
        ),
    );
    return [primary, ...extras];
  }, [elementFocus, selectedId, selectedTargets]);
  const elementTargetsRef = useRef(elementTargets);
  useEffect(() => {
    elementTargetsRef.current = elementTargets;
    machineryRef.current?.controller.setExtraElements(
      elementTargets.slice(1).map((target) => ({ nodeId: target.nodeId, path: target.path })),
    );
  }, [elementTargets, machineryRef]);

  const quickModel = useMemo(
    () =>
      elementTargets[0] === undefined || doc.nodes[elementTargets[0].nodeId] === undefined
        ? undefined
        : createElementBarModel(kernel, elementTargets, {
            bucket,
            state: styleState,
            pageDir: dir,
            words: elementNameWords,
            namedStyles: namedStyleClasses,
            writeOptions: { symbolTree },
          }),
    [
      kernel,
      doc,
      elementTargets,
      bucket,
      styleState,
      dir,
      elementNameWords,
      namedStyleClasses,
      symbolTree,
    ],
  );
  // The colour roles in the editor's language (fix pass 2026-10-06).
  const quickBarLocale = quickBarLabels.locale;
  const colorTokens = useMemo(
    () => themeColorSwatches(theme, quickBarLocale === 'ar' ? COLOR_ROLE_NAMES_AR : undefined),
    [theme, quickBarLocale],
  );
  const paletteColors = useMemo(() => paletteSwatches(palette), [palette]);

  const actionContext = useMemo(
    () => ({
      bucket,
      styleClipboard: clipboard,
      ...(onSaveTemplate === undefined ? {} : { onSaveTemplate }),
      ...(onAnimate !== undefined
        ? { onAnimate }
        : onOpenStyleSector === undefined
          ? {}
          : {
              onAnimate: (target: ElementTarget) => {
                onOpenStyleSector('motion', target);
              },
            }),
    }),
    [bucket, clipboard, onSaveTemplate, onAnimate, onOpenStyleSector],
  );
  // Read at render time on purpose (cheap): Paste style enables the moment
  // Copy style fills the clipboard, and the copy re-renders for it.
  const elementActions =
    quickModel === undefined ? [] : resolveElementActions(kernel, elementTargets, actionContext);

  const runElementAction = useCallback(
    (id: ElementActionId) => {
      if (id === 'deselect') {
        hostRef.current?.focus({ preventScroll: true });
      }
      const result = performElementAction(kernel, elementTargetsRef.current, id, actionContext);
      if (id === 'copyStyle') {
        setClipboardNonce((current) => current + 1);
      }
      if (kernel.context.store.getState().elementFocus === null) {
        // The bar unmounts with the element focus; keyboard users land on the canvas.
        hostRef.current?.focus({ preventScroll: true });
      }
      announceGestureRef.current(result.announcement);
    },
    [kernel, actionContext, hostRef, announceGestureRef],
  );

  // Stable chrome callbacks shared by both quick bars (element and part).
  const returnFocusToHost = useCallback(() => {
    hostRef.current?.focus({ preventScroll: true });
  }, [hostRef]);
  const announce = useCallback(
    (message: string) => {
      announceGestureRef.current(message);
    },
    [announceGestureRef],
  );
  const beginTreeMove = useCallback(
    (hostX: number, hostY: number) => {
      const primary = elementTargets[0];
      if (primary === undefined) return;
      machineryRef.current?.beginTreeMove(
        { kind: 'tree-move', id: primary.nodeId, path: primary.path },
        hostX,
        hostY,
      );
    },
    [elementTargets, machineryRef],
  );

  // What the bar does for ITS element: More, Edit with AI, Replace, Move.
  const primary = elementTargets[0];
  const targetProps = useMemo(
    () =>
      primary === undefined
        ? undefined
        : {
            onMore: (sector: StyleSectorId) => {
              onOpenStyleSector?.(sector, primary);
            },
            onEditWithAi:
              onEditWithAi === undefined
                ? undefined
                : () => {
                    onEditWithAi(primary);
                  },
            onReplaceMedia:
              onReplaceMedia === undefined
                ? undefined
                : () => {
                    onReplaceMedia(primary);
                  },
            onMovePointerDown: beginTreeMove,
          },
    [primary, onOpenStyleSector, onEditWithAi, onReplaceMedia, beginTreeMove],
  );

  return {
    returnFocusToHost,
    announce,
    targetProps,
    quickModel,
    elementActions,
    runElementAction,
    colorTokens,
    paletteColors,
  };
}
