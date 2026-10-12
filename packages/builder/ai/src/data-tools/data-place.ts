import type { BuilderKernel } from '@craftkit/builder-core';

import { isRecord, readTree, rootChildren } from '../tools/agent/shared';
import type { AgentToolContext } from '../tools/agent/types';

/**
 * Where the data tools put a block and which registered block they put (2026-10-12), shared by
 * `data.show` and `report.build`: a block is found by the props its schema declares, and a new
 * one goes after `after`, else at the end of the page above its footer.
 */

/** The prop keys a registered block type declares. */
export function propKeys(kernel: BuilderKernel, type: string): readonly string[] {
  const shape = (
    kernel.context.registry.block(type)?.schema.props as unknown as { shape?: unknown } | undefined
  )?.shape;
  return isRecord(shape) ? Object.keys(shape) : [];
}

/** The registered block type `preferred`, else the first one declaring every key. */
export function blockTypeWith(
  kernel: BuilderKernel,
  preferred: string,
  keys: readonly string[],
): string | undefined {
  const declares = (type: string) => {
    const own = propKeys(kernel, type);
    return keys.every((key) => own.includes(key));
  };
  if (kernel.context.registry.block(preferred) !== undefined && declares(preferred))
    return preferred;
  return kernel.context.registry.blocks().find((block) => declares(block.schema.type))?.schema.type;
}

function isFooter(context: AgentToolContext, id: string): boolean {
  const type = context.kernel.getDocument().nodes[id]?.type ?? '';
  if (type !== 'customCode') return /footer/iu.test(type);
  const outer = readTree(context, id)?.children[0];
  return isRecord(outer) && outer['tag'] === 'footer';
}

/** The root index a new block goes at, undefined for the end, or the error for a bad `after`. */
export function placeIndex(
  context: AgentToolContext,
  after: string | undefined,
): number | string | undefined {
  const children = rootChildren(context.kernel);
  if (after !== undefined) {
    const at = children.indexOf(after);
    return at < 0
      ? `"after": no section "${after}" on the page; use one of ${children.slice(0, 12).join(', ')}.`
      : at + 1;
  }
  const footer = children.findIndex((id) => isFooter(context, id));
  return footer >= 0 ? footer : undefined;
}
