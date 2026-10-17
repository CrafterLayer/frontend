import type { BuilderKernel, NodeId } from '@craftkit/builder';

/**
 * A block's human name, as the layers panel shows it (SPEC §4.17 ContextChip, §3.2
 * MentionMenu, §4.9 "Editing {target}"): its instance label when it carries one, else its
 * type's display name.
 *
 * The shell owns this rule (`shell/src/naming/block-display-name.ts`) but does not export
 * it on the `@craftkit/builder` facade, and the feature may import only the facade (SPEC
 * §7.1). So the rule is restated here, word for word, until the facade exports it: a
 * label the schema permits at 80 characters is clipped to 32 like a layers row, a type
 * is Title Cased with CTA kept, and an unknown extension type is shown verbatim.
 */

const ACRONYMS: Readonly<Record<string, string>> = { cta: 'CTA' };

/** Longest instance label shown before it is elided, as in the layers panel. */
const MAX_INSTANCE_LABEL = 32;

/** A block type as a person reads it: `pricingTable` → "Pricing Table", `cta` → "CTA". */
export function blockTypeName(type: string): string {
  const words = type
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/gu, '$1 $2')
    .split(/[^a-zA-Z0-9]+/u)
    .filter((word) => word.length > 0);
  if (words.length === 0) return type;
  return words
    .map((word) => {
      const lower = word.toLowerCase();
      return ACRONYMS[lower] ?? `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
    })
    .join(' ');
}

/** The node's own `label`, trimmed and clipped, or undefined when it has none. */
export function instanceLabel(kernel: BuilderKernel, nodeId: NodeId): string | undefined {
  const label = kernel.getDocument().nodes[nodeId]?.props['label'];
  if (typeof label !== 'string') return undefined;
  const trimmed = label.trim();
  if (trimmed === '') return undefined;
  return trimmed.length > MAX_INSTANCE_LABEL
    ? `${trimmed.slice(0, MAX_INSTANCE_LABEL - 1)}…`
    : trimmed;
}

/**
 * The name a chip, a mention row or an edit record shows for `nodeId`. A node that is gone
 * reads as its id (the only stable identity left), exactly as the shell's rule does.
 */
export function blockName(kernel: BuilderKernel, nodeId: NodeId): string {
  const type = kernel.getDocument().nodes[nodeId]?.type;
  if (type === undefined) return nodeId;
  if (kernel.context.registry.block(type) === undefined) return type;
  return instanceLabel(kernel, nodeId) ?? blockTypeName(type);
}
