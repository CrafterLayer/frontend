import type { BuilderKernel } from '@craftkit/builder-core';
import { applyStyleIntents, type NodeId, type StyleIntent } from '@craftkit/builder-schema';

import type { EditingBucket } from '../devices/buckets';
import { blockDisplayName } from '../naming/block-display-name';
import {
  refusalMessage,
  styleTransactionLabel,
  type StyleApplyResult,
  type StyleSource,
} from './style-source';

/** The declared `utility-classes` prop of a block, by DECLARATION, never by name. */
export function utilityClassesKey(
  declarations: Readonly<Record<string, { readonly kind?: string | undefined } | undefined>> | undefined,
): string | undefined {
  if (declarations === undefined) return undefined;
  return Object.entries(declarations).find(([, group]) => group?.kind === 'utility-classes')?.[0];
}

function stringOf(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * The StyleSource of a registered block's `utility-classes` prop, in TOKENS
 * mode: the panel offers theme tokens and scale steps only, and the engine
 * refuses anything the block's own field would refuse.
 *
 * Bucket and state live in the class prefixes, so the base prop is written
 * (`setProp`). A block that already keeps a device override for this prop
 * (`responsive[bucket]`) is respected: while editing that device, its
 * override is read and written (`setResponsive`).
 */
export function blockSource(
  kernel: BuilderKernel,
  nodeId: NodeId,
  propKey: string,
  device: EditingBucket = 'base',
): StyleSource {
  const overrideOf = () => {
    if (device === 'base') return undefined;
    const responsive = kernel.getDocument().nodes[nodeId]?.responsive?.[device];
    return responsive !== undefined && Object.hasOwn(responsive, propKey)
      ? stringOf(responsive[propKey])
      : undefined;
  };
  const current = () => overrideOf() ?? stringOf(kernel.getDocument().nodes[nodeId]?.props[propKey]);
  const label = blockDisplayName(kernel, nodeId);

  return {
    id: `block:${nodeId}:${propKey}:${device}`,
    label,
    mode: 'tokens',
    targetCount: 1,
    read: () => [current()],
    apply: (intents: readonly StyleIntent[], property: string): StyleApplyResult => {
      const before = current();
      const result = applyStyleIntents(before, intents, { mode: 'tokens' });
      if (!result.ok) return result;
      // A utility with no value (`pbs-`) is never written: the block's field would keep it forever.
      const empty = result.added.find((utility) => /[-:]$/u.test(utility));
      if (empty !== undefined) {
        return { ok: false, message: `"${empty}" has no value; pick one of the theme's steps.` };
      }
      if (result.className === before) return { ok: true };
      // An emptied prop stays a string: `''` says "no classes" in both the
      // base prop and a device override (null would CLEAR the override and
      // bring the base classes back, which is not what Reset meant).
      const value = result.className;
      const options = { author: 'user' as const, label: styleTransactionLabel(property, label) };
      try {
        if (overrideOf() !== undefined && device !== 'base') {
          kernel.dispatchGroup(
            [{ command: 'setResponsive', args: { id: nodeId, breakpoint: device, key: propKey, value } }],
            options,
          );
        } else {
          kernel.dispatchGroup([{ command: 'setProp', args: { id: nodeId, key: propKey, value } }], options);
        }
        return { ok: true };
      } catch (error) {
        return { ok: false, message: refusalMessage(error) };
      }
    },
    subscribe: (onChange) => kernel.context.store.subscribeNode(nodeId, onChange),
  };
}
