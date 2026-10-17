import type { BuilderKernel } from '@craftkit/builder-core';
import {
  blockPartsOf,
  getAtPropPath,
  parsePropPath,
  planPartValue,
  type JsonValue,
} from '@craftkit/builder-schema';

import { blockDisplayName } from '../naming/block-display-name';
import type { InlineSession } from './inline-session';

/**
 * The outcome of one inline part commit. `changed: false` means the value was
 * already stored, so no transaction was written (no empty Undo).
 */
export type PartInlineCommitResult =
  | { readonly ok: true; readonly changed: boolean }
  | { readonly ok: false; readonly message: string };

/*
  A rich document as it MEANS, for comparison only (block-parts fix pass,
  2026-10-06): key order ignored, and the attributes an editor adds on its
  own — `dir: auto` (the inline editor stamps it on every block; an explicit
  ltr/rtl still counts) and empty or null attrs — dropped. A double-click that changed nothing recorded
  "Edit text · Rich Text text" because the draft came back with `dir` set.
*/
/* An attribute the editor adds that means "unset": dir auto. */
function editorDefault(name: string, value: unknown): boolean {
  return name === 'dir' && value === 'auto';
}

function meaning(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(meaning);
  if (typeof value !== 'object' || value === null) return value;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    const child = (value as Record<string, unknown>)[key];
    if (key === 'attrs' && typeof child === 'object' && child !== null && !Array.isArray(child)) {
      const attrs: Record<string, unknown> = {};
      for (const name of Object.keys(child).sort()) {
        const attr = (child as Record<string, unknown>)[name];
        if (editorDefault(name, attr) || attr === null || attr === undefined) continue;
        attrs[name] = attr;
      }
      if (Object.keys(attrs).length > 0) out[key] = attrs;
      continue;
    }
    if (child === undefined) continue;
    out[key] = meaning(child);
  }
  return out;
}

/* Structural equality for JSON values (text is a string; rich text a document, compared by meaning). */
function sameJson(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  return JSON.stringify(meaning(a)) === JSON.stringify(meaning(b));
}

/**
 * Commit an inline part edit (block-parts DESIGN §2.8): the ONE write path the
 * canvas uses when `session.bind` is set.
 *
 * `planPartValue` turns the edited value into ONE `setProp` of the part's
 * top-level key (the nested value replaced, siblings shared), and the result
 * is dispatched as ONE labelled group — `"Edit text · Hero heading"` — so an
 * inline edit is exactly one transaction and one Undo (law L1). A link part
 * edits its visible label (`text`); its href is the Link popover's.
 *
 * Never throws: a planner refusal or a door rejection comes back as
 * `{ ok: false, message }` for the canvas's existing rejection UI, and the
 * document is untouched.
 */
export function partInlineCommit(
  kernel: BuilderKernel,
  session: InlineSession,
  value: unknown,
): PartInlineCommitResult {
  const { part, bind, nodeId } = session;
  if (part === undefined || bind === undefined) {
    return { ok: false, message: 'This edit is not a block part · edit it from the Inspector.' };
  }
  const node = kernel.getDocument().nodes[nodeId];
  if (node === undefined) {
    return { ok: false, message: 'This block no longer exists · select another block.' };
  }
  const schema = kernel.context.registry.block(node.type)?.schema;
  const parts = blockPartsOf(schema);
  if (sameJson(getAtPropPath(node.props, parsePropPath(bind)), value)) {
    return { ok: true, changed: false };
  }
  const plan = planPartValue(
    node,
    parts,
    part,
    'text',
    value as JsonValue,
    blockDisplayName(kernel, nodeId),
  );
  if (!plan.ok) {
    return { ok: false, message: plan.message };
  }
  try {
    kernel.dispatchGroup(plan.steps, { author: 'user', label: plan.label });
    return { ok: true, changed: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
