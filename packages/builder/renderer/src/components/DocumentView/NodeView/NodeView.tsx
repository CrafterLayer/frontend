import { memo, useCallback, type ComponentType, type ReactNode } from 'react';

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
   * Inline editing seam (009 contract §7). When the descriptor names THIS node,
   * the named property's value is replaced by the element the editor returns,
   * so the block renders its editing surface exactly where the text lives
   * without knowing anything about editing. Every other node is untouched —
   * which is what keeps "an inline edit re-renders ONE subtree" true.
   */
  inlineEdit?: InlineEditSeam | undefined;
}

export interface InlineEditSeam {
  nodeId: NodeId;
  propKey: string;
  /** Receives the stored value; returns the surface to render in its place. */
  render: (context: { nodeId: NodeId; propKey: string; value: unknown }) => ReactNode;
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
}: NodeViewProps) {
  const node = useKernelNode(kernel, id);
  useRegistryEpoch(kernel);
  const attachRef = useCallback(
    (element: HTMLDivElement | null) => {
      attachNodeElement?.(id, element);
    },
    [attachNodeElement, id],
  );

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
        />
      ));
    }
    // The single un-erasure boundary (see BlockRenderComponent): stored renderers
    // are typed over `never`; here they receive their real resolved props.
    const Block = render as ComponentType<BlockRenderProps>;
    const stored = resolveResponsiveProps(node, breakpoint);
    let resolved = stored;
    if (inlineEdit?.nodeId === id) {
      // THE EDIT BOUNDARY, declared rather than hidden: the prop's VALUE becomes
      // the editing surface, so a block that renders `{props.heading}` renders
      // the editor exactly where the text lives — no block-side code, no second
      // render path, and the swap is scoped to this one node. The stored type
      // says JsonValue; at this one boundary, in edit mode only, it is a React
      // element. (The same trick Puck's field transforms use — see
      // vendor/VENDOR.md — and the reason blocks need no editing awareness.)
      const swapped: Record<string, unknown> = {
        ...stored,
        [inlineEdit.propKey]: inlineEdit.render({
          nodeId: id,
          propKey: inlineEdit.propKey,
          value: stored[inlineEdit.propKey],
        }),
      };
      resolved = swapped as typeof stored;
    }
    content = <Block node={node} props={resolved} slots={slots} data={{}} isCanvas />;
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
