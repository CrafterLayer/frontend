import {
  customCodeTreeProblems,
  customCodeTreeSchema,
  duplicateNodeAt,
  extractNodeAt,
  formatTextRange,
  insertNodeAt,
  moveNode,
  patchNodeAt,
  removeNodeAt,
  setNodeAt,
  treeNodeAt,
  unwrapNodeAt,
  wrapNodesAt,
  type CustomCodeNode,
  type CustomCodeRoot,
  type TreeNodePatch,
  type TreeOpResult,
  type TreeTextMark,
} from '@craftkit/builder-schema';

import { isTreeMarkup, parseTreeMarkup } from '../plan/tree-markup';
import { isRecord } from '../tools/agent/shared';
import type { AgentToolStep } from '../tools/agent/types';

/*
  The nine path-addressed tree commands (style-manager DESIGN.md §D.2) as
  PURE functions over region trees — the same schema ops the custom-code
  extension's handlers call, in the same order, with the same tree door
  (per-tag problems, then the tree schema).

  Three callers, one behaviour:
  1. every style tool runs its own steps through here before returning them,
     so a refusal reads in the tool's terms instead of surfacing later as a
     door error on step N;
  2. `treeWritesOf` is what plan expansion needs to FOLD a tree command into
     the trees later tools read (expand.ts `remember` tracks setProp only;
     see the P11 note in index.ts);
  3. the ai test fixture registers these as page commands, because the ai
     package (layer 2) may not depend on the extension (layer 4).
*/

export const TREE_COMMANDS = [
  'setTreeNode',
  'patchTreeNode',
  'insertTreeNode',
  'removeTreeNode',
  'moveTreeNode',
  'duplicateTreeNode',
  'wrapTreeNode',
  'unwrapTreeNode',
  'formatTreeText',
] as const;

export type TreeCommand = (typeof TREE_COMMANDS)[number];

export function isTreeCommand(name: unknown): name is TreeCommand {
  return typeof name === 'string' && (TREE_COMMANDS as readonly string[]).includes(name);
}

export type TreeStepResult =
  | { readonly ok: true; readonly writes: ReadonlyMap<string, CustomCodeRoot> }
  | { readonly ok: false; readonly error: string };

type Path = readonly number[];

function failed(result: { readonly message: string }): TreeStepResult {
  return { ok: false, error: result.message };
}

function asPath(value: unknown): Path {
  return Array.isArray(value) ? (value as number[]) : [];
}

/** The door half that runs on a finished tree: per-tag problems, then the tree schema. */
export function treeDoorProblem(tree: CustomCodeRoot): string | undefined {
  const problem = customCodeTreeProblems(tree)[0];
  if (problem !== undefined) {
    const at = problem.path.length === 0 ? '' : ` (at ${problem.path.map(String).join('.')})`;
    return `${problem.message}${at}`;
  }
  const shape = customCodeTreeSchema.safeParse(tree);
  if (!shape.success) {
    const issue = shape.error.issues[0];
    return `${issue?.message ?? 'the tree failed validation'}${issue === undefined ? '' : ` (at ${issue.path.map(String).join('.')})`}`;
  }
  return undefined;
}

function one(id: string, result: TreeOpResult): TreeStepResult {
  if (!result.ok) return failed(result);
  return { ok: true, writes: new Map([[id, result.tree]]) };
}

/**
 * Apply one tree command to the trees `read` returns, with the door.
 * Returns every region the step rewrites (two for a cross-region move).
 */
export function applyTreeStep(
  step: AgentToolStep,
  read: (id: string) => CustomCodeRoot | undefined,
): TreeStepResult {
  const args = step.args;
  const id = typeof args['id'] === 'string' ? args['id'] : '';
  const tree = read(id);
  if (tree === undefined) return { ok: false, error: `"${id}" holds no element tree.` };
  let result: TreeStepResult;
  switch (step.command) {
    case 'setTreeNode':
      result = one(id, setNodeAt(tree, asPath(args['path']), args['node'] as CustomCodeNode));
      break;
    case 'patchTreeNode':
      result = one(
        id,
        patchNodeAt(tree, asPath(args['path']), {
          set: args['set'] as TreeNodePatch['set'],
          attributes: (args['attributes'] ?? {}) as TreeNodePatch['attributes'],
        }),
      );
      break;
    case 'insertTreeNode':
      result = one(
        id,
        insertNodeAt(tree, asPath(args['parent']), Number(args['index']), args['node'] as CustomCodeNode),
      );
      break;
    case 'removeTreeNode':
      result = one(id, removeNodeAt(tree, asPath(args['path'])));
      break;
    case 'duplicateTreeNode':
      result = one(id, duplicateNodeAt(tree, asPath(args['path'])));
      break;
    case 'wrapTreeNode': {
      const wrapper = isRecord(args['wrapper']) ? args['wrapper'] : {};
      result = one(
        id,
        wrapNodesAt(
          tree,
          Array.isArray(args['paths']) ? (args['paths'] as Path[]) : [],
          {
            tag: typeof wrapper['tag'] === 'string' ? wrapper['tag'] : '',
            ...(typeof wrapper['className'] === 'string' ? { className: wrapper['className'] } : {}),
          },
        ),
      );
      break;
    }
    case 'unwrapTreeNode':
      result = one(id, unwrapNodeAt(tree, asPath(args['path'])));
      break;
    case 'moveTreeNode': {
      const to = isRecord(args['to']) ? args['to'] : {};
      const targetId = typeof to['id'] === 'string' ? to['id'] : id;
      if (targetId === id) {
        result = one(id, moveNode(tree, asPath(args['from']), asPath(to['parent']), Number(to['index'])));
        break;
      }
      const target = read(targetId);
      if (target === undefined) return { ok: false, error: `"${targetId}" holds no element tree.` };
      const taken = extractNodeAt(tree, asPath(args['from']));
      if (!taken.ok) return failed(taken);
      const placed = insertNodeAt(target, asPath(to['parent']), Number(to['index']), taken.removed);
      if (!placed.ok) return failed(placed);
      result = {
        ok: true,
        writes: new Map([
          [id, taken.tree],
          [targetId, placed.tree],
        ]),
      };
      break;
    }
    case 'formatTreeText': {
      const path = asPath(args['path']);
      const element = treeNodeAt(tree, path);
      if (element === undefined) return { ok: false, error: `No element at [${path.join(',')}].` };
      const formatted = formatTextRange(
        element,
        Number(args['start']),
        Number(args['end']),
        args['mark'] as TreeTextMark,
        {
          className: typeof args['className'] === 'string' ? args['className'] : undefined,
          href: typeof args['href'] === 'string' ? args['href'] : undefined,
        },
      );
      if (!formatted.ok) return failed(formatted);
      result = one(id, setNodeAt(tree, path, formatted.element));
      break;
    }
    default:
      return { ok: false, error: `"${step.command}" is not a tree command.` };
  }
  if (!result.ok) return result;
  for (const written of result.writes.values()) {
    const problem = treeDoorProblem(written);
    if (problem !== undefined) return { ok: false, error: problem };
  }
  return result;
}

/** A region tree read the way the door reads it (markup strings are parsed). */
export function asTreeRoot(value: unknown): CustomCodeRoot | undefined {
  const tree = isTreeMarkup(value) ? parseTreeMarkup(value) : value;
  if (!isRecord(tree) || tree['kind'] !== 'root' || !Array.isArray(tree['children'])) return undefined;
  return tree as unknown as CustomCodeRoot;
}

/**
 * Run a tool's steps in order against the trees as the plan leaves them, so
 * each step sees the previous one's result — what the dispatcher will do.
 * Returns the first refusal, prefixed with the step it came from.
 */
export function simulateTreeSteps(
  steps: readonly AgentToolStep[],
  read: (id: string) => CustomCodeRoot | undefined,
): { readonly ok: true; readonly trees: ReadonlyMap<string, CustomCodeRoot> } | { readonly ok: false; readonly error: string } {
  const trees = new Map<string, CustomCodeRoot>();
  const current = (id: string): CustomCodeRoot | undefined => trees.get(id) ?? read(id);
  for (const step of steps) {
    if (!isTreeCommand(step.command)) continue;
    const result = applyTreeStep(step, current);
    if (!result.ok) return { ok: false, error: result.error };
    for (const [id, tree] of result.writes) trees.set(id, tree);
  }
  return { ok: true, trees };
}

/**
 * For plan expansion: the region trees a tree command leaves, so a LATER tool
 * reads them instead of the pre-plan tree. Empty for any other step, and for a
 * step that would be refused (the door reports it; nothing to fold).
 *
 * The one-line wiring P11 adds to expand.ts `remember(step)`:
 *   for (const [id, tree] of treeWritesOf(step, (id) => readProp(id, 'tree'))) written.set(slot(id, 'tree'), tree);
 */
export function treeWritesOf(
  step: unknown,
  readTreeProp: (id: string) => unknown,
): ReadonlyMap<string, CustomCodeRoot> {
  if (!isRecord(step) || !isTreeCommand(step['command']) || !isRecord(step['args'])) return new Map();
  const result = applyTreeStep(
    { command: step['command'], args: step['args'] },
    (id) => asTreeRoot(readTreeProp(id)),
  );
  return result.ok ? result.writes : new Map();
}
