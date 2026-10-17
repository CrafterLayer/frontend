import type { BuilderKernel } from '@craftkit/builder-core';
import type { NodeId } from '@craftkit/builder-schema';

import type { ElementNameWords } from '../custom-code/element-target';
import { localBlockName } from '../i18n/block-names';

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

/**
 * The maximum length of an instance label before it is elided.
 *
 * A layers row is one line. A label the schema permits at 80 characters would
 * push the node id out of view, and the id is what a person falls back to when
 * two rows read alike.
 */
const MAX_INSTANCE_LABEL = 32;

/**
 * A node's own name, when it carries one.
 *
 * Most blocks are identified perfectly well by their TYPE — a page holds one
 * hero and one pricing table, and "Hero" says everything. Some do not: a page
 * of four freely composed regions reads as "Custom Code" four times, which
 * names the mechanism and hides the content. Those blocks declare a `label`
 * prop, and this is where it wins.
 *
 * Read by convention rather than by a schema flag deliberately: the prop is
 * already declared, already validated, and already shown in the Inspector, so
 * a second declaration saying "and it is the display name" would be a fact
 * stated twice. Any block gaining a `label: string` prop gets this behaviour
 * for free, which is the intended contract.
 */
function instanceLabel(kernel: BuilderKernel, nodeId: NodeId): string | undefined {
  const label = kernel.getDocument().nodes[nodeId]?.props['label'];
  if (typeof label !== 'string') return undefined;
  const trimmed = label.trim();
  if (trimmed === '') return undefined;
  return trimmed.length > MAX_INSTANCE_LABEL
    ? `${trimmed.slice(0, MAX_INSTANCE_LABEL - 1)}…`
    : trimmed;
}

/**
 * What the chrome calls a block instance: its own `label`, else its type's
 * name — the localised one when `words` carries a table for the editor's
 * language (arabic-editor), else the humanised type.
 */
export function blockDisplayName(
  kernel: BuilderKernel,
  nodeId: NodeId,
  words?: Pick<ElementNameWords, 'blocks'>,
): string {
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
  return (
    instanceLabel(kernel, nodeId) ??
    localBlockName(type, words?.blocks) ??
    displayNameForBlockType(type)
  );
}
