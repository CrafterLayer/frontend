import { useEffect, useMemo, useRef, type RefObject } from 'react';

import type { NodeId, StyleBucket, StyleSectorId, StyleState } from '@craftkit/builder-schema';

import type { ElementNameWords } from '../../custom-code/element-target';
import type { AnchorChannel } from '../../overlay/anchor-channel';
import type { InlineSessionHandle } from '../../overlay/inline-session';
import type { PartTarget } from '../../overlay/part-target';
import type { TreeTextSession } from '../../overlay/tree-text-session';
import type { ElementSelection } from '../../selection/element-selection';
import type { EditorCanvasLabels } from './EditorCanvas.labels';
import type { CanvasDragHandle, Machinery } from './EditorCanvas.types';

/**
 * Every mutable cell the canvas shares between React and its plain-TS
 * machinery, in ONE stable bag. Refs carry the CURRENT props, panel state and
 * open sessions into listeners that must never re-subscribe per render; the
 * bag's identity never changes, so passing it costs no hook a dependency.
 */
export interface CanvasRefs {
  hostRef: RefObject<HTMLDivElement | null>;
  frameShellRef: RefObject<HTMLDivElement | null>;
  layerRef: RefObject<HTMLDivElement | null>;
  machineryRef: RefObject<Machinery | null>;
  /**
   * Wrappers can mount before the frame-ready effect builds the index; the
   * buffer preserves them and the effect replays it (first-frame safety).
   */
  elementsRef: RefObject<Map<NodeId, HTMLElement>>;
  zoomRef: RefObject<number>;
  /** The snapshot handler reads the CURRENT direction without re-subscribing. */
  dirRef: RefObject<'ltr' | 'rtl'>;
  /** Read by imperative chrome (chips, gesture announcements) without re-creating it. */
  canvasLabelsRef: RefObject<EditorCanvasLabels>;
  wordsRef: RefObject<ElementNameWords>;
  bucketRef: RefObject<StyleBucket>;
  styleStateRef: RefObject<StyleState>;
  activeSectorRef: RefObject<StyleSectorId | null>;
  selectionStoreRef: RefObject<ElementSelection | null>;
  onShortcutRef: RefObject<((event: KeyboardEvent) => boolean) | undefined>;
  onDragHandleRef: RefObject<((handle: CanvasDragHandle) => void) | undefined>;
  onToolErrorRef: RefObject<((toolId: string, error: unknown) => void) | undefined>;
  onReplacePartImageRef: RefObject<((target: PartTarget) => void) | undefined>;
  announceGestureRef: RefObject<(message: string) => void>;
  /** The open inline-session handle (editable canvases only). */
  sessionRef: RefObject<InlineSessionHandle | null>;
  /** The open in-place tree text edit. */
  treeSessionRef: RefObject<TreeTextSession | null>;
  /** The live text-selection measurement the anchor channel reads. */
  textMeasureRef: RefObject<Parameters<AnchorChannel['setText']>[0]>;
  /** Where the formatting bubble sends focus back to the editor. */
  returnFocusToEditorRef: RefObject<(() => void) | null>;
  /** An editing surface already handled this Escape (cleared on the next microtask). */
  surfaceEscapeHandledRef: RefObject<boolean>;
  /** A completed drop already set the selection: swallow the click that follows. */
  suppressClickRef: RefObject<boolean>;
  /** The part quick bar's scope switch, read by the part keys. */
  partScopeRef: RefObject<'all' | 'this'>;
}

export interface CanvasRefInputs {
  canvasLabels: EditorCanvasLabels;
  elementNameWords: ElementNameWords;
  zoom: number;
  bucket: StyleBucket;
  styleState: StyleState;
  activeSector: StyleSectorId | null;
  elementSelection: ElementSelection | undefined;
  onShortcut: ((event: KeyboardEvent) => boolean) | undefined;
  onDragHandle: ((handle: CanvasDragHandle) => void) | undefined;
  onToolError: ((toolId: string, error: unknown) => void) | undefined;
  onReplacePartImage: ((target: PartTarget) => void) | undefined;
  announceGestureRef: RefObject<(message: string) => void>;
  /** The DOM refs the canvas renders (created where they are attached). */
  hostRef: RefObject<HTMLDivElement | null>;
  frameShellRef: RefObject<HTMLDivElement | null>;
  layerRef: RefObject<HTMLDivElement | null>;
}

/** Creates the canvas's ref bag; the labels and element words are kept current here. */
export function useCanvasRefs({
  canvasLabels,
  elementNameWords,
  zoom,
  bucket,
  styleState,
  activeSector,
  elementSelection,
  onShortcut,
  onDragHandle,
  onToolError,
  onReplacePartImage,
  announceGestureRef,
  hostRef,
  frameShellRef,
  layerRef,
}: CanvasRefInputs): CanvasRefs {
  const canvasLabelsRef = useRef(canvasLabels);
  const wordsRef = useRef(elementNameWords);
  useEffect(() => {
    canvasLabelsRef.current = canvasLabels;
    wordsRef.current = elementNameWords;
  }, [canvasLabels, elementNameWords]);
  const machineryRef = useRef<Machinery | null>(null);
  const elementsRef = useRef(new Map<NodeId, HTMLElement>());
  const zoomRef = useRef(zoom);
  const dirRef = useRef<'ltr' | 'rtl'>('ltr');
  const bucketRef = useRef<StyleBucket>(bucket);
  const styleStateRef = useRef<StyleState>(styleState);
  const activeSectorRef = useRef<StyleSectorId | null>(activeSector);
  const selectionStoreRef = useRef<ElementSelection | null>(elementSelection ?? null);
  const onShortcutRef = useRef(onShortcut);
  const onDragHandleRef = useRef(onDragHandle);
  const onToolErrorRef = useRef(onToolError);
  const onReplacePartImageRef = useRef(onReplacePartImage);
  const sessionRef = useRef<InlineSessionHandle | null>(null);
  const treeSessionRef = useRef<TreeTextSession | null>(null);
  const textMeasureRef = useRef<Parameters<AnchorChannel['setText']>[0]>(null);
  const returnFocusToEditorRef = useRef<(() => void) | null>(null);
  const surfaceEscapeHandledRef = useRef(false);
  const suppressClickRef = useRef(false);
  const partScopeRef = useRef<'all' | 'this'>('all');
  return useMemo(
    () => ({
      hostRef,
      frameShellRef,
      layerRef,
      machineryRef,
      elementsRef,
      zoomRef,
      dirRef,
      canvasLabelsRef,
      wordsRef,
      bucketRef,
      styleStateRef,
      activeSectorRef,
      selectionStoreRef,
      onShortcutRef,
      onDragHandleRef,
      onToolErrorRef,
      onReplacePartImageRef,
      announceGestureRef,
      sessionRef,
      treeSessionRef,
      textMeasureRef,
      returnFocusToEditorRef,
      surfaceEscapeHandledRef,
      suppressClickRef,
      partScopeRef,
    }),
    [announceGestureRef, hostRef, frameShellRef, layerRef],
  );
}

/**
 * The host callbacks the frame listeners read, kept current every render
 * (synced BEFORE the machinery effect reads `onDragHandle` on a frame mount).
 */
export function useLatestHostCallbacks(
  refs: CanvasRefs,
  callbacks: Pick<CanvasRefInputs, 'onDragHandle' | 'onToolError' | 'onReplacePartImage'>,
): void {
  const { onDragHandleRef, onToolErrorRef, onReplacePartImageRef } = refs;
  const { onDragHandle, onToolError, onReplacePartImage } = callbacks;
  useEffect(() => {
    onDragHandleRef.current = onDragHandle;
    onToolErrorRef.current = onToolError;
    // ── block-parts (2026-10-06) ──
    onReplacePartImageRef.current = onReplacePartImage;
    // ── /block-parts ──
  });
}

/**
 * A direction flip changes where every toolbar sits without moving a single
 * rect, so the channel is told explicitly — the rect index has nothing to
 * invalidate here (RTL is placement, not geometry).
 */
export function useDirSync(refs: CanvasRefs, dir: 'ltr' | 'rtl'): void {
  const { dirRef, machineryRef } = refs;
  useEffect(() => {
    dirRef.current = dir;
    machineryRef.current?.anchors.refresh();
  }, [dir, dirRef, machineryRef]);
}

/**
 * The panel's bucket/state/sector reach the plain-TS chrome through refs; a
 * change asks for one fresh flush (the forced-state stamp, the grid). The
 * shortcut sink and the selection store are kept current every render.
 */
export function usePanelInputSync(
  refs: CanvasRefs,
  inputs: Pick<CanvasRefInputs, 'bucket' | 'styleState' | 'activeSector' | 'onShortcut'> & {
    selectionStore: ElementSelection | null;
  },
): void {
  const { bucketRef, styleStateRef, activeSectorRef, machineryRef } = refs;
  const { onShortcutRef, selectionStoreRef } = refs;
  const { bucket, styleState, activeSector, onShortcut, selectionStore } = inputs;
  useEffect(() => {
    bucketRef.current = bucket;
    styleStateRef.current = styleState;
    activeSectorRef.current = activeSector;
    machineryRef.current?.anchors.refresh();
  }, [bucket, styleState, activeSector, bucketRef, styleStateRef, activeSectorRef, machineryRef]);
  useEffect(() => {
    onShortcutRef.current = onShortcut;
    selectionStoreRef.current = selectionStore;
  });
}
