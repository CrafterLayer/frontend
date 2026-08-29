import type { BuilderKernel } from '@craftkit/builder-core';
import type { NodeId } from '@craftkit/builder-schema';

const BLOCK_TYPE_ACRONYMS: Readonly<Record<string, string>> = {
  cta: 'CTA',
};

/**
 * BlockSchema has no short display field yet. Keep the type fallback isolated
 * here so a future schema name can replace it at the single presentation call.
 */
export function displayNameForBlockType(type: string): string {
  const words = type
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .filter((word) => word.length > 0);

  if (words.length === 0) {
    return type;
  }

  return words
    .map((word) => {
      const normalized = word.toLowerCase();
      return (
        BLOCK_TYPE_ACRONYMS[normalized] ??
        `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`
      );
    })
    .join(' ');
}

export function blockDisplayName(kernel: BuilderKernel, nodeId: NodeId): string {
  const type = kernel.getDocument().nodes[nodeId]?.type;
  if (type === undefined) {
    // A stale node's id is the only stable identity left to show or announce.
    return nodeId;
  }
  if (kernel.context.registry.block(type) === undefined) {
    // Preserve an unknown extension key verbatim; humanising it would imply
    // registry knowledge and make the missing registration harder to diagnose.
    return type;
  }
  return displayNameForBlockType(type);
}
