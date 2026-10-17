import { isLucideIconName } from '@craftkit/builder-schema';

import { fail, inputRecord, isIcon, mapTree, okParse, readTree, setProp, treeNodes, unknownKeys } from '../shared';
import { defineAgentTool, type AgentToolContext, type AgentToolRun } from '../types';

/**
 * icon.set — swap a Lucide icon by name. The icon is found by its current
 * name (or its label); the new name must exist in the Lucide set, which the
 * door would check anyway, so the refusal comes here, with the fix.
 */

export interface IconSetInput {
  readonly id: string;
  readonly find: string;
  readonly icon: string;
}

function parse(input: unknown) {
  const record = inputRecord(input);
  if (record === undefined) return fail<IconSetInput>('input must be {"id","find","icon"}.');
  const extra = unknownKeys(record, ['id', 'find', 'icon']);
  if (extra.length > 0) return fail<IconSetInput>(`unknown keys ${extra.join(', ')}; use id, find, icon.`);
  const { id, find, icon } = record;
  if (typeof id !== 'string' || id === '') return fail<IconSetInput>('"id" must be the region id holding the icon.');
  if (typeof find !== 'string' || find.trim() === '') return fail<IconSetInput>('"find" must be the current icon name.');
  if (typeof icon !== 'string' || !isLucideIconName(icon)) {
    return fail<IconSetInput>(`"icon" must be a Lucide name in kebab-case (mail, map-pin, arrow-right); "${String(icon)}" is not one.`);
  }
  return okParse<IconSetInput>({ id, find: find.trim(), icon });
}

function run(input: IconSetInput, context: AgentToolContext): AgentToolRun {
  const tree = readTree(context, input.id);
  if (tree === undefined) return { ok: false, error: `"${input.id}" is not a composed region on this page.` };
  const matches = (node: unknown) => isIcon(node) && (node.name === input.find || node.label === input.find);
  const count = treeNodes(tree).filter(matches).length;
  if (count === 0) return { ok: false, error: `no icon named "${input.find}" in "${input.id}".` };
  const next = mapTree(tree, (node) => (matches(node) ? { ...node, name: input.icon } : node));
  return { ok: true, steps: [setProp(input.id, 'tree', next)] };
}

export const iconSetTool = defineAgentTool<IconSetInput>({
  name: 'icon.set',
  lanes: ['edit', 'section'],
  summary: 'Swap a Lucide icon by name',
  signature: '{id,find:icon,icon}',
  parse,
  run,
});
