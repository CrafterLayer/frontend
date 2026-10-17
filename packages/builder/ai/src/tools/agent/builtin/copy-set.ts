import {
  fail,
  inputRecord,
  isElement,
  isRecord,
  mapTree,
  okParse,
  readTree,
  regionIds,
  sameText,
  setProp,
  treeNodes,
  unknownKeys,
  type TreeRoot,
} from '../shared';
import { defineAgentTool, type AgentToolContext, type AgentToolRun, type AgentToolStep } from '../types';

/**
 * copy.set — change words, nothing else. Each edit names a text exactly as
 * the page shows it; the ONE element whose text equals it gets the new text,
 * its tag, classes and attributes untouched. Zero or several matches are
 * refused with the reason, so the repair names it better (or adds `id`).
 */

export interface CopySetInput {
  readonly edits: readonly { readonly find: string; readonly text: string }[];
  readonly id?: string;
}

const MAX_EDITS = 20;
const MAX_TEXT = 2_000;

function parse(input: unknown) {
  const record = inputRecord(input);
  if (record === undefined) return fail<CopySetInput>('input must be an object like {"edits":[{"find":"Old","text":"New"}]}.');
  const extra = unknownKeys(record, ['edits', 'id']);
  if (extra.length > 0) return fail<CopySetInput>(`unknown keys ${extra.join(', ')}; use edits and optional id.`);
  const edits = record['edits'];
  if (!Array.isArray(edits) || edits.length === 0 || edits.length > MAX_EDITS) {
    return fail<CopySetInput>(`"edits" must be 1-${String(MAX_EDITS)} items of {"find","text"}.`);
  }
  const out: { find: string; text: string }[] = [];
  for (const [index, edit] of edits.entries()) {
    if (!isRecord(edit) || typeof edit['find'] !== 'string' || typeof edit['text'] !== 'string') {
      return fail<CopySetInput>(`edit ${String(index + 1)} must be {"find":"<exact text>","text":"<new text>"}.`);
    }
    if (edit['find'].trim() === '' || edit['text'].trim() === '') {
      return fail<CopySetInput>(`edit ${String(index + 1)}: find and text must not be empty.`);
    }
    if (edit['text'].length > MAX_TEXT) return fail<CopySetInput>(`edit ${String(index + 1)}: text is over ${String(MAX_TEXT)} characters.`);
    out.push({ find: edit['find'], text: edit['text'] });
  }
  const id = record['id'];
  if (id !== undefined && (typeof id !== 'string' || id === '')) return fail<CopySetInput>('"id" must be a region id.');
  return okParse<CopySetInput>({ edits: out, ...(typeof id === 'string' ? { id } : {}) });
}

function countMatches(tree: TreeRoot, find: string): number {
  return treeNodes(tree).filter((node) => isElement(node) && typeof node.text === 'string' && sameText(node.text, find)).length;
}

function run(input: CopySetInput, context: AgentToolContext): AgentToolRun {
  const scope = input.id === undefined ? regionIds(context) : [input.id];
  const trees = new Map<string, TreeRoot>();
  for (const id of scope) {
    const tree = readTree(context, id);
    if (tree === undefined) {
      return { ok: false, error: `"${id}" is not a composed region on this page; omit id or name a region id.` };
    }
    trees.set(id, tree);
  }
  const changed = new Set<string>();
  for (const [index, edit] of input.edits.entries()) {
    const hits = [...trees].flatMap(([id, tree]) => {
      const count = countMatches(tree, edit.find);
      return count === 0 ? [] : [{ id, count }];
    });
    const total = hits.reduce((sum, hit) => sum + hit.count, 0);
    const where = input.id === undefined ? 'on the page' : `in region "${input.id}"`;
    if (total === 0) {
      return { ok: false, error: `edit ${String(index + 1)}: text "${edit.find}" was not found ${where}; quote an element's whole text exactly.` };
    }
    if (total > 1) {
      return {
        ok: false,
        error: `edit ${String(index + 1)}: text "${edit.find}" is ambiguous (${String(total)} matches in ${hits.map(({ id }) => id).join(', ')}); pass "id" or quote a longer text.`,
      };
    }
    const target = hits[0]?.id ?? '';
    const tree = trees.get(target);
    if (tree === undefined) continue;
    trees.set(
      target,
      mapTree(tree, (node) =>
        isElement(node) && typeof node.text === 'string' && sameText(node.text, edit.find) ? { ...node, text: edit.text } : node,
      ),
    );
    changed.add(target);
  }
  const steps: AgentToolStep[] = scope.filter((id) => changed.has(id)).map((id) => setProp(id, 'tree', trees.get(id)));
  return { ok: true, steps };
}

export const copySetTool = defineAgentTool<CopySetInput>({
  name: 'copy.set',
  lanes: ['edit', 'section'],
  summary: 'Replace exact texts, keep markup',
  signature: '{edits:[{find,text}],id?}',
  parse,
  run,
});
