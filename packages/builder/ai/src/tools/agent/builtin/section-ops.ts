import {
  fail,
  inputRecord,
  isElement,
  isRecord,
  mapTree,
  okParse,
  readTree,
  rootChildren,
  rootIdOf,
  unknownKeys,
  type TreeNode,
} from '../shared';
import { defineAgentTool, type AgentToolContext, type AgentToolRun } from '../types';

/**
 * section.ops — move, duplicate or remove one of the page's sections (a
 * child of the root) with the kernel's own commands: `moveNode {id,
 * toParentId, toIndex}`, `insertNode {type, props, parentId, index}` with a
 * copy of the section's props, and `removeNode {id}`.
 */

export interface SectionOpsInput {
  readonly op: 'move' | 'duplicate' | 'remove';
  readonly id: string;
  readonly to?: string | number;
}

function parse(input: unknown) {
  const record = inputRecord(input);
  if (record === undefined) return fail<SectionOpsInput>('input must be {"op","id","to?"}.');
  const extra = unknownKeys(record, ['op', 'id', 'to']);
  if (extra.length > 0) return fail<SectionOpsInput>(`unknown keys ${extra.join(', ')}; use op, id, to.`);
  const { op, id, to } = record;
  if (op !== 'move' && op !== 'duplicate' && op !== 'remove') return fail<SectionOpsInput>('"op" is move, duplicate or remove.');
  if (typeof id !== 'string' || id === '') return fail<SectionOpsInput>('"id" must be a section id.');
  if (to !== undefined) {
    const valid =
      (typeof to === 'number' && Number.isInteger(to) && to >= 0) ||
      (typeof to === 'string' && /^(?:before|after):\S+$/u.test(to));
    if (!valid) return fail<SectionOpsInput>('"to" is "before:<id>", "after:<id>" or a 0-based index.');
  }
  if (op === 'move' && to === undefined) return fail<SectionOpsInput>('move needs "to": "before:<id>", "after:<id>" or an index.');
  return okParse<SectionOpsInput>({ op, id, ...(to === undefined ? {} : { to: to }) });
}

/** Where `to` lands in `list` (the root's children as the op sees them), or an error. */
function indexFor(to: string | number, list: readonly string[]): number | string {
  if (typeof to === 'number') return Math.min(to, list.length);
  const [side, ref] = [to.slice(0, to.indexOf(':')), to.slice(to.indexOf(':') + 1)];
  const at = list.indexOf(ref);
  if (at < 0) return `"${ref}" is not a section of this page; sections: ${list.join(', ')}.`;
  return side === 'before' ? at : at + 1;
}

/** Ids inside a copied tree get a suffix, and references to them follow, so the copy never repeats an anchor. */
function renameIds(tree: unknown, suffix: string): unknown {
  if (!isRecord(tree) || tree['kind'] !== 'root' || !Array.isArray(tree['children'])) return tree;
  const refs = ['id', 'aria-labelledby', 'aria-describedby', 'popovertarget'];
  return mapTree(tree as never, (node: TreeNode) => {
    if (!isElement(node) || node.attributes === undefined) return node;
    let changed = false;
    const attributes: Record<string, string> = { ...node.attributes };
    for (const key of refs) {
      const value = attributes[key];
      if (value === undefined) continue;
      attributes[key] = value
        .split(/\s+/u)
        .map((part) => `${part}${suffix}`)
        .join(' ');
      changed = true;
    }
    return changed ? { ...node, attributes } : node;
  });
}

function run(input: SectionOpsInput, context: AgentToolContext): AgentToolRun {
  const kernel = context.kernel;
  const rootId = rootIdOf(kernel);
  const children = rootChildren(kernel);
  if (!children.includes(input.id)) {
    return { ok: false, error: `"${input.id}" is not a section of this page; sections: ${children.join(', ')}.` };
  }
  if (input.op === 'remove') return { ok: true, steps: [{ command: 'removeNode', args: { id: input.id } }] };
  if (input.op === 'move') {
    const others = children.filter((id) => id !== input.id);
    const index = indexFor(input.to ?? 0, others);
    if (typeof index === 'string') return { ok: false, error: index };
    if (children.indexOf(input.id) === index) {
      return { ok: true, steps: [], note: 'the section is already there' };
    }
    return { ok: true, steps: [{ command: 'moveNode', args: { id: input.id, toParentId: rootId, toIndex: index } }] };
  }
  const node = kernel.getDocument().nodes[input.id];
  if (node === undefined) return { ok: false, error: `"${input.id}" does not exist.` };
  const index = input.to === undefined ? children.indexOf(input.id) + 1 : indexFor(input.to, children);
  if (typeof index === 'string') return { ok: false, error: index };
  const props: Record<string, unknown> = {};
  for (const key of Object.keys(node.props)) props[key] = context.readProp(input.id, key);
  if (readTree(context, input.id) !== undefined) props['tree'] = renameIds(readTree(context, input.id), '-2');
  return {
    ok: true,
    steps: [{ command: 'insertNode', args: { type: node.type, props, parentId: rootId, index } }],
  };
}

export const sectionOpsTool = defineAgentTool<SectionOpsInput>({
  name: 'section.ops',
  lanes: ['edit'],
  summary: 'Move, duplicate or remove a section',
  signature: '{op:move|duplicate|remove,id,to?:before:<id>|after:<id>|index}',
  parse,
  run,
});
