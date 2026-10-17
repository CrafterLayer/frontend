import { applyStyleIntents, STYLE_PROPERTIES } from '@craftkit/builder-schema';

import { defineAgentTool, type AgentToolContext, type AgentToolRun } from '../tools/agent/types';
import { no, ok, parseAddress, resolveElement, stepTitle, strictRecord, type ElementAddress, type Parsed } from './address';
import { finish, step } from './finish';
import { parseStyleEntries, type ParsedStyles } from './style-value';

/**
 * element.style — set any style property on one element by NAME, through the
 * same class-patch engine the panel and the quick bar use (DESIGN §A.3, D3),
 * in free mode (agent trees take exact values and palette colours). The
 * engine replaces the property's whole family at that bucket and state and
 * writes one canonical, logical class, so the agent never rewrites className.
 *
 * Expands to ONE `patchTreeNode` (className, plus `dir` when `direction` is set).
 */

export type ElementStyleInput = ElementAddress & { readonly styles: ParsedStyles };

const KEYS = ['id', 'path', 'find', 'styles'] as const;

function parse(input: unknown): Parsed<ElementStyleInput> {
  const record = strictRecord(input, KEYS, '{"id","path"|"find","styles":[{property,value,bucket?,state?,side?}]}');
  if (!record.ok) return record;
  const address = parseAddress(record.value);
  if (!address.ok) return address;
  const styles = parseStyleEntries(record.value['styles']);
  if (!styles.ok) return styles;
  return ok({ ...address.value, styles: styles.value });
}

function run(input: ElementStyleInput, context: AgentToolContext): AgentToolRun {
  const target = resolveElement(context, input);
  if (!target.ok) return target;
  const { node, path, id } = target.value;
  if (node.kind === 'component') {
    return no(`the node at [${path.join(',')}] is a component, which takes no classes · style it through its props, or wrap it with element.wrap and style the wrapper.`);
  }
  const set: Record<string, unknown> = {};
  const attributes: Record<string, string | null> = {};
  if (input.styles.intents.length > 0) {
    const result = applyStyleIntents(node.className ?? '', input.styles.intents, { mode: 'free' });
    if (!result.ok) return no(`${result.message} · send another value, or a token from the theme.`);
    const next = result.className.trim();
    if (next !== (node.className ?? '').trim()) set['className'] = next === '' ? null : next;
  }
  if (input.styles.dir !== undefined) {
    if (node.kind !== 'element') return no('only an element takes a text direction · drop the direction entry.');
    if ((node.attributes?.dir ?? null) !== input.styles.dir) attributes['dir'] = input.styles.dir;
  }
  if (Object.keys(set).length === 0 && Object.keys(attributes).length === 0) {
    return no('nothing to change · the element already has these styles.');
  }
  const names = [...new Set(input.styles.intents.map((intent) => STYLE_PROPERTIES[intent.property].labels.en))];
  if (input.styles.dir !== undefined) names.push('Text direction');
  return finish(
    context,
    [
      step('patchTreeNode', {
        id,
        path: [...path],
        ...(Object.keys(set).length === 0 ? {} : { set }),
        ...(Object.keys(attributes).length === 0 ? {} : { attributes }),
      }),
    ],
    stepTitle(names.length > 3 ? 'Style' : names.join(', '), node),
  );
}

export const elementStyleTool = defineAgentTool<ElementStyleInput>({
  name: 'element.style',
  lanes: ['edit', 'section'],
  summary: 'Style one element by property name',
  signature: '{id,path|find,styles:[{property,value,bucket?,state?,side?}]}',
  parse,
  run,
});
