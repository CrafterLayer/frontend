import {
  CUSTOM_CODE_HOVER_PRESETS,
  CUSTOM_CODE_MOTION_DELAYS,
  CUSTOM_CODE_MOTION_DISTANCES,
  CUSTOM_CODE_MOTION_EASES,
  CUSTOM_CODE_MOTION_PRESETS,
  CUSTOM_CODE_MOTION_SPEEDS,
  CUSTOM_CODE_MOTION_STAGGERS,
  CUSTOM_CODE_MOTION_TRIGGERS,
  isHoverPreset,
  isMotionPreset,
  motionPresetGroup,
  motionTriggerProblem,
} from '@craftkit/builder-schema';

import type { JsonRecord } from '../tools/agent/shared';
import { defineAgentTool, type AgentToolContext, type AgentToolRun } from '../tools/agent/types';
import { no, ok, parseAddress, resolveElement, stepTitle, strictRecord, type ElementAddress, type Parsed } from './address';
import { finish, step } from './finish';

/**
 * element.animate — attach (or remove) an animation by NAME (DESIGN §B.2):
 * `preset` is a `data-ck-motion` preset (entrance, stagger, scroll, loop or
 * text), `hover` a `data-ck-hover` preset, and the params tune them. Every
 * value is a closed enum; the CSS and the behaviours runtime decide what a
 * name does, so the published page ships no animation library (D7) and
 * reduced motion shows the final state.
 *
 * `preset: null` / `hover: null` remove; removing both clears every param.
 * Expands to ONE `patchTreeNode` of attributes.
 */

export interface ElementAnimateFields {
  readonly preset?: string | null;
  readonly hover?: string | null;
  readonly trigger?: string;
  readonly speed?: string;
  readonly delay?: string;
  readonly ease?: string;
  readonly once?: string;
  readonly distance?: string;
  readonly stagger?: string;
  readonly target?: string;
}

export type ElementAnimateInput = ElementAddress & { readonly fields: ElementAnimateFields };

const PARAM_KEYS = ['trigger', 'speed', 'delay', 'ease', 'once', 'distance', 'stagger', 'target'] as const;
const KEYS = ['id', 'path', 'find', 'preset', 'hover', ...PARAM_KEYS] as const;

const ATTRIBUTE: Readonly<Record<(typeof PARAM_KEYS)[number], string>> = {
  trigger: 'data-ck-trigger',
  speed: 'data-ck-speed',
  delay: 'data-ck-delay',
  ease: 'data-ck-ease',
  once: 'data-ck-once',
  distance: 'data-ck-distance',
  stagger: 'data-ck-stagger',
  target: 'data-ck-target',
};

const ENUMS: Readonly<Partial<Record<(typeof PARAM_KEYS)[number], readonly string[]>>> = {
  trigger: CUSTOM_CODE_MOTION_TRIGGERS,
  speed: CUSTOM_CODE_MOTION_SPEEDS,
  delay: CUSTOM_CODE_MOTION_DELAYS,
  ease: CUSTOM_CODE_MOTION_EASES,
  once: ['true', 'false'],
  distance: CUSTOM_CODE_MOTION_DISTANCES,
  stagger: CUSTOM_CODE_MOTION_STAGGERS,
};

function parseName(record: JsonRecord, key: 'preset' | 'hover'): Parsed<string | null | undefined> {
  const value = record[key];
  if (value === undefined || value === null) return ok(value);
  const known = key === 'preset' ? isMotionPreset : isHoverPreset;
  if (typeof value === 'string' && known(value)) return ok(value);
  const list = key === 'preset' ? CUSTOM_CODE_MOTION_PRESETS : CUSTOM_CODE_HOVER_PRESETS;
  return no(`"${key}" is one of ${list.join(', ')}, or null to remove it.`);
}

function parseParam(record: JsonRecord, key: (typeof PARAM_KEYS)[number]): Parsed<string | undefined> {
  const value = record[key];
  if (value === undefined) return ok(undefined);
  const text = typeof value === 'number' || typeof value === 'boolean' ? String(value) : value;
  if (typeof text !== 'string' || text.trim() === '') return no(`"${key}" must be a string.`);
  const allowed = ENUMS[key];
  if (allowed !== undefined && !allowed.includes(text)) return no(`"${key}" is one of ${allowed.join(', ')}.`);
  if (key === 'target' && !/^[A-Za-z][\w-]{0,63}$/u.test(text)) {
    return no('"target" is the id attribute of another element in this region (give that element an id with element.attr first).');
  }
  return ok(text);
}

function parse(input: unknown): Parsed<ElementAnimateInput> {
  const record = strictRecord(input, KEYS, '{"id","path"|"find","preset"?,"hover"?,"trigger"?,…}');
  if (!record.ok) return record;
  const address = parseAddress(record.value);
  if (!address.ok) return address;
  const fields: Record<string, string | null> = {};
  for (const key of ['preset', 'hover'] as const) {
    const parsed = parseName(record.value, key);
    if (!parsed.ok) return parsed;
    if (parsed.value !== undefined) fields[key] = parsed.value;
  }
  for (const key of PARAM_KEYS) {
    const parsed = parseParam(record.value, key);
    if (!parsed.ok) return parsed;
    if (parsed.value !== undefined) fields[key] = parsed.value;
  }
  if (Object.keys(fields).length === 0) return no('name a "preset" or "hover" (or null to remove one), or a param to change.');
  if (typeof fields['preset'] === 'string' && typeof fields['trigger'] === 'string') {
    const problem = motionTriggerProblem(fields['preset'], fields['trigger']);
    if (problem !== undefined) return no(problem);
  }
  if (fields['stagger'] !== undefined && typeof fields['preset'] === 'string' && motionPresetGroup(fields['preset']) !== 'stagger') {
    return no('"stagger" tunes a stagger preset (stagger-up, stagger-fade, stagger-zoom, stagger-grid) on a container · drop it or pick one of those.');
  }
  return ok({ ...address.value, fields });
}

const MOTION_ONLY = ['data-ck-trigger', 'data-ck-distance', 'data-ck-stagger', 'data-ck-target'];
const SHARED = ['data-ck-delay', 'data-ck-ease', 'data-ck-once'];

function run(input: ElementAnimateInput, context: AgentToolContext): AgentToolRun {
  const target = resolveElement(context, input);
  if (!target.ok) return target;
  const { node, path, id } = target.value;
  if (node.kind !== 'element') {
    return no(`the node at [${path.join(',')}] is ${node.kind === 'icon' ? 'an icon' : 'a component'} · animate the element around it (wrap it with element.wrap if it has none).`);
  }
  const current = node.attributes ?? {};
  const has = (name: string): boolean => Object.hasOwn(current, name);
  const attributes: Record<string, string | null> = {};
  const { fields } = input;
  if (fields.preset !== undefined) attributes['data-ck-motion'] = fields.preset;
  if (fields.hover !== undefined) attributes['data-ck-hover'] = fields.hover;
  for (const key of PARAM_KEYS) {
    const value = fields[key];
    if (value !== undefined) attributes[ATTRIBUTE[key]] = value;
  }
  const motionAfter = fields.preset === undefined ? has('data-ck-motion') : fields.preset !== null;
  const hoverAfter = fields.hover === undefined ? has('data-ck-hover') : fields.hover !== null;
  if (!motionAfter && !hoverAfter) {
    const set = Object.entries(attributes).filter(([name, value]) => value !== null && name !== 'data-ck-motion' && name !== 'data-ck-hover');
    if (set.length > 0) {
      return no('these params tune an animation, and this element has none · send "preset" or "hover" with them.');
    }
  }
  if (!motionAfter) {
    for (const name of MOTION_ONLY) if (has(name)) attributes[name] = null;
    if (!hoverAfter) {
      for (const name of SHARED) if (has(name)) attributes[name] = null;
      // speed is shared with the site behaviours (marquee, count-up): keep it for them.
      if (has('data-ck-speed') && !has('data-ck-behavior')) attributes['data-ck-speed'] = null;
    }
  }
  const changed = Object.entries(attributes).filter(([name, value]) =>
    value === null ? has(name) : current[name as keyof typeof current] !== value,
  );
  if (changed.length === 0) return no('nothing to change · the element already animates like that.');
  const what = !motionAfter && !hoverAfter ? 'Remove animation' : 'Animation';
  return finish(
    context,
    [step('patchTreeNode', { id, path: [...path], attributes: Object.fromEntries(changed) })],
    stepTitle(what, node),
  );
}

export const elementAnimateTool = defineAgentTool<ElementAnimateInput>({
  name: 'element.animate',
  lanes: ['edit', 'section'],
  summary: 'Animate one element by preset name',
  signature: '{id,path|find,preset?,hover?,trigger?,speed?,delay?,ease?,once?,distance?,stagger?,target?}',
  parse,
  run,
});
