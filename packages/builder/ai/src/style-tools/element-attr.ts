import {
  CUSTOM_CODE_EFFECTS,
  CUSTOM_CODE_EFFECT_PREFIX,
  customCodeAttributeProblem,
  isCustomCodeEffect,
  type CustomCodeEffect,
} from '@craftkit/builder-schema';

import { isRecord } from '../tools/agent/shared';
import { defineAgentTool, type AgentToolContext, type AgentToolRun } from '../tools/agent/types';
import { no, ok, parseAddress, resolveElement, stepTitle, strictRecord, type ElementAddress, type Parsed } from './address';
import { finish, step } from './finish';

// ── element.attr ───────────────────────────────────────────────────────────────

/**
 * element.attr — set or remove attributes on one element (href, alt, id,
 * aria-*, loading, popovertarget, form attributes …). `null` removes. The door
 * judges every name and value against the element vocabulary for that tag,
 * so a refused attribute comes back with the reason. Classes go through
 * element.style / element.effect, animation through element.animate.
 */

export type ElementAttrInput = ElementAddress & { readonly set: Readonly<Record<string, string | null>> };

const ATTR_KEYS = ['id', 'path', 'find', 'set'] as const;
const ROUTED: Readonly<Record<string, string>> = {
  class: 'element.style (or element.effect for ck-fx-*)',
  classname: 'element.style',
  style: 'element.style — there is no style attribute',
  'data-ck-motion': 'element.animate',
  'data-ck-hover': 'element.animate',
};

function parseAttr(input: unknown): Parsed<ElementAttrInput> {
  const record = strictRecord(input, ATTR_KEYS, '{"id","path"|"find","set":{name:value|null}}');
  if (!record.ok) return record;
  const address = parseAddress(record.value);
  if (!address.ok) return address;
  const set = record.value['set'];
  if (!isRecord(set) || Object.keys(set).length === 0) return no('"set" must be an object of attribute names to values (null removes).');
  if (Object.keys(set).length > 30) return no('"set" holds at most 30 attributes per call.');
  const out: Record<string, string | null> = {};
  for (const [name, value] of Object.entries(set)) {
    const routed = ROUTED[name.toLowerCase()];
    if (routed !== undefined) return no(`"${name}" is not set here · use ${routed}.`);
    if (!/^[A-Za-z][\w:-]{0,63}$/u.test(name)) return no(`"${name}" is not an attribute name.`);
    if (value === null) out[name] = null;
    else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      const text = String(value);
      if (text.length > 2_000) return no(`"${name}" must be at most 2000 characters.`);
      out[name] = text;
    } else return no(`"${name}" must be a string, or null to remove it.`);
  }
  return ok({ ...address.value, set: out });
}

function runAttr(input: ElementAttrInput, context: AgentToolContext): AgentToolRun {
  const target = resolveElement(context, input);
  if (!target.ok) return target;
  const { node, path, id } = target.value;
  if (node.kind !== 'element') {
    return no(`the node at [${path.join(',')}] is ${node.kind === 'icon' ? 'an icon' : 'a component'}, which carries no attributes · address the element around it.`);
  }
  const current = node.attributes ?? {};
  const changed: Record<string, string | null> = {};
  for (const [name, value] of Object.entries(input.set)) {
    if (value === null) {
      if (Object.hasOwn(current, name)) changed[name] = null;
      continue;
    }
    const problem = customCodeAttributeProblem(node.tag, name, value);
    if (problem !== undefined) return no(problem);
    if (current[name as keyof typeof current] !== value) changed[name] = value;
  }
  if (Object.keys(changed).length === 0) return no('nothing to change · the element already has these attributes.');
  return finish(
    context,
    [step('patchTreeNode', { id, path: [...path], attributes: changed })],
    stepTitle(`Attributes ${Object.keys(changed).join(', ')}`.slice(0, 60), node),
  );
}

export const elementAttrTool = defineAgentTool<ElementAttrInput>({
  name: 'element.attr',
  lanes: ['edit', 'section'],
  summary: 'Set or remove element attributes',
  signature: '{id,path|find,set:{name:value|null}}',
  parse: parseAttr,
  run: runAttr,
});

// ── element.effect ─────────────────────────────────────────────────────────────

/**
 * element.effect — put an effect from the effects library on one element, or
 * take one off (DESIGN §C.1): glass, mesh, noise, grid, dots, retro-grid,
 * spotlight, gradient-border, aurora-bg, text-gradient, ring-glow. Each is a
 * `ck-fx-<name>` hook class whose CSS the renderer ships (with reduced-motion
 * and reduced-transparency fallbacks), so the agent writes a name, not CSS.
 */

export type ElementEffectInput = ElementAddress & {
  readonly add: readonly CustomCodeEffect[];
  readonly remove: readonly CustomCodeEffect[];
};

const EFFECT_KEYS = ['id', 'path', 'find', 'add', 'remove'] as const;

function effectList(value: unknown, key: string): Parsed<CustomCodeEffect[]> {
  if (value === undefined) return ok([]);
  const list = typeof value === 'string' ? [value] : value;
  if (!Array.isArray(list)) return no(`"${key}" is a list of effects: ${CUSTOM_CODE_EFFECTS.join(', ')}.`);
  const out: CustomCodeEffect[] = [];
  for (const entry of list as unknown[]) {
    const name = typeof entry === 'string' ? entry.replace(CUSTOM_CODE_EFFECT_PREFIX, '') : '';
    if (!isCustomCodeEffect(name)) return no(`"${String(entry)}" is not an effect · use one of ${CUSTOM_CODE_EFFECTS.join(', ')}.`);
    if (!out.includes(name)) out.push(name);
  }
  return ok(out);
}

function parseEffect(input: unknown): Parsed<ElementEffectInput> {
  const record = strictRecord(input, EFFECT_KEYS, '{"id","path"|"find","add"?:[fx],"remove"?:[fx]}');
  if (!record.ok) return record;
  const address = parseAddress(record.value);
  if (!address.ok) return address;
  const add = effectList(record.value['add'], 'add');
  if (!add.ok) return add;
  const remove = effectList(record.value['remove'], 'remove');
  if (!remove.ok) return remove;
  if (add.value.length === 0 && remove.value.length === 0) return no('name effects to "add" and/or "remove".');
  const both = add.value.filter((name) => remove.value.includes(name));
  if (both.length > 0) return no(`${both.join(', ')} is in both "add" and "remove" · pick one.`);
  return ok({ ...address.value, add: add.value, remove: remove.value });
}

function runEffect(input: ElementEffectInput, context: AgentToolContext): AgentToolRun {
  const target = resolveElement(context, input);
  if (!target.ok) return target;
  const { node, path, id } = target.value;
  if (node.kind === 'component') return no('a component takes no classes · wrap it with element.wrap and put the effect on the wrapper.');
  const classes = (node.className ?? '').split(/\s+/u).filter((name) => name !== '');
  const drop = new Set(input.remove.map((name) => `${CUSTOM_CODE_EFFECT_PREFIX}${name}`));
  const next = classes.filter((name) => !drop.has(name));
  for (const name of input.add) {
    const cls = `${CUSTOM_CODE_EFFECT_PREFIX}${name}`;
    if (!next.includes(cls)) next.push(cls);
  }
  const className = next.join(' ');
  if (className === classes.join(' ')) return no('nothing to change · the element already has these effects.');
  const what = input.add.length > 0 ? `Effect ${input.add.join(', ')}` : `Remove effect ${input.remove.join(', ')}`;
  return finish(
    context,
    [step('patchTreeNode', { id, path: [...path], set: { className: className === '' ? null : className } })],
    stepTitle(what, node),
  );
}

export const elementEffectTool = defineAgentTool<ElementEffectInput>({
  name: 'element.effect',
  lanes: ['edit', 'section'],
  summary: 'Add or remove effect presets',
  signature: '{id,path|find,add?:[glass|mesh|noise|…],remove?:[…]}',
  parse: parseEffect,
  run: runEffect,
});
