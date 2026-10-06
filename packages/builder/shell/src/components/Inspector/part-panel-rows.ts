import type { z } from 'zod';

import type { BuilderKernel } from '@craftkit/builder-core';
import {
  bindPathOf,
  blockPartsOf,
  formatPropPath,
  getAtPropPath,
  planPartValue,
  setAtPropPath,
  type BlockPartDecl,
  type BlockPropertyKind,
  type JsonValue,
  type NodeId,
  type PartRef,
  type PropPath,
} from '@craftkit/builder-schema';

import type { FieldCommitResult } from '../../fields/field-commit';
import { propsShapeOf, unwrapSchema } from '../../fields/resolve-field';
import { repeaterSchemaInfo } from '../../fields/repeater-schema';

/*
  The Content rows of one part (block-parts DESIGN §2.13), kept pure so the
  "which rows does a text / link / image / item part show" question is
  testable without a DOM. A row names the PROP PATH it edits and the schema
  found at that path; the panel renders it through the Inspector's own
  InspectorRowBody, so the editors P3 resolves for each kind appear there.
*/

/** Which planner leaf a row writes; absent ⇒ the whole value at `path` (an item, a link object, a list). */
export type PartLeaf = 'text' | 'href' | 'src' | 'alt';

/** What the row's caption says, besides the part's own label. */
export type PartRowCaption = 'part' | 'linkAddress' | 'altText';

export interface PartContentRow {
  /** Stable React key: the formatted prop path. */
  readonly key: string;
  readonly path: PropPath;
  readonly schema: z.ZodType;
  /** The field kind the row asks for by DECLARATION (never by prop name). */
  readonly propertyKind?: BlockPropertyKind | undefined;
  readonly leaf?: PartLeaf | undefined;
  readonly caption: PartRowCaption;
}

/**
 * The schema at a prop path: object keys step into the shape, numbers step
 * into an array's element. Optional / default / nullable wrappers are seen
 * through. `undefined` when the path leaves the schema.
 */
export function schemaAtPath(props: z.ZodType, path: PropPath): z.ZodType | undefined {
  let current: z.ZodType | undefined = props;
  for (const step of path) {
    if (current === undefined) return undefined;
    if (typeof step === 'number') {
      current = repeaterSchemaInfo(current)?.element;
    } else {
      current = propsShapeOf(unwrapSchema(current))[step];
    }
  }
  return current;
}

function sameParent(a: PropPath, b: PropPath): PropPath | undefined {
  if (a.length < 2 || a.length !== b.length) return undefined;
  const parent = a.slice(0, -1);
  return parent.every((step, at) => b[at] === step) ? parent : undefined;
}

function row(
  props: z.ZodType,
  path: PropPath | undefined,
  caption: PartRowCaption,
  extra: { readonly propertyKind?: BlockPropertyKind; readonly leaf?: PartLeaf } = {},
): PartContentRow | undefined {
  if (path === undefined || path.length === 0) return undefined;
  const schema = schemaAtPath(props, path);
  if (schema === undefined) return undefined;
  return { key: formatPropPath(path), path, schema, caption, ...extra };
}

/** The rows a part shows on its Content tab, in reading order. A `box` part shows none. */
export function partContentRows(props: z.ZodType, decl: BlockPartDecl, ref: PartRef): PartContentRow[] {
  const index = ref.index;
  const rows: (PartContentRow | undefined)[] = [];
  switch (decl.kind) {
    case 'text':
      rows.push(
        row(props, bindPathOf(decl, index), 'part', {
          leaf: 'text',
          ...(decl.multiline === true ? { propertyKind: 'multiline' } : {}),
        }),
      );
      break;
    case 'rich':
      rows.push(row(props, bindPathOf(decl, index), 'part', { leaf: 'text' }));
      break;
    case 'link': {
      const text = bindPathOf(decl, index, 'text');
      const href = bindPathOf(decl, index, 'href');
      const parent = text === undefined || href === undefined ? undefined : sameParent(text, href);
      // `{ text: 'link.label', href: 'link.href' }`: ONE LinkField over the object.
      if (parent !== undefined) rows.push(row(props, parent, 'part', { propertyKind: 'link' }));
      else {
        rows.push(row(props, text, 'part', { leaf: 'text' }));
        // An href string declared as a link: the LinkField's address mode (safeHref, page picker).
        rows.push(row(props, href, 'linkAddress', { leaf: 'href', propertyKind: 'link' }));
      }
      break;
    }
    case 'image':
      rows.push(row(props, bindPathOf(decl, index, 'src'), 'part', { leaf: 'src', propertyKind: 'image' }));
      rows.push(row(props, bindPathOf(decl, index, 'alt'), 'altText', { leaf: 'alt' }));
      break;
    case 'item':
    case 'list':
      // The item's whole group (ObjectField), or the list's RepeaterField.
      rows.push(row(props, bindPathOf(decl, index), 'part'));
      break;
    case 'box':
      break;
  }
  return rows.filter((candidate): candidate is PartContentRow => candidate !== undefined);
}

/** The value a row shows, read from the node's props (document truth). */
export function partRowValue(props: Readonly<Record<string, unknown>> | undefined, path: PropPath): unknown {
  return props === undefined ? undefined : getAtPropPath(props, path);
}

const EDIT_WORD: Readonly<Record<string, string>> = {
  item: 'Edit item',
  list: 'Edit list',
  link: 'Edit link',
};

/**
 * Commits a NESTED row (`items.2.title`, `items.2`) as ONE labelled
 * `setProp` of the top-level key. Leaves go through `planPartValue`; a whole
 * item / link object / nested list goes through the same immutable path set.
 * A top-level row never comes here: it keeps the Inspector's own row door.
 */
export function commitPartRow(
  kernel: BuilderKernel,
  nodeId: NodeId,
  ref: PartRef,
  target: PartContentRow,
  value: unknown,
  blockName: string,
  partLabel: string,
): FieldCommitResult {
  const node = kernel.getDocument().nodes[nodeId];
  const schema = node === undefined ? undefined : kernel.context.registry.block(node.type)?.schema;
  if (node === undefined || schema === undefined) {
    return { ok: false, message: `${partLabel} is no longer on the page · select it again.` };
  }
  try {
    if (target.leaf !== undefined) {
      const plan = planPartValue(node, blockPartsOf(schema), ref, target.leaf, value as JsonValue, blockName);
      if (!plan.ok) return { ok: false, message: plan.message };
      if (plan.steps.length === 0) return { ok: true };
      kernel.dispatchGroup(plan.steps, { author: 'user', label: plan.label });
      return { ok: true };
    }
    const [top, ...rest] = target.path;
    if (typeof top !== 'string') return { ok: false, message: `${partLabel} has no prop to write · pick another part.` };
    const next = rest.length === 0 ? value : setAtPropPath(node.props[top], rest, value);
    const kind = blockPartsOf(schema)[ref.part]?.kind ?? 'item';
    kernel.dispatchGroup([{ command: 'setProp', args: { id: nodeId, key: top, value: next } }], {
      author: 'user',
      label: `${EDIT_WORD[kind] ?? 'Edit'} · ${blockName} ${partLabel}`,
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
