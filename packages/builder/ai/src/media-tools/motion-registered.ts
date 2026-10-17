import {
  MOTION_PROP,
  partStyleKey,
  partStylesKeyOf,
  readPartStyles,
  timelineLabel,
  type CustomCodeTimelineRecipe,
  type JsonValue,
} from '@craftkit/builder-schema';

import { blockDisplayName, partBlockOf, resolvePartAddress, resolvePartName } from '../style-tools/part-address';
import { declaresProp, isRecord, readTree } from '../tools/agent/shared';
import type { AgentToolContext, AgentToolRun } from '../tools/agent/types';
import { mediaLocale } from './resolve-images';

/**
 * gsap-pixi (2026-10-08): motion.add on a REGISTERED block (diagnosis blocker
 * 11). A registered section keeps its motion in ONE prop, so the timeline is
 * ONE setProp:
 *
 * - no `part`: merge `timeline` (+ `scrub`) into the block's `motion` prop
 *   (MotionSpec) and drop its CSS `reveal` — one animation per element;
 * - `part` (a declared part name, alias or label, `index` for one instance of
 *   a repeated part): merge `timeline` (+ `scrub`) into that part's entry of the
 *   block's `partStyles` prop, the same one-setProp write the quick bar's
 *   part model makes (`editClasses`).
 *
 * The door judges the value against the block's own schema, so a recipe the
 * vocabulary lacks can never be stored.
 */

export interface BlockMotionInput {
  readonly id: string;
  readonly find?: string | undefined;
  readonly path?: readonly number[] | undefined;
  readonly part?: string | undefined;
  readonly index?: readonly number[] | undefined;
  readonly recipe: CustomCodeTimelineRecipe;
  readonly scrub?: boolean | undefined;
}

function no(error: string): AgentToolRun {
  return { ok: false, error };
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${stable(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function partMenu(parts: Readonly<Record<string, unknown>>): string {
  const names = Object.keys(parts);
  return names.length === 0 ? '(none)' : names.slice(0, 10).join(', ');
}

/**
 * The run for a registered block, or undefined when `input.id` is not one (a
 * composed region, or no node at all: the region path answers those).
 */
export function runBlockMotion(input: BlockMotionInput, context: AgentToolContext): AgentToolRun | undefined {
  const { kernel } = context;
  const nodes = kernel.getDocument().nodes;
  if (!Object.hasOwn(nodes, input.id)) return undefined;
  const node = nodes[input.id];
  if (node === undefined || node.type === 'customCode' || readTree(context, input.id) !== undefined) return undefined;
  const schema = kernel.context.registry.block(node.type)?.schema;
  if (schema === undefined) return undefined;
  const name = blockDisplayName(node.type);
  const parts = schema.parts ?? {};
  if (input.find !== undefined || input.path !== undefined) {
    return no(
      `"${input.id}" is a registered ${name} block, not a composed region: drop "find"/"path" and send "part" (one of: ${partMenu(parts)}) for one of its elements, or neither for the whole section.`,
    );
  }
  if (input.recipe === 'velocity-marquee') {
    return no('velocity-marquee speeds up a composed marquee (data-ck-behavior="marquee"); on a registered block use stagger-in, fade-in or slide-in.');
  }
  const label = timelineLabel(input.recipe);
  const title = mediaLocale(context) === 'ar' ? label.ar : label.en;

  if (input.part === undefined) {
    if (!declaresProp(kernel, input.id, MOTION_PROP)) {
      return no(
        `${name} "${input.id}" has no motion setting · send "part" (one of: ${partMenu(parts)}) to animate one of its elements, or choose a section block.`,
      );
    }
    const current = context.readProp(input.id, MOTION_PROP);
    const base: Record<string, unknown> = isRecord(current) ? { ...current } : {};
    const next: Record<string, unknown> = { ...base, timeline: input.recipe };
    // One animation per element: the timeline replaces the CSS reveal, and a scrub belongs to the recipe it was set with.
    delete next['reveal'];
    delete next['scrub'];
    if (input.scrub !== undefined) next['scrub'] = input.scrub;
    if (stable(base) === stable(next)) return no(`${name} "${input.id}" already plays ${input.recipe}.`);
    return {
      ok: true,
      steps: [{ command: 'setProp', args: { id: input.id, key: MOTION_PROP, value: next }, title }],
      note: `timeline ${input.recipe} on ${input.id}`,
    };
  }

  const block = partBlockOf(kernel, input.id, context.readProp);
  if (!block.ok) return block;
  const stylesKey = partStylesKeyOf(schema.props);
  if (stylesKey === undefined) return no(`${name} "${input.id}" keeps no part styles · drop "part" to animate the whole section.`);
  const part = resolvePartName(block.value, input.part);
  if (!part.ok) return part;
  let key = part.value;
  if (input.index !== undefined && input.index.length > 0) {
    const resolved = resolvePartAddress(kernel, { id: input.id, part: part.value, index: input.index }, context.readProp);
    if (!resolved.ok) return resolved;
    key = partStyleKey(resolved.value.ref, 'this');
  }
  const styles = readPartStyles(block.value.node.props, stylesKey);
  const before = styles[key];
  const entry: Record<string, JsonValue> = {};
  if (before?.className !== undefined) entry['className'] = before.className;
  if (before?.dir !== undefined) entry['dir'] = before.dir;
  entry['timeline'] = input.recipe;
  if (input.scrub !== undefined) entry['scrub'] = input.scrub;
  if (before?.timeline === input.recipe && before.scrub === input.scrub) {
    return no(`"${key}" of ${name} "${input.id}" already plays ${input.recipe}.`);
  }
  const next: Record<string, JsonValue> = {};
  for (const [styleKey, style] of Object.entries(styles)) {
    if (styleKey !== key) next[styleKey] = { ...style } as JsonValue;
  }
  next[key] = entry;
  return {
    ok: true,
    steps: [{ command: 'setProp', args: { id: input.id, key: stylesKey, value: next }, title }],
    note: `timeline ${input.recipe} on ${input.id} ${key}`,
  };
}
