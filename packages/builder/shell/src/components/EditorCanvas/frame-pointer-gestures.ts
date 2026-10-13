import type { BuilderKernel } from '@craftkit/builder-core';
import type { StyleBucket, StyleState } from '@craftkit/builder-schema';

import type { DragSession } from '../../overlay/drag-session';
import type { OverlayController } from '../../overlay/overlay-controller';
import {
  computeSnap,
  isFreelyPositioned,
  measuredInsets,
  moveTreeElementBy,
  type GuideChrome,
} from '../../overlay/snap-guides';
import type { ToolHost } from '../../overlay/tool-host';
import type { TreeTextSession } from '../../overlay/tree-text-session';
import type { GeometryPorts, RectIndex } from '../../rects';
import type { ElementSelection } from '../../selection/element-selection';
import { cancelCanvasActivation } from './canvas-activation-guard';
import { isDomNode } from './canvas-targets';
import { elementDomOf, focusedTreeTarget, unlockedPath } from './element-canvas-helpers';

interface Ref<T> {
  current: T;
}

export interface FramePointerInputs {
  kernel: BuilderKernel;
  index: RectIndex;
  ports: GeometryPorts;
  controller: OverlayController;
  tools: ToolHost;
  /** The drag session (editable canvases only). */
  session: DragSession | null;
  frameDocument: Document;
  positionGuides: GuideChrome;
  editable: boolean;
  treeSessionRef: Ref<TreeTextSession | null>;
  bucketRef: Ref<StyleBucket>;
  styleStateRef: Ref<StyleState>;
  dirRef: Ref<'ltr' | 'rtl'>;
  suppressClickRef: Ref<boolean>;
  announceGestureRef: Ref<(message: string) => void>;
  selectionStoreRef: Ref<ElementSelection | null>;
  hostRef: Ref<HTMLElement | null>;
}

/*
  P7: dragging a positioned (absolute/fixed) element. The preview is a
  canvas-DOM translate only; snapping (6px) to the parent's and siblings'
  edges and centres draws guide lines; release writes `inset-*` through
  the engine as ONE transaction.
*/
interface PositionDrag {
  target: NonNullable<ReturnType<typeof focusedTreeTarget>>;
  element: HTMLElement;
  startX: number;
  startY: number;
  rect: { x: number; y: number; width: number; height: number };
  others: { x: number; y: number; width: number; height: number }[];
  previousTranslate: string;
  measured: ReturnType<typeof measuredInsets>;
  dx: number;
  dy: number;
  moved: boolean;
}

export interface FramePointerGestures {
  /** Removes every frame-document listener this attached. */
  detach: () => void;
  /** Ends a positioned-element drag; `commit` writes it as one transaction. */
  endPositionDrag: (commit: boolean) => void;
}

/**
 * The frame document's pointer listeners: hover chrome, click-to-select (and
 * shift-click multi-selection), the drag session's frame-side moves, and the
 * P7 positioned-element drag with snapping guides. Plain TS, attached once
 * per frame mount — zero React renders per pointer move.
 */
export function attachFramePointerGestures({
  kernel,
  index,
  ports,
  controller,
  tools,
  session,
  frameDocument,
  positionGuides,
  editable,
  treeSessionRef,
  bucketRef,
  styleStateRef,
  dirRef,
  suppressClickRef,
  announceGestureRef,
  selectionStoreRef,
  hostRef,
}: FramePointerInputs): FramePointerGestures {
  // What is under the pointer: the node, and — inside a composed region —
  // the authored element (the portrait, the headline, the button). The
  // element is chrome and Inspector truth; canvas TOOLS keep working at
  // node granularity, which is the contract they were written against.
  const hitAt = (clientX: number, clientY: number) => {
    if (index.hitAt !== undefined) {
      return index.hitAt(clientX, clientY);
    }
    const nodeId = index.nodeAt(clientX, clientY);
    return nodeId === undefined ? undefined : { nodeId };
  };
  let positionDrag: PositionDrag | null = null;
  const endPositionDrag = (commit: boolean) => {
    const drag = positionDrag;
    if (drag === null) return;
    positionDrag = null;
    drag.element.style.translate = drag.previousTranslate;
    positionGuides.hide();
    if (!commit || !drag.moved) return;
    suppressClickRef.current = true;
    const result = moveTreeElementBy(
      kernel,
      drag.target,
      { dx: Math.round(drag.dx), dy: Math.round(drag.dy) },
      {
        bucket: bucketRef.current,
        state: styleStateRef.current,
        dir: dirRef.current,
        measured: drag.measured,
      },
    );
    announceGestureRef.current(result.announcement);
  };
  const onPointerDown = (event: PointerEvent) => {
    if (!editable || event.button !== 0 || event.shiftKey || treeSessionRef.current !== null) {
      return;
    }
    const target = focusedTreeTarget(kernel);
    const element = target === undefined ? null : elementDomOf(index, target.nodeId, target.path);
    if (
      target === undefined ||
      element === null ||
      !isDomNode(event.target) ||
      !element.contains(event.target) ||
      !isFreelyPositioned(element)
    ) {
      return;
    }
    const parent = element.parentElement;
    const siblings =
      parent === null
        ? []
        : Array.from(parent.children).filter(
            (child): child is HTMLElement =>
              child !== element && child.hasAttribute('data-ck-path'),
          );
    positionDrag = {
      target,
      element,
      startX: event.clientX,
      startY: event.clientY,
      rect: ports.measure(element),
      others: [
        ...(parent === null ? [] : [ports.measure(parent)]),
        ...siblings.map((sibling) => ports.measure(sibling)),
      ],
      previousTranslate: element.style.translate,
      measured: measuredInsets(element, dirRef.current),
      dx: 0,
      dy: 0,
      moved: false,
    };
    // No text selection while an element is being dragged.
    event.preventDefault();
  };
  const onPointerMove = (event: MouseEvent) => {
    if (positionDrag !== null) {
      const drag = positionDrag;
      const rawX = event.clientX - drag.startX;
      const rawY = event.clientY - drag.startY;
      if (!drag.moved && Math.hypot(rawX, rawY) < 3) return;
      drag.moved = true;
      const snap = computeSnap(
        {
          x: drag.rect.x + rawX,
          y: drag.rect.y + rawY,
          width: drag.rect.width,
          height: drag.rect.height,
        },
        drag.others,
      );
      drag.dx = rawX + snap.dx;
      drag.dy = rawY + snap.dy;
      drag.element.style.translate = `${String(drag.dx)}px ${String(drag.dy)}px`;
      positionGuides.show(snap.guides);
      return;
    }
    if (session !== null && session.phase() !== 'idle') {
      session.move(event.clientX, event.clientY);
      return; // hover chrome is suppressed for the session's duration
    }
    const hit = hitAt(event.clientX, event.clientY);
    // Locked elements pass the pointer to their parent (DESIGN §E Layers lock).
    const hoverPath =
      hit?.elementPath === undefined
        ? undefined
        : unlockedPath(kernel, hit.nodeId, hit.elementPath);
    // ── block-parts (2026-10-06) ── outside authored elements, the part under the pointer
    controller.setHover(
      hit?.nodeId ?? null,
      hoverPath,
      hoverPath === undefined ? hit?.part : undefined,
    );
    // ── /block-parts ──
    tools.notifyHover(hit?.nodeId ?? null);
  };
  const onPointerUp = () => {
    if (positionDrag !== null) {
      endPositionDrag(true);
      return;
    }
    if (session !== null && session.phase() === 'active') {
      // The suppress flag exists for gestures that CAN be followed by a
      // same-document click: a frame pointerup concluding a frame-originated
      // MOVE drag. An insert drag began in the HOST document, so no frame
      // click ever follows — setting the flag there would go stale and
      // swallow the next legitimate canvas click (§9 convergence fix).
      if (session.payloadKind() === 'move') {
        suppressClickRef.current = true;
      }
      session.release();
    } else if (session !== null) {
      session.release(); // pending → plain click path
    }
  };
  const onPointerLeave = () => {
    endPositionDrag(false);
    controller.setHover(null);
    tools.notifyHover(null);
  };
  const onClick = (event: MouseEvent) => {
    // ── block-parts (2026-10-06) ── a link or submit in a block selects, never navigates
    cancelCanvasActivation(event);
    // ── /block-parts ──
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return; // a completed drop already set the selection
    }
    // A click inside text being edited in place places the caret: it is the
    // editor's, and pulling focus to the host would end the edit.
    const editing = treeSessionRef.current;
    if (editing !== null && isDomNode(event.target) && editing.element.contains(event.target)) {
      return;
    }
    const hit = hitAt(event.clientX, event.clientY);
    // Locked elements pass clicks to their parent; all-locked lands on the region.
    const path =
      hit?.elementPath === undefined
        ? undefined
        : unlockedPath(kernel, hit.nodeId, hit.elementPath);
    if (hit === undefined) {
      kernel.setSelection([]);
      // ── block-parts (2026-10-06) ──
    } else if (path === undefined && hit.part !== undefined && !event.shiftKey) {
      // A registered block's part, the GrapesJS way: the click means the
      // heading (or the third card's title), and it selects its block too.
      kernel.focusPart(hit.nodeId, { part: hit.part.part, index: hit.part.index });
      // ── /block-parts ──
    } else if (path === undefined) {
      kernel.setSelection([hit.nodeId]);
    } else if (event.shiftKey && selectionStoreRef.current !== null) {
      // Shift-click adds the element to the multi-selection (or removes it).
      selectionStoreRef.current.toggle({ kind: 'tree', nodeId: hit.nodeId, path });
    } else {
      // Straight to the element: a person who clicks the portrait in a
      // generated header means the portrait. Escape steps back out.
      kernel.focusElement(hit.nodeId, path);
    }
    // Clicking inside the frame moves focus to the iframe's browsing context,
    // which would silently strand keyboard traversal on the host region
    // ("click to select, then arrow keys" is the documented flow). Pull focus
    // back deliberately — nothing inside the canvas wants it.
    hostRef.current?.focus({ preventScroll: true });
  };
  frameDocument.addEventListener('pointerdown', onPointerDown);
  frameDocument.addEventListener('pointermove', onPointerMove, { passive: true });
  frameDocument.addEventListener('pointerup', onPointerUp);
  frameDocument.addEventListener('pointerleave', onPointerLeave);
  frameDocument.addEventListener('click', onClick);
  return {
    detach: () => {
      frameDocument.removeEventListener('pointerdown', onPointerDown);
      frameDocument.removeEventListener('pointermove', onPointerMove);
      frameDocument.removeEventListener('pointerup', onPointerUp);
      frameDocument.removeEventListener('pointerleave', onPointerLeave);
      frameDocument.removeEventListener('click', onClick);
    },
    endPositionDrag,
  };
}
