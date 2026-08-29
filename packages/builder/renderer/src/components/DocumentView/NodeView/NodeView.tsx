import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from 'react';

import type { BuilderKernel } from '@craftkit/builder-core';
import type { BlockRenderProps, NodeId, SlotName } from '@craftkit/builder-schema';

import { resolveResponsiveProps, type RenderBreakpoint } from '../../../resolve/responsive';
import { useKernelNode, useRegistryEpoch } from '../../../subscribe';
import { UnknownBlock } from '../../UnknownBlock';

export interface NodeViewProps {
  kernel: BuilderKernel;
  id: NodeId;
  breakpoint: RenderBreakpoint;
  onBlockRender?: ((nodeId: NodeId) => void) | undefined;
  /**
   * Edit-mode geometry attachment (005 contract §2): when present, the block
   * renders inside a `data-bldr-node` wrapper whose callback ref reports
   * (id, element) on mount and (id, null) on unmount. Absent ⇒ output identical
   * to the plain view; the static path never sets it.
   */
  attachNodeElement?: ((id: NodeId, element: HTMLElement | null) => void) | undefined;
  /**
   * Whether this tree is the EDITING canvas.
   *
   * It used to be the literal `true` on the line that renders a block, which
   * made it a lie in the one place it mattered: preview renders through this
   * same view, so a block that showed editing scaffolding behind `isCanvas`
   * showed it to the reader of the finished page as well. Defaults to `true`
   * because every existing caller of this view IS the canvas; preview is the
   * one that has to say otherwise.
   */
  isCanvas?: boolean | undefined;
  /**
   * Inline editing seam (009 contract §7). When the descriptor names THIS node,
   * the named property's value is replaced by the element the editor returns,
   * so the block renders its editing surface exactly where the text lives
   * without knowing anything about editing. Every other node is untouched —
   * which is what keeps "an inline edit re-renders ONE subtree" true.
   */
  inlineEdit?: InlineEditSeam | undefined;
}

export interface InlineEditSeam {
  /** Subscribe only to the descriptor for `nodeId`. */
  subscribe: (nodeId: NodeId, listener: () => void) => () => void;
  /** Stable snapshot identity until that node's descriptor actually changes. */
  getSnapshot: (nodeId: NodeId) => InlineEditTarget | null;
}

export type InlineEditEntryPoint =
  | { key: number; kind: 'pointer'; clientX: number; clientY: number }
  | { key: number; kind: 'keyboard' };

export interface InlineEditTarget {
  propKey: string;
  /** Null while the chosen contributed implementation is still loading. */
  render:
    | ((context: {
        nodeId: NodeId;
        propKey: string;
        value: unknown;
        entryPoint?: InlineEditEntryPoint | undefined;
      }) => ReactNode)
    | null;
  /** Pointer coordinates or keyboard entry, consumed once after the surface mounts. */
  entryPoint?: InlineEditEntryPoint | undefined;
  /** Door rejection shown next to, and described by, the live editing control. */
  rejection?: { id: string; message: string } | undefined;
}

const NO_INLINE_EDIT = null;
const doNothing = () => undefined;

function inlineControlOf(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>(
    '[contenteditable="plaintext-only"], [contenteditable="true"], [role="textbox"]',
  );
}

function nodeBelongsTo(control: HTMLElement, node: Node): boolean {
  return node === control || control.contains(node);
}

/**
 * Place the initial caret after the surface's own mount/focus effects. Pointer
 * entry uses the frame document's native point-to-caret bridge; keyboard entry
 * opens at the logical end. No editor-specific public prop is required.
 */
function applyEntryPoint(control: HTMLElement, entryPoint: InlineEditEntryPoint): boolean {
  const document_ = control.ownerDocument;
  const selection = document_.getSelection();
  if (selection === null) {
    return false;
  }
  control.focus({ preventScroll: true });

  if (entryPoint.kind === 'keyboard') {
    const range = document_.createRange();
    range.selectNodeContents(control);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }

  const caretDocument = document_ as unknown as {
    caretPositionFromPoint?:
      ((x: number, y: number) => { offsetNode: Node; offset: number } | null) | undefined;
    caretRangeFromPoint?: ((x: number, y: number) => Range | null) | undefined;
  };
  const position = caretDocument.caretPositionFromPoint?.(entryPoint.clientX, entryPoint.clientY);
  let range: Range | null = null;
  if (position !== null && position !== undefined && nodeBelongsTo(control, position.offsetNode)) {
    range = document_.createRange();
    range.setStart(position.offsetNode, position.offset);
    range.collapse(true);
  } else {
    const candidate = caretDocument.caretRangeFromPoint?.(entryPoint.clientX, entryPoint.clientY);
    if (
      candidate !== null &&
      candidate !== undefined &&
      nodeBelongsTo(control, candidate.startContainer)
    ) {
      range = candidate;
    }
  }
  if (range === null) {
    return false;
  }
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

function removeDescription(control: HTMLElement, id: string): void {
  const remaining = (control.getAttribute('aria-describedby') ?? '')
    .split(/\s+/)
    .filter((token) => token !== '' && token !== id);
  if (remaining.length === 0) {
    control.removeAttribute('aria-describedby');
  } else {
    control.setAttribute('aria-describedby', remaining.join(' '));
  }
}

/**
 * One document node, live: subscribes to exactly its own node (FR-003) and to the
 * registry epoch (runtime registration/disposal — FR-013). Renders the registered
 * block with resolved props and slot children in document order; unknown types
 * fall back to <UnknownBlock/> without breaking siblings (FR-010).
 */
/**
 * IMPORTANT — self-reference through the MEMOIZED export: inside
 * `memo(function NodeView() {...})` the inner function's own name shadows the
 * exported const, so recursive `<NodeView/>` children would silently use the
 * UN-memoized function and every parent re-render would drag its whole subtree
 * (found when moveNode — the first command that re-renders a parent with
 * mounted children — re-rendered all 1,000 stress nodes). The inner function
 * is therefore named differently and children reference the wrapped const.
 */
function NodeViewInner({
  kernel,
  id,
  breakpoint,
  onBlockRender,
  attachNodeElement,
  inlineEdit,
  isCanvas = true,
}: NodeViewProps) {
  const node = useKernelNode(kernel, id);
  useRegistryEpoch(kernel);
  const elementRef = useRef<HTMLDivElement | null>(null);
  const attachRef = useCallback(
    (element: HTMLDivElement | null) => {
      elementRef.current = element;
      attachNodeElement?.(id, element);
    },
    [attachNodeElement, id],
  );
  const subscribeInlineEdit = useCallback(
    (listener: () => void) => inlineEdit?.subscribe(id, listener) ?? doNothing,
    [id, inlineEdit],
  );
  const readInlineEdit = useCallback(
    () => inlineEdit?.getSnapshot(id) ?? NO_INLINE_EDIT,
    [id, inlineEdit],
  );
  const activeInlineEdit = useSyncExternalStore(
    subscribeInlineEdit,
    readInlineEdit,
    readInlineEdit,
  );
  const appliedEntryKeyRef = useRef<number | null>(null);

  useEffect(() => {
    const root = elementRef.current;
    const entryPoint = activeInlineEdit?.entryPoint;
    if (
      root === null ||
      activeInlineEdit?.render === null ||
      entryPoint === undefined ||
      appliedEntryKeyRef.current === entryPoint.key
    ) {
      return undefined;
    }
    const apply = () => {
      const control = inlineControlOf(root);
      if (control === null || !applyEntryPoint(control, entryPoint)) {
        return false;
      }
      appliedEntryKeyRef.current = entryPoint.key;
      return true;
    };
    if (apply()) {
      return undefined;
    }
    const Observer = root.ownerDocument.defaultView?.MutationObserver;
    /* v8 ignore next 3 -- mounted React DOM in supported browsers always exposes MutationObserver. */
    if (Observer === undefined) {
      return undefined;
    }
    const observer = new Observer(() => {
      if (apply()) {
        observer.disconnect();
      }
    });
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
    };
  }, [activeInlineEdit]);

  useEffect(() => {
    const root = elementRef.current;
    const rejectionId = activeInlineEdit?.rejection?.id;
    if (root === null || rejectionId === undefined) {
      return undefined;
    }
    const wire = () => {
      const control = inlineControlOf(root);
      if (control === null) {
        return false;
      }
      const ids = new Set((control.getAttribute('aria-describedby') ?? '').split(/\s+/));
      ids.delete('');
      ids.add(rejectionId);
      control.setAttribute('aria-describedby', [...ids].join(' '));
      return true;
    };
    let observer: MutationObserver | null = null;
    if (!wire()) {
      const Observer = root.ownerDocument.defaultView?.MutationObserver;
      if (Observer !== undefined) {
        observer = new Observer(() => {
          if (wire()) {
            observer?.disconnect();
            observer = null;
          }
        });
        observer.observe(root, { childList: true, subtree: true });
      }
    }
    return () => {
      observer?.disconnect();
      const control = inlineControlOf(root);
      if (control !== null) {
        removeDescription(control, rejectionId);
      }
    };
  }, [activeInlineEdit?.rejection?.id]);

  if (node === undefined) {
    return null; // removed while a parent list still referenced it mid-update
  }

  // Test/dev instrumentation only (SC-002 counting); no-op in production usage.
  onBlockRender?.(id);

  const entry = kernel.context.registry.block(node.type);
  const render = entry?.render;

  let content: ReactNode;
  if (render === undefined) {
    content = <UnknownBlock type={node.type} />;
  } else {
    const slots: Record<SlotName, ReactNode> = {};
    for (const [slotName, childIds] of Object.entries(node.slots ?? {})) {
      slots[slotName] = childIds.map((childId) => (
        <NodeView
          key={childId}
          kernel={kernel}
          id={childId}
          breakpoint={breakpoint}
          onBlockRender={onBlockRender}
          attachNodeElement={attachNodeElement}
          inlineEdit={inlineEdit}
          isCanvas={isCanvas}
        />
      ));
    }
    // The single un-erasure boundary (see BlockRenderComponent): stored renderers
    // are typed over `never`; here they receive their real resolved props.
    const Block = render as ComponentType<BlockRenderProps>;
    const stored = resolveResponsiveProps(node, breakpoint);
    let resolved = stored;
    if (activeInlineEdit !== null && activeInlineEdit.render !== null) {
      // THE EDIT BOUNDARY, declared rather than hidden: the prop's VALUE becomes
      // the editing surface, so a block that renders `{props.heading}` renders
      // the editor exactly where the text lives — no block-side code, no second
      // render path, and the swap is scoped to this one node. The stored type
      // says JsonValue; at this one boundary, in edit mode only, it is a React
      // element. (The same trick Puck's field transforms use — see
      // vendor/VENDOR.md — and the reason blocks need no editing awareness.)
      const swapped: Record<string, unknown> = {
        ...stored,
        [activeInlineEdit.propKey]:
          activeInlineEdit.rejection === undefined ? (
            activeInlineEdit.render({
              nodeId: id,
              propKey: activeInlineEdit.propKey,
              value: stored[activeInlineEdit.propKey],
              ...(activeInlineEdit.entryPoint === undefined
                ? {}
                : { entryPoint: activeInlineEdit.entryPoint }),
            })
          ) : (
            <>
              {activeInlineEdit.render({
                nodeId: id,
                propKey: activeInlineEdit.propKey,
                value: stored[activeInlineEdit.propKey],
                ...(activeInlineEdit.entryPoint === undefined
                  ? {}
                  : { entryPoint: activeInlineEdit.entryPoint }),
              })}
              <span
                id={activeInlineEdit.rejection.id}
                className="bldr-inline-rejection"
                data-bldr-inline-rejection
              >
                {activeInlineEdit.rejection.message}
              </span>
            </>
          ),
      };
      resolved = swapped as typeof stored;
    }
    content = <Block node={node} props={resolved} slots={slots} data={{}} isCanvas={isCanvas} />;
  }

  if (attachNodeElement === undefined) {
    return content;
  }
  return (
    <div data-bldr-node={id} data-bldr-type={node.type} ref={attachRef}>
      {content}
    </div>
  );
}

export const NodeView = memo(NodeViewInner);
