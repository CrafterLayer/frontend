import { adjustAfterRemoval, isCustomCodeTag, treeNodeAt } from '@craftkit/builder-schema';

import { defineAgentTool, type AgentToolContext, type AgentToolRun } from '../tools/agent/types';
import {
  elementName,
  formatPath,
  no,
  ok,
  parseAddress,
  parsePath,
  regionTree,
  resolveElement,
  stepTitle,
  strictRecord,
  type ElementAddress,
  type Parsed,
  type TreePath,
} from './address';
import { finish, step } from './finish';

/*
  element.remove / element.move / element.duplicate / element.wrap — the
  path-based structure tools (DESIGN §D.3). Each names one element by
  {id, path|find} and expands to the matching tree command (§D.2), so a
  structural edit is as small as the change, not a rewritten region.
*/

// ── element.remove ─────────────────────────────────────────────────────────────

const ADDRESS_KEYS = ['id', 'path', 'find'] as const;
const ADDRESS_SHAPE = '{"id","path"|"find"}';

function parseOnlyAddress(input: unknown): Parsed<ElementAddress> {
  const record = strictRecord(input, ADDRESS_KEYS, ADDRESS_SHAPE);
  if (!record.ok) return record;
  return parseAddress(record.value);
}

function runRemove(input: ElementAddress, context: AgentToolContext): AgentToolRun {
  const target = resolveElement(context, input);
  if (!target.ok) return target;
  const { id, path, node } = target.value;
  return finish(context, [step('removeTreeNode', { id, path: [...path] })], stepTitle('Delete', node));
}

export const elementRemoveTool = defineAgentTool<ElementAddress>({
  name: 'element.remove',
  lanes: ['edit', 'section'],
  summary: 'Delete one element from a region',
  signature: '{id,path|find}',
  parse: parseOnlyAddress,
  run: runRemove,
});

// ── element.duplicate ──────────────────────────────────────────────────────────

function runDuplicate(input: ElementAddress, context: AgentToolContext): AgentToolRun {
  const target = resolveElement(context, input);
  if (!target.ok) return target;
  const { id, path, node } = target.value;
  return finish(context, [step('duplicateTreeNode', { id, path: [...path] })], stepTitle('Duplicate', node));
}

export const elementDuplicateTool = defineAgentTool<ElementAddress>({
  name: 'element.duplicate',
  lanes: ['edit', 'section'],
  summary: 'Duplicate one element after itself',
  signature: '{id,path|find}',
  parse: parseOnlyAddress,
  run: runDuplicate,
});

// ── element.move ───────────────────────────────────────────────────────────────

type MoveDestination =
  | { readonly kind: 'to'; readonly id?: string; readonly parent: TreePath; readonly index: number }
  | { readonly kind: 'after' | 'before'; readonly path: TreePath };

export type ElementMoveInput = ElementAddress & { readonly destination: MoveDestination };

const MOVE_KEYS = ['id', 'path', 'find', 'to', 'after', 'before'] as const;

function parseMove(input: unknown): Parsed<ElementMoveInput> {
  const record = strictRecord(input, MOVE_KEYS, '{"id","path"|"find","to":{id?,parent,index}|"after":path|"before":path}');
  if (!record.ok) return record;
  const address = parseAddress(record.value);
  if (!address.ok) return address;
  const given = (['to', 'after', 'before'] as const).filter((key) => record.value[key] !== undefined);
  if (given.length !== 1) return no('say where with exactly one of "to" {id?,parent,index}, "after" or "before" (a sibling path in the same region).');
  const [key] = given;
  if (key === 'to') {
    const to = strictRecord(record.value['to'], ['id', 'parent', 'index'], '{"id"?,"parent","index"}');
    if (!to.ok) return no(`"to": ${to.error}`);
    const parent = parsePath(to.value['parent'], 'to.parent', true);
    if (!parent.ok) return parent;
    const index = to.value['index'];
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0) return no('"to.index" must be a whole number ≥ 0 (the place after the element is taken out).');
    const region = to.value['id'];
    if (region !== undefined && (typeof region !== 'string' || region === '')) return no('"to.id" must be another region id.');
    return ok({
      ...address.value,
      destination: { kind: 'to', parent: parent.value, index, ...(typeof region === 'string' ? { id: region } : {}) },
    });
  }
  /* v8 ignore next -- given has exactly one entry. */
  const side = key ?? 'after';
  const path = parsePath(record.value[side], side);
  if (!path.ok) return path;
  return ok({ ...address.value, destination: { kind: side, path: path.value } });
}

function runMove(input: ElementMoveInput, context: AgentToolContext): AgentToolRun {
  const target = resolveElement(context, input);
  if (!target.ok) return target;
  const { id, path: from, node } = target.value;
  const { destination } = input;
  if (destination.kind === 'to') {
    const toId = destination.id ?? id;
    if (toId !== id) {
      const other = regionTree(context, toId);
      if (!other.ok) return other;
    }
    return finish(
      context,
      [
        step('moveTreeNode', {
          id,
          from: [...from],
          to: { ...(toId === id ? {} : { id: toId }), parent: [...destination.parent], index: destination.index },
        }),
      ],
      stepTitle('Move', node),
    );
  }
  const anchor = treeNodeAt(target.value.tree, destination.path);
  if (anchor === undefined) return no(`no element at ${formatPath(destination.path)} in "${id}" · send the path of the sibling to move ${destination.kind}.`);
  if (formatPath(destination.path) === formatPath(from)) return no('an element cannot move next to itself · send another sibling\'s path.');
  // moveTreeNode reads `parent` before the move and `index` after the element is taken out.
  const adjusted = adjustAfterRemoval(destination.path, from);
  const last = adjusted[adjusted.length - 1] ?? 0;
  return finish(
    context,
    [
      step('moveTreeNode', {
        id,
        from: [...from],
        to: { parent: destination.path.slice(0, -1), index: destination.kind === 'after' ? last + 1 : last },
      }),
    ],
    `Move · ${elementName(node)} ${destination.kind} ${elementName(anchor)}`,
  );
}

export const elementMoveTool = defineAgentTool<ElementMoveInput>({
  name: 'element.move',
  lanes: ['edit', 'section'],
  summary: 'Move one element to another place',
  signature: '{id,path|find,to:{id?,parent,index}|after:path|before:path}',
  parse: parseMove,
  run: runMove,
});

// ── element.wrap ───────────────────────────────────────────────────────────────

export interface ElementWrapInput {
  readonly targets: readonly ElementAddress[];
  readonly id: string;
  readonly wrapper: { readonly tag: string; readonly className?: string };
}

const WRAP_KEYS = ['id', 'path', 'find', 'paths', 'wrapper'] as const;

function parseWrap(input: unknown): Parsed<ElementWrapInput> {
  const record = strictRecord(input, WRAP_KEYS, '{"id","path"|"find"|"paths","wrapper":{tag,className?}}');
  if (!record.ok) return record;
  const id = record.value['id'];
  if (typeof id !== 'string' || id.trim() === '') return no('"id" must be the region id.');
  let targets: ElementAddress[];
  if (record.value['paths'] !== undefined) {
    if (record.value['path'] !== undefined || record.value['find'] !== undefined) return no('send "paths" alone, or one "path"/"find".');
    const list = record.value['paths'];
    if (!Array.isArray(list) || list.length === 0 || list.length > 200) return no('"paths" must be 1-200 sibling paths, e.g. [[0,1],[0,2]].');
    targets = [];
    for (const entry of list as unknown[]) {
      const path = parsePath(entry, 'paths[]');
      if (!path.ok) return path;
      targets.push({ id, path: path.value });
    }
  } else {
    const address = parseAddress(record.value);
    if (!address.ok) return address;
    targets = [address.value];
  }
  const wrapper = strictRecord(record.value['wrapper'], ['tag', 'className'], '{"tag","className"?}');
  if (!wrapper.ok) return no(`"wrapper": ${wrapper.error}`);
  const tag = wrapper.value['tag'];
  if (typeof tag !== 'string' || !isCustomCodeTag(tag)) return no('"wrapper.tag" must be an element tag such as div, section, a, figure.');
  const className = wrapper.value['className'];
  if (className !== undefined && (typeof className !== 'string' || className.length > 1_000)) return no('"wrapper.className" must be a class string.');
  return ok({ id, targets, wrapper: { tag, ...(typeof className === 'string' && className.trim() !== '' ? { className: className.trim() } : {}) } });
}

function runWrap(input: ElementWrapInput, context: AgentToolContext): AgentToolRun {
  const paths: TreePath[] = [];
  let firstName = '';
  for (const address of input.targets) {
    const target = resolveElement(context, address);
    if (!target.ok) return target;
    paths.push(target.value.path);
    if (firstName === '') firstName = elementName(target.value.node);
  }
  return finish(
    context,
    [step('wrapTreeNode', { id: input.id, paths: paths.map((path) => [...path]), wrapper: { ...input.wrapper } })],
    paths.length === 1 ? `Wrap · ${firstName}` : `Wrap · ${String(paths.length)} elements`,
  );
}

export const elementWrapTool = defineAgentTool<ElementWrapInput>({
  name: 'element.wrap',
  lanes: ['edit', 'section'],
  summary: 'Wrap elements in a new container',
  signature: '{id,path|find|paths,wrapper:{tag,className?}}',
  parse: parseWrap,
  run: runWrap,
});
