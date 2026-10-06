import type { BuilderKernel } from '@craftkit/builder-core';
import {
  blockPartsOf,
  // ── block-parts (2026-10-06) ──
  mergePartClasses,
  // ── /block-parts ──
  partStyleKey,
  partStylesKeyOf,
  planPartStyle,
  type NodeId,
  type PartRef,
  type StyleIntent,
} from '@craftkit/builder-schema';

import type { ElementNameWords } from '../custom-code/element-target';
import { blockDisplayName } from '../naming/block-display-name';
import {
  refusalMessage,
  styleTransactionLabel,
  type StyleApplyResult,
  type StyleSource,
} from './style-source';

/** Which classes a part write lands in: every instance (`name`) or this one (`name@i`). */
export type PartStyleScope = 'all' | 'this';

export interface PartSourceOptions {
  /** The editor's language: the part label and block name in transaction labels. */
  readonly locale?: 'en' | 'ar' | undefined;
  /** Localised block-type names (arabic-editor); English humanised names otherwise. */
  readonly words?: ElementNameWords | undefined;
  // ── block-parts (2026-10-06) ──
  /**
   * The block's OWN classes for this part (the canvas stamps them as
   * `data-ck-part-own`). `read()` then reports what the part visibly has —
   * the block's classes with the stored ones merged over them — instead of
   * "Not set" for the hero eyebrow's `px-3 py-1 rounded-full`.
   */
  readonly baseline?: (() => string | undefined) | undefined;
  // ── /block-parts ──
}

/** The prop a block keeps its part classes in, by MARKER (`partStylesProp()`), never by name. */
const FALLBACK_PART_STYLES_KEY = 'partStyles';

function classNameAt(value: unknown, key: string): string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return '';
  const entry = (value as Readonly<Record<string, unknown>>)[key];
  if (typeof entry !== 'object' || entry === null) return '';
  const className = (entry as { readonly className?: unknown }).className;
  return typeof className === 'string' ? className : '';
}

/**
 * The StyleSource of ONE part of a registered block (block-parts DESIGN §2.13),
 * in TOKENS mode: the part keeps the same law as the block's own
 * `utility-classes` prop, so the panel offers theme tokens and scale steps only.
 *
 * - `read()` is the class string stored at this scope's key of the block's
 *   `partStyles` prop (`heading`, or `item.title@2` for "this item"), so an
 *   undo or an agent write shows through on the next render.
 * - `apply()` runs the pure `planPartStyle` planner and dispatches its steps as
 *   ONE `dispatchGroup` labelled "Padding · Hero Heading" — one Undo.
 * - `subscribe()` listens to this node only.
 */
export function partSource(
  kernel: BuilderKernel,
  nodeId: NodeId,
  ref: PartRef,
  scope: PartStyleScope,
  options: PartSourceOptions = {},
): StyleSource {
  const locale = options.locale ?? 'en';
  const schemaOf = () => {
    const node = kernel.getDocument().nodes[nodeId];
    return node === undefined ? undefined : kernel.context.registry.block(node.type)?.schema;
  };
  const key = partStyleKey(ref, scope);
  const indexKey = ref.index.join('.');
  const declared = blockPartsOf(schemaOf())[ref.part];
  const partLabel = declared === undefined ? ref.part : declared.label[locale];
  const blockName = blockDisplayName(kernel, nodeId, options.words);
  const label = `${blockName} ${partLabel}`;

  const stylesKey = () => {
    const schema = schemaOf();
    return (schema === undefined ? undefined : partStylesKeyOf(schema.props)) ?? FALLBACK_PART_STYLES_KEY;
  };

  return {
    id: `part:${nodeId}:${ref.part}:${indexKey}:${scope}`,
    label,
    mode: 'tokens',
    targetCount: 1,
    // ── block-parts (2026-10-06) ── the block's classes as the baseline, the stored ones over them
    read: () => {
      const stored = classNameAt(kernel.getDocument().nodes[nodeId]?.props[stylesKey()], key);
      const own = options.baseline?.() ?? '';
      return [own.trim() === '' ? stored : mergePartClasses(own, stored)];
    },
    // ── /block-parts ──
    apply: (intents: readonly StyleIntent[], property: string): StyleApplyResult => {
      const node = kernel.getDocument().nodes[nodeId];
      const schema = schemaOf();
      if (node === undefined || schema === undefined) {
        return { ok: false, message: `${label} is no longer on the page · select it again.` };
      }
      if (blockPartsOf(schema)[ref.part] === undefined) {
        return { ok: false, message: `${blockName} has no part "${ref.part}" · pick one of its parts.` };
      }
      const plan = planPartStyle(node, schema.props, ref, scope, intents, label);
      if (!plan.ok) return { ok: false, message: plan.message };
      // An edit that leaves the classes as they were is not a transaction (no empty Undo).
      const unchanged = plan.steps.every(
        (step) =>
          step.args.key === stylesKey() &&
          classNameAt(step.args.value, key) === classNameAt(node.props[stylesKey()], key),
      );
      if (plan.steps.length === 0 || unchanged) return { ok: true };
      // A utility with no value (`pbs-`) is never written: the part would keep it forever.
      const written = plan.steps.map((step) => classNameAt(step.args.value, key)).join(' ');
      const empty = written.split(/\s+/u).find((utility) => /[-:]$/u.test(utility));
      if (empty !== undefined) {
        return { ok: false, message: `"${empty}" has no value · pick one of the theme's steps.` };
      }
      try {
        kernel.dispatchGroup(plan.steps, { author: 'user', label: styleTransactionLabel(property, label) });
        return { ok: true };
      } catch (error) {
        return { ok: false, message: refusalMessage(error) };
      }
    },
    subscribe: (onChange) => kernel.context.store.subscribeNode(nodeId, onChange),
  };
}
