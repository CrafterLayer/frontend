import { CUSTOM_CODE_BEHAVIORS, customCodeAttributeProblem } from '@craftkit/builder-schema';

import {
  fail,
  inputRecord,
  isElement,
  isRecord,
  mapTree,
  okParse,
  readTree,
  sameText,
  setProp,
  treeNodes,
  unknownKeys,
  type TreeNode,
} from '../shared';
import { defineAgentTool, type AgentToolContext, type AgentToolRun } from '../types';

/**
 * behavior.attach — give one element a curated site behaviour (reveal,
 * count-up, countdown, marquee, carousel, tabs, lightbox, whatsapp-form …)
 * by setting `data-ck-behavior` and its params. The renderer's runtime
 * (`mountBehaviors`) does the rest; the model never writes a script.
 * The element is the one whose text or src equals `find`.
 */

export interface BehaviorAttachInput {
  readonly id: string;
  readonly find: string;
  readonly behavior: string;
  readonly params?: Readonly<Record<string, string>>;
}

const PARAMS = ['to', 'until', 'speed', 'phone', 'text'] as const;

/** The closed behaviour list, read lazily so a schema without it degrades to a refusal. */
function behaviors(): readonly string[] {
  const list = CUSTOM_CODE_BEHAVIORS as readonly string[] | undefined;
  return list ?? [];
}

function parse(input: unknown) {
  const record = inputRecord(input);
  if (record === undefined) return fail<BehaviorAttachInput>('input must be {"id","find","behavior","params?"}.');
  const extra = unknownKeys(record, ['id', 'find', 'behavior', 'params']);
  if (extra.length > 0) return fail<BehaviorAttachInput>(`unknown keys ${extra.join(', ')}; use id, find, behavior, params.`);
  const { id, find, behavior, params } = record;
  if (typeof id !== 'string' || id === '') return fail<BehaviorAttachInput>('"id" must be the region id.');
  if (typeof find !== 'string' || find.trim() === '') return fail<BehaviorAttachInput>('"find" must be the element\'s exact text or src.');
  const known = behaviors();
  if (typeof behavior !== 'string' || !known.includes(behavior)) {
    return fail<BehaviorAttachInput>(
      known.length === 0 ? 'site behaviours are not available on this build.' : `"behavior" is one of ${known.join(', ')}.`,
    );
  }
  const out: Record<string, string> = {};
  if (params !== undefined) {
    if (!isRecord(params)) return fail<BehaviorAttachInput>(`"params" is an object of ${PARAMS.join(', ')}.`);
    for (const [key, value] of Object.entries(params)) {
      if (!(PARAMS as readonly string[]).includes(key)) return fail<BehaviorAttachInput>(`unknown param "${key}"; params are ${PARAMS.join(', ')}.`);
      if (typeof value !== 'string' && typeof value !== 'number') return fail<BehaviorAttachInput>(`param "${key}" must be a string or number.`);
      out[key] = String(value);
    }
  }
  return okParse<BehaviorAttachInput>({ id, find, behavior, ...(Object.keys(out).length === 0 ? {} : { params: out }) });
}

function matches(node: TreeNode, find: string): boolean {
  if (!isElement(node)) return false;
  if (typeof node.text === 'string' && sameText(node.text, find)) return true;
  return node.attributes?.['src'] === find.trim();
}

function run(input: BehaviorAttachInput, context: AgentToolContext): AgentToolRun {
  const tree = readTree(context, input.id);
  if (tree === undefined) return { ok: false, error: `"${input.id}" is not a composed region on this page.` };
  const hits = treeNodes(tree).filter((node) => matches(node, input.find));
  if (hits.length === 0) return { ok: false, error: `no element in "${input.id}" has text or src "${input.find}".` };
  if (hits.length > 1) return { ok: false, error: `"${input.find}" matches ${String(hits.length)} elements in "${input.id}"; quote a unique text.` };
  const target = hits[0];
  if (!isElement(target)) return { ok: false, error: 'the match is not an element.' };
  const attributes: Record<string, string> = { 'data-ck-behavior': input.behavior };
  for (const [key, value] of Object.entries(input.params ?? {})) attributes[`data-ck-${key}`] = value;
  for (const [name, value] of Object.entries(attributes)) {
    const problem = customCodeAttributeProblem(target.tag, name, value);
    if (problem !== undefined) return { ok: false, error: problem };
  }
  const next = mapTree(tree, (node) =>
    node === target && isElement(node) ? { ...node, attributes: { ...(node.attributes ?? {}), ...attributes } } : node,
  );
  return { ok: true, steps: [setProp(input.id, 'tree', next)] };
}

export const behaviorAttachTool = defineAgentTool<BehaviorAttachInput>({
  name: 'behavior.attach',
  lanes: ['edit', 'section'],
  summary: 'Attach a site behaviour',
  signature: '{id,find:text|src,behavior,params?}',
  parse,
  run,
});
