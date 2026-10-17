import {
  blockPropDefaults,
  withBlockPropDefaults,
  type BlockSlotChildMetadata,
  type Node,
  type RegisteredBlock,
} from '@craftkit/builder-schema';

import { resolveResponsiveProps, type RenderBreakpoint } from './responsive';

/**
 * Resolve the public metadata view of one direct slot child.
 *
 * Live and static rendering deliberately share this function so a parent never
 * derives different controls from the same document depending on render path.
 * Unknown blocks still expose their stored identity and responsive props; a
 * registered schema additionally contributes its declared defaults.
 */
export function resolveSlotChildMetadata(
  node: Node,
  blocks: (type: string) => RegisteredBlock | undefined,
  breakpoint: RenderBreakpoint,
): BlockSlotChildMetadata {
  const entry = blocks(node.type);
  return {
    id: node.id,
    type: node.type,
    props: withBlockPropDefaults(
      resolveResponsiveProps(node, breakpoint),
      entry === undefined ? {} : blockPropDefaults(entry.schema.props),
    ),
  };
}
