import { canonicalJsonStringify } from '../internal/canonical-json';
import { applyTreeStep, asTreeRoot, isTreeCommand } from '../style-tools/tree-steps';
import { isRecord } from '../tools/agent/shared';
import type { AgentToolStep } from '../tools/agent/types';

/**
 * Fold a script's expanded steps into the fewest kernel steps (agent-script
 * DESIGN §A.7 step 7). Pure.
 *
 * Tools emit whole-value setProps: twelve `element.style` calls on one region
 * are twelve setProps of the same `tree`, and fourteen buttons across three
 * regions would be fourteen. The door allows 64 commands, so the steps are
 * simulated in order — setProp writes, and tree commands folded with
 * `applyTreeStep` — and each (node, prop) is written ONCE, with its final
 * value, at the position of its LAST write. Structural steps (insertNode,
 * removeNode, moveNode, setDocMeta, site commands) stay where they were, so
 * a write to a node an earlier insert created still lands after the insert.
 * A write whose final value equals the value before the script is dropped.
 */

export type PropReader = (nodeId: string, key: string) => unknown;

export interface CoalesceOptions {
  /** The first produced step's title (the script step's title, the first note, or the default). */
  readonly title?: string;
}

export type CoalesceResult =
  | { readonly ok: true; readonly steps: readonly AgentToolStep[] }
  | { readonly ok: false; readonly error: string; readonly step: number };

const slotOf = (id: string, key: string): string => `${id}\u0000${key}`;

function same(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  try {
    return canonicalJsonStringify(left) === canonicalJsonStringify(right);
  } catch {
    return false;
  }
}

/** Coalesce `steps` (as they would run after `readProp`'s state) into one setProp per (node, prop). */
export function coalesceScriptSteps(
  steps: readonly AgentToolStep[],
  readProp: PropReader,
  options: CoalesceOptions = {},
): CoalesceResult {
  const values = new Map<string, unknown>();
  const slots = new Map<string, { readonly id: string; readonly key: string }>();
  const lastWrite = new Map<string, number>();
  const read = (id: string, key: string): unknown => {
    const slot = slotOf(id, key);
    return values.has(slot) ? values.get(slot) : readProp(id, key);
  };
  const write = (id: string, key: string, value: unknown, at: number): void => {
    const slot = slotOf(id, key);
    values.set(slot, value);
    slots.set(slot, { id, key });
    lastWrite.set(slot, at);
  };
  const structural = new Map<number, AgentToolStep>();

  for (const [at, entry] of steps.entries()) {
    const args = isRecord(entry.args) ? entry.args : {};
    if (entry.command === 'setProp' && typeof args['id'] === 'string' && typeof args['key'] === 'string') {
      write(args['id'], args['key'], args['value'], at);
      continue;
    }
    if (isTreeCommand(entry.command)) {
      const result = applyTreeStep({ command: entry.command, args }, (id) => asTreeRoot(read(id, 'tree')));
      if (!result.ok) return { ok: false, error: result.error, step: at };
      for (const [id, tree] of result.writes) write(id, 'tree', tree, at);
      continue;
    }
    structural.set(at, { command: entry.command, args: { ...args } });
  }

  // Emit in order: a structural step at its place, each slot at its last write.
  const bySlotPosition = new Map<number, string[]>();
  for (const [slot, at] of lastWrite) {
    const list = bySlotPosition.get(at);
    if (list === undefined) bySlotPosition.set(at, [slot]);
    else list.push(slot);
  }
  const out: AgentToolStep[] = [];
  for (let at = 0; at < steps.length; at += 1) {
    const kept = structural.get(at);
    if (kept !== undefined) out.push(kept);
    for (const slot of bySlotPosition.get(at) ?? []) {
      const where = slots.get(slot);
      /* v8 ignore next -- every slot was recorded with its address. */
      if (where === undefined) continue;
      const value = values.get(slot);
      if (same(value, readProp(where.id, where.key))) continue;
      out.push({ command: 'setProp', args: { id: where.id, key: where.key, value } });
    }
  }
  const [first, ...rest] = out;
  if (first === undefined || options.title === undefined || options.title.trim() === '') return { ok: true, steps: out };
  return { ok: true, steps: [{ ...first, title: options.title.slice(0, 160) }, ...rest] };
}

/** "Script: 14 edits" / «سكربت: 14 تعديل»: the default history label. */
export function scriptDefaultTitle(edits: number, lang: string): string {
  return lang.trim().toLowerCase().startsWith('ar') ? `سكربت: ${String(edits)} تعديل` : `Script: ${String(edits)} edit${edits === 1 ? '' : 's'}`;
}
