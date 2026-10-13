import { useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { BuilderKernel } from '@craftkit/builder-core';
import { CanvasFrame, DocumentView, useKernelSelector } from '@craftkit/builder-renderer';

/*
  Stylesheet order (split 2026-10-13). CSS cascades in first-evaluation order, so the modules that
  carry the canvas's stylesheets are imported FIRST and in the single-file canvas's order: the
  chrome (handles, overlay), the quick bar, the action bar, the inline surfaces, the bubble — the
  canvas's own sheet last. The built stylesheet is byte-identical to the pre-split one.
*/
import { useAttachNodeElement, useCanvasMachinery } from './use-canvas-machinery';
import { ELEMENT_QUICK_BAR_LABELS_EN, ElementQuickBar } from '../ElementQuickBar';
import { BlockActionBar } from '../BlockActionBar';
import { useInlineEditBinding } from './use-inline-edit-binding';
import { TextBubble } from '../TextBubble';

import { ELEMENT_NAME_WORDS_EN } from '../../custom-code/element-target';
import type { ElementAction } from '../../overlay/element-actions';
import { TREE_TEXT_ACTION_LABELS_EN } from '../../overlay/tree-text-actions';
import { CanvasAnnouncements } from './CanvasAnnouncements';
import { canvasFrameStyles, normalizeZoom } from './canvas-frame-style';
import { useCanvasZoom } from './canvas-zoom';
import { EDITOR_CANVAS_LABELS_EN } from './EditorCanvas.labels';
import type { EditorCanvasProps, FloatingMounts } from './EditorCanvas.types';
import { bucketForBreakpoint } from './element-canvas-helpers';
// library-playground additions (2026-10-08): the frame's <html lang> follows the page.
import { useFrameLang } from './frame-lang';
// end library-playground additions
import { createMutableInlineEditSeam } from './inline-edit-seam';
import { TreeTextBubble } from './TreeTextBubble';
import { useBlockActions } from './use-block-actions';
import { useGestureAnnouncer, useSelectionNonce } from './use-canvas-announcements';
import { useCanvasKeys } from './use-canvas-keys';
import {
  useCanvasRefs,
  useDirSync,
  useLatestHostCallbacks,
  usePanelInputSync,
} from './use-canvas-refs';
import { useElementQuickBar, useElementSelectionStore } from './use-element-quick-bar';
import { useInlineEditorChrome } from './use-inline-editor-chrome';
import { useInlineSession } from './use-inline-session';
import { useFrameInput, useHostInput } from './use-input-routing';
import { usePartGestures } from './use-part-gestures';
import { usePartQuickBar } from './use-part-quick-bar';
import { useRevealOffscreenSelection, useSelectionInViewOnResize } from './use-selection-in-view';
import { useTextActions } from './use-text-actions';
import { useCommitTreeEditOnFocusMove, useTreeTextEditing } from './use-tree-text-editing';
import '../../styles/visually-hidden.css';
import './EditorCanvas.css';

export type {
  CanvasDragHandle,
  CanvasInlineEditHandle,
  EditorCanvasProps,
} from './EditorCanvas.types';

// gsap-pixi additions (2026-10-08): engines on registered blocks RUN on the canvas (never taking
// pointer input); one stable object, so the frame never re-mounts them on a re-render.
const CANVAS_SITE_ENGINES = { interactive: false } as const;
// end gsap-pixi additions

// ── block-parts (2026-10-06) ──
/** A part's bar has no element actions; its own row comes from `resolvePartActions`. */
const NO_ELEMENT_ACTIONS: readonly ElementAction[] = [];
const ignoreElementAction = (): void => undefined;
// ── /block-parts ──

type CanvasState = ReturnType<BuilderKernel['context']['store']['getState']>;
const selectDir = (state: CanvasState) => state.doc.dir;
const selectSelected = (state: CanvasState) => state.selection[0] ?? null;
const selectDoc = (state: CanvasState) => state.doc;
const selectElementFocus = (state: CanvasState) => state.elementFocus;
const selectPartFocus = (state: CanvasState) => state.partFocus ?? null;

/**
 * The editor canvas (005 contract §3): B1 preview + observer-driven geometry
 * + hover/selection chrome + keyboard traversal + canvas tools, B2b drag
 * editing, B3c inline editing, P7 element chrome and block-parts. React
 * renders this scaffold; every per-event path runs in the plain-TS machinery
 * (`use-canvas-machinery.ts`) with zero document-content re-renders. This file
 * is the composition root: each behaviour lives in its own hook module.
 */
export function EditorCanvas({
  kernel,
  theme,
  title = 'Editor canvas',
  onToolError,
  geometryPorts,
  floatingPorts,
  onBlockRender,
  editable = false,
  onDragHandle,
  onInlineEditHandle,
  frameWidth,
  zoom = 1,
  breakpoint,
  elementSelection,
  styleBucket,
  styleState = 'default',
  activeSector = null,
  onOpenStyleSector,
  onEditWithAi,
  onSaveTemplate,
  onAnimate,
  onAnimateBlock, // gsap-pixi additions (2026-10-08)
  onReplaceMedia,
  onShortcut,
  styleClipboard,
  palette,
  namedStyles,
  namedStyleClasses,
  quickBarLabels = ELEMENT_QUICK_BAR_LABELS_EN,
  treeTextLabels = TREE_TEXT_ACTION_LABELS_EN,
  richTextLabels,
  elementNameWords = ELEMENT_NAME_WORDS_EN,
  editorDir = 'ltr',
  canvasLabels = EDITOR_CANVAS_LABELS_EN,
  treeDropPorts,
  symbolTree,
  // ── block-parts (2026-10-06) ──
  onReplacePartImage,
  onOpenPartStyle,
  onEditWithAiPart,
  linkPages,
  // ── /block-parts ──
}: EditorCanvasProps) {
  const { gestureMessage, announceGesture, announceGestureRef } = useGestureAnnouncer();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const frameShellRef = useRef<HTMLDivElement | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);
  const normalizedZoom = normalizeZoom(zoom);
  // ── P7 element chrome state (style-manager DESIGN.md §A.6, §A.7, §E) ──────
  // The panel's bucket/state/sector reach the plain-TS machinery through refs.
  const bucket = styleBucket ?? bucketForBreakpoint(breakpoint);
  const refs = useCanvasRefs({
    canvasLabels,
    elementNameWords,
    zoom: normalizedZoom,
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
  });
  const [frame, setFrame] = useState<HTMLIFrameElement | null>(null);

  const dir = useKernelSelector(kernel, selectDir);
  // library-playground additions (2026-10-08): root `lang` prop, else ar for rtl / en for ltr.
  useFrameLang(kernel, frame);
  // end library-playground additions
  const selectedId = useKernelSelector(kernel, selectSelected);
  const inlineRejectionId = `${useId()}-inline-rejection`;
  const inlineEditSeam = useMemo(() => createMutableInlineEditSeam(), []);

  // Floating chrome (009 §10). These pieces of state change on BOUNDARIES
  // only — mount, gesture start/end, selection — never per pointer move and
  // never per scroll frame, which is what keeps the toolbars off React's hot
  // path while still letting React own their content.
  const [floating, setFloating] = useState<FloatingMounts | null>(null);
  const [dragState, setDragState] = useState({ active: false, revision: 0 });
  const dragging = dragState.active;
  const text = useTextActions(refs, floating);
  const [quickFocusRequest, setQuickFocusRequest] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);

  const inline = useInlineSession({
    kernel,
    editable,
    frame,
    onInlineEditHandle,
    refs,
    setTextActions: text.setTextActions,
  });
  const { inlineSession, beginInlineEdit, handleInlineKey } = inline;
  const selectionNonce = useSelectionNonce(kernel);
  useLatestHostCallbacks(refs, { onDragHandle, onToolError, onReplacePartImage });

  const tree = useTreeTextEditing({ kernel, editable, treeTextLabels, announceGesture, refs });
  const { treeSession, beginTreeTextEditing } = tree;
  const { handleElementKey, handleTraversalKey } = useCanvasKeys({
    kernel,
    editable,
    dir,
    beginTreeTextEditing,
    refs,
    setQuickFocusRequest,
  });

  const attachNodeElement = useAttachNodeElement(refs);
  useCanvasMachinery({
    kernel,
    frame,
    editable,
    geometryPorts,
    floatingPorts,
    onToolError,
    treeDropPorts,
    refs,
    setFloating,
    setDragState,
    setScrubbing,
  });
  useDirSync(refs, dir);
  // Zoom reaches the chrome that must keep its own size (floating hosts, layer CSS).
  useCanvasZoom(normalizedZoom, refs.zoomRef, layerRef, refs.machineryRef, frame);
  useSelectionInViewOnResize({ kernel, frame, frameWidth, breakpoint, refs });

  // ── P7 element chrome wiring ──────────────────────────────────────────────
  const selectionStore = useElementSelectionStore(kernel, elementSelection);
  usePanelInputSync(refs, { bucket, styleState, activeSector, onShortcut, selectionStore });
  useCommitTreeEditOnFocusMove(kernel, refs);

  const editorChrome = useInlineEditorChrome({
    kernel,
    inlineSession,
    textActions: text.textActions,
    richTextLabels,
    locale: canvasLabels.locale,
    refs,
  });
  const { richLabels, visibleTextActions } = editorChrome;

  // ── block-parts (2026-10-06) ──
  const { activatePart, handlePartKey } = usePartGestures({
    kernel,
    editable,
    quickBarLabels,
    beginInlineEdit,
    refs,
    setQuickFocusRequest,
  });
  // ── /block-parts ──

  const keys = { handleElementKey, handlePartKey, handleInlineKey, handleTraversalKey };
  useFrameInput({
    ...keys,
    kernel,
    frame,
    beginInlineEdit,
    beginTreeTextEditing,
    activatePart,
    refs,
  });
  const { onKeyDown, onHostClick } = useHostInput({ ...keys, kernel, refs });

  useInlineEditBinding({
    kernel,
    seam: inlineEditSeam,
    inlineSession,
    inlineEntryPoint: inline.inlineEntryPoint,
    inlineRejection: inline.inlineRejection,
    inlineRejectionId,
    setInlineRejection: inline.setInlineRejection,
    contributedEditor: editorChrome.contributedEditor,
    contributedEditorPending: editorChrome.contributedEditorPending,
    floating,
    locale: canvasLabels.locale,
    reportTextAnchor: inline.reportTextAnchor,
    reportTextActions: text.reportTextActions,
    requestFormattingMenuFocus: text.requestFormattingMenuFocus,
    endInlineEditFromSurfaceKeyboard: inline.endInlineEditFromSurfaceKeyboard,
    refs,
  });

  // The document itself, so the action bar's gates track edits: a node that
  // just became last must show "Move later" disabled without another click.
  const doc = useKernelSelector(kernel, selectDoc);
  const elementFocus = useKernelSelector(kernel, selectElementFocus);
  const partFocus = useKernelSelector(kernel, selectPartFocus); // block-parts (2026-10-06)
  useRevealOffscreenSelection({ frame, selectedId, elementFocus, refs });

  const block = useBlockActions({
    kernel,
    doc,
    selectedId,
    elementFocus,
    partFocus,
    canvasLabels,
    elementNameWords,
    onAnimateBlock,
    beginInlineEdit,
    refs,
  });
  const { selectedName, blockActions } = block;

  // ── P7: the element quick bar ─────────────────────────────────────────────
  const quick = useElementQuickBar({
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
  });
  const { quickModel } = quick;

  // ── block-parts (2026-10-06) ──
  const part = usePartQuickBar({
    kernel,
    doc,
    dir,
    editable,
    selectedId,
    partFocus,
    bucket,
    styleState,
    locale: canvasLabels.locale,
    quickBarLabels,
    elementNameWords,
    namedStyleClasses,
    linkPages,
    onOpenPartStyle,
    onEditWithAiPart,
    onReplacePartImage,
    activatePart,
    refs,
  });
  const { partModel } = part;
  // ── /block-parts ──

  const frameStyles = canvasFrameStyles(frameWidth, normalizedZoom);
  // Chrome over a selection that is not busy being something else: never while
  // a drag is in flight (US3/AC4), never over an open inline editor.
  const barsAllowed = floating !== null && editable && !dragging && inlineSession === null;
  const quickBarsAllowed = barsAllowed && !scrubbing && treeSession === null;
  // Shared by both quick bars (element and part).
  const quickBarShared = {
    onReturnFocus: quick.returnFocusToHost,
    onAnnounce: quick.announce,
    dir: editorDir,
    colorTokens: quick.colorTokens,
    palette: quick.paletteColors,
    namedStyles,
    focusRequest: quickFocusRequest,
    labels: quickBarLabels,
  };

  return (
    <div
      ref={hostRef}
      className="bldr-canvas-host"
      role="region"
      aria-label={title}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onClick={onHostClick}
    >
      <div
        className="bldr-canvas-viewport"
        data-testid="bldr-canvas-viewport"
        style={frameStyles.viewport}
      >
        <div ref={frameShellRef} className="bldr-canvas-frame-shell" style={frameStyles.frameShell}>
          <CanvasFrame
            theme={theme}
            dir={dir}
            title={title}
            onFrame={setFrame}
            siteEngines={CANVAS_SITE_ENGINES} /* gsap-pixi additions (2026-10-08) */
          >
            <DocumentView
              kernel={kernel}
              breakpoint={breakpoint ?? 'desktop'}
              attachNodeElement={attachNodeElement}
              onBlockRender={onBlockRender}
              inlineEdit={inlineEditSeam}
            />
          </CanvasFrame>
          <div ref={layerRef} className="bldr-overlay" data-testid="bldr-overlay" />
          {/* Floating chrome: React owns the CONTENT, the hosts own the geometry.
            The bubble exists only while an editor reports actions for a live
            selection, so a plain-text surface never shows one (US2/AC5). */}
          {floating !== null && visibleTextActions.length > 0
            ? createPortal(
                <TextBubble
                  dir={dir}
                  label={richLabels.formatting}
                  actions={visibleTextActions}
                  onReturnFocus={text.returnFocusToEditor}
                />,
                floating.text,
              )
            : null}
          {/* P7: the tree text bubble — formatting a selected range of an
            element being edited in place, or the link address prompt. */}
          {floating !== null &&
          treeSession !== null &&
          (tree.treeHasRange || tree.linkRange !== null)
            ? createPortal(
                <TreeTextBubble
                  dir={dir}
                  labels={treeTextLabels}
                  actions={tree.treeActions}
                  session={treeSession}
                  linkRange={tree.linkRange}
                  onCloseLink={() => {
                    tree.setLinkRange(null);
                  }}
                  onAnnounce={quick.announce}
                />,
                floating.text,
              )
            : null}
          {/* P7: with an element focused, its quick bar REPLACES the block
            action bar — every control and action there is the element's. */}
          {quickBarsAllowed && quickModel !== undefined && quick.targetProps !== undefined
            ? createPortal(
                <ElementQuickBar
                  {...quickBarShared}
                  {...quick.targetProps}
                  model={quickModel}
                  actions={quick.elementActions}
                  onAction={quick.runElementAction}
                />,
                floating.element,
              )
            : null}
          {/* ── block-parts (2026-10-06) ── with a PART focused, its quick bar
            REPLACES the block action bar, as an element focus does. It is
            never shown over an open inline editor. */}
          {quickBarsAllowed &&
          quickModel === undefined &&
          partModel !== undefined &&
          part.barProps !== undefined
            ? createPortal(
                <ElementQuickBar
                  {...quickBarShared}
                  {...part.barProps}
                  model={partModel}
                  actions={NO_ELEMENT_ACTIONS}
                  onAction={ignoreElementAction}
                />,
                floating.element,
              )
            : null}
          {/* The action bar belongs to a SELECTED block that is not busy being
            something else: not while a drag is in flight (US3/AC4), and not
            while its own text is open for editing — the bubble owns that
            moment, and two toolbars over one block is noise, not power. */}
          {barsAllowed &&
          quickModel === undefined &&
          partModel === undefined && // block-parts (2026-10-06)
          selectedName !== null &&
          blockActions.length > 0
            ? createPortal(
                <BlockActionBar
                  label={canvasLabels.actionsFor(selectedName)}
                  actions={blockActions}
                  onMovePointerDown={block.beginMoveFromHandle}
                  onAction={block.runBlockAction}
                  dir={dir}
                />,
                floating.block,
              )
            : null}
        </div>
      </div>
      <CanvasAnnouncements
        selection={{ text: block.announcement, nonce: selectionNonce }}
        gesture={gestureMessage}
        selectionLabel={canvasLabels.selectionRegion}
        gestureLabel={canvasLabels.gestureRegion}
      />
    </div>
  );
}
