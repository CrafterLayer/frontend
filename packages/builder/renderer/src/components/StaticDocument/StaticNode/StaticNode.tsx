import type { ComponentType, ReactNode } from 'react';

import {
  blockPropDefaults,
  withBlockPropDefaults,
  type BlockRenderProps,
  type BlockSlotChildMetadata,
  type BuilderDocument,
  type NodeId,
  type RegisteredBlock,
  type SlotName,
} from '@craftkit/builder-schema';

import { resolveResponsiveProps, type RenderBreakpoint } from '../../../resolve/responsive';
import { resolveSlotChildMetadata } from '../../../resolve/slot-child-metadata';
import { UnknownBlock } from '../../UnknownBlock';

export interface StaticNodeProps {
  document: BuilderDocument;
  id: NodeId;
  blocks: (type: string) => RegisteredBlock | undefined;
  breakpoint: RenderBreakpoint;
}

/**
 * The static renderer's per-node unit: a PURE recursion over (document, blocks,
 * breakpoint) — no kernel, no subscriptions, no effects (FR-006). Same markup
 * shape as the live NodeView, which is what makes live/static parity structural.
 */
export function StaticNode({ document, id, blocks, breakpoint }: StaticNodeProps) {
  const node = document.nodes[id];
  if (node === undefined) {
    return null;
  }

  const entry = blocks(node.type);
  const render = entry?.render;
  if (render === undefined) {
    return <UnknownBlock type={node.type} />;
  }

  const slots: Record<SlotName, ReactNode> = {};
  const slotChildren: Record<SlotName, readonly BlockSlotChildMetadata[]> = {};
  const declaredSlotNames = Object.keys(entry?.schema.slots ?? {});
  const declaredSlots = new Set(declaredSlotNames);
  const slotNames = [
    ...declaredSlotNames,
    ...Object.keys(node.slots ?? {}).filter((slotName) => !declaredSlots.has(slotName)),
  ];
  for (const slotName of slotNames) {
    const childIds = node.slots?.[slotName] ?? [];
    if (entry?.schema.slots?.[slotName]?.exposeChildMetadata === true) {
      slotChildren[slotName] = childIds.flatMap((childId) => {
        const child = document.nodes[childId];
        return child === undefined ? [] : [resolveSlotChildMetadata(child, blocks, breakpoint)];
      });
    }
    slots[slotName] = childIds.map((childId) => (
      <StaticNode
        key={childId}
        document={document}
        id={childId}
        blocks={blocks}
        breakpoint={breakpoint}
      />
    ));
  }

  const Block = render as ComponentType<BlockRenderProps>;
  return (
    <Block
      node={node}
      /*
        Defaults are filled here for the same reason the canvas fills them, and
        with the same call: the published path and the canvas must render a
        document identically, and a repair applied to only one of them would be
        a new way for them to disagree.
      */
      props={withBlockPropDefaults(
        resolveResponsiveProps(node, breakpoint),
        entry === undefined ? {} : blockPropDefaults(entry.schema.props),
      )}
      slots={slots}
      slotChildren={slotChildren}
      data={{}}
      isCanvas={false}
    />
  );
}
