import {
  customCodeAttributeProblem,
  CUSTOM_CODE_TIMELINE_RECIPES,
  timelineAttrs,
  timelineLabel,
  type CustomCodeNode,
  type CustomCodeTimelineRecipe,
} from '@craftkit/builder-schema';

import { formatPath, nodesWithPaths, resolveElement, type ElementAddress } from '../style-tools/address';
import { finish, step } from '../style-tools/finish';
// gsap-pixi additions (2026-10-08)
import { parsePartIndex } from '../style-tools/part-address';
import { isRecord, readTree } from '../tools/agent/shared';
import { defineAgentTool, type AgentToolContext, type AgentToolParse, type AgentToolRun, type AgentToolStep } from '../tools/agent/types';
import { runBlockMotion } from './motion-registered';
// end gsap-pixi additions
import { mediaLocale } from './resolve-images';

/**
 * motion.add — a named cinematic scroll timeline on an EXISTING element
 * (media-motion DESIGN §C.4, §F.2). The model names a recipe; our fixed
 * runner plays it (GSAP behind an engine-neutral marker, loaded only on pages
 * that use one, never under reduced motion). The element is found like
 * `behavior.attach` finds it — by its exact text or src — or by `path`, or is
 * the region's outer element when neither is given. One `patchTreeNode` sets
 * `data-ck-timeline` (+ `data-ck-scrub`) and removes `data-ck-motion` and the
 * preset-only params in the same step (the door refuses the pair).
 */

export interface MotionAddInput {
  readonly id: string;
  readonly find?: string | undefined;
  readonly path?: readonly number[] | undefined;
  // gsap-pixi additions (2026-10-08): a part of a REGISTERED block (`id` is then the block's node id).
  readonly part?: string | undefined;
  readonly index?: readonly number[] | undefined;
  // end gsap-pixi additions
  readonly recipe: CustomCodeTimelineRecipe;
  readonly scrub?: boolean | undefined;
}

// gsap-pixi additions (2026-10-08): + part, index
const KEYS = ['id', 'find', 'path', 'part', 'index', 'recipe', 'scrub'] as const;
const MAX_DEPTH_LAYERS = 12;

function no(error: string): { readonly ok: false; readonly error: string } {
  return { ok: false, error };
}

function parse(input: unknown): AgentToolParse<MotionAddInput> {
  if (!isRecord(input)) return no('input must be {"id","find?","recipe","scrub?"}.');
  const extra = Object.keys(input).filter((key) => !(KEYS as readonly string[]).includes(key));
  if (extra.length > 0) return no(`unknown keys ${extra.join(', ')}; use ${KEYS.join(', ')}.`);
  const { id, find, path, recipe, scrub } = input;
  if (typeof id !== 'string' || id.trim() === '') return no('"id" must be the region id.');
  if (typeof recipe !== 'string' || !(CUSTOM_CODE_TIMELINE_RECIPES as readonly string[]).includes(recipe)) {
    return no(`"recipe" is one of ${CUSTOM_CODE_TIMELINE_RECIPES.join(', ')}.`);
  }
  if (find !== undefined && path !== undefined) return no('name the element with "find" or "path", not both.');
  if (find !== undefined && (typeof find !== 'string' || find.trim() === '')) {
    return no('"find" must be the element\'s exact text or src.');
  }
  if (
    path !== undefined &&
    (!Array.isArray(path) ||
      path.length === 0 ||
      (path as unknown[]).some((entry) => typeof entry !== 'number' || !Number.isInteger(entry) || entry < 0))
  ) {
    return no('"path" must be child indices, e.g. [0,1].');
  }
  if (scrub !== undefined && typeof scrub !== 'boolean') return no('"scrub" is true (tied to the scrollbar) or false (plays once).');
  // gsap-pixi additions (2026-10-08): `part` (+ `index`) names an element of a registered block.
  const { part } = input;
  if (part !== undefined && (typeof part !== 'string' || part.trim() === '')) {
    return no('"part" is a registered block\'s part name, e.g. "heading" or "items".');
  }
  if (part !== undefined && (find !== undefined || path !== undefined)) {
    return no('name the element with "part" (a registered block) or "find"/"path" (a composed region), not both.');
  }
  const index = parsePartIndex(input['index']);
  if (!index.ok) return index;
  if (index.value !== undefined && part === undefined) return no('"index" picks one instance of a repeated "part": send "part" too.');
  // end gsap-pixi additions
  return {
    ok: true,
    value: {
      id: id.trim(),
      recipe: recipe as CustomCodeTimelineRecipe,
      ...(typeof find === 'string' ? { find } : {}),
      ...(path === undefined ? {} : { path: path as number[] }),
      // gsap-pixi additions (2026-10-08)
      ...(typeof part === 'string' ? { part: part.trim() } : {}),
      ...(index.value === undefined ? {} : { index: index.value }),
      // end gsap-pixi additions
      ...(scrub === undefined ? {} : { scrub }),
    },
  };
}

/*
  media-motion fix pass (2026-10-06): parallax-depth on a gallery section marked
  only the container, and the whole grid moved together 2 px. Depth (and a
  stagger) belongs on the REPEATED items — the cards, figures, list items.
*/
/** Whether these siblings read as one list: 3+ of one tag, or 2+ with the same classes. */
function looksRepeated(children: readonly CustomCodeNode[]): boolean {
  const elements = children.filter((child) => child.kind === 'element');
  if (elements.length < 2) return false;
  const byTag = new Map<string, number>();
  const byClass = new Map<string, number>();
  for (const child of elements) {
    byTag.set(child.tag, (byTag.get(child.tag) ?? 0) + 1);
    const classes = (child.className ?? '').trim();
    if (classes !== '') byClass.set(classes, (byClass.get(classes) ?? 0) + 1);
  }
  return [...byTag.values()].some((count) => count >= 3) || [...byClass.values()].some((count) => count >= 2);
}

/**
 * The first container at or under `node` whose children are a repeated list,
 * as a path relative to `node` ([] is `node` itself); undefined when none is.
 */
export function repeatedItemsPath(node: CustomCodeNode): readonly number[] | undefined {
  if (node.kind !== 'element') return undefined;
  if (looksRepeated(node.children ?? [])) return [];
  const hit = nodesWithPaths({ kind: 'root', children: node.children ?? [] }).find(
    ({ node: inner }) => inner.kind === 'element' && looksRepeated(inner.children ?? []),
  );
  return hit?.path;
}

function nodeAt(node: CustomCodeNode, path: readonly number[]): CustomCodeNode | undefined {
  let current: CustomCodeNode | undefined = node;
  for (const index of path) {
    if (current === undefined || current.kind === 'icon') return undefined;
    current = current.children?.[index];
  }
  return current;
}
// end media-motion fix pass

function hasDepth(node: CustomCodeNode): boolean {
  if (node.kind === 'icon') return false;
  if (node.kind === 'element' && node.attributes?.['data-ck-depth'] !== undefined) return true;
  return (node.children ?? []).some(hasDepth);
}

function run(input: MotionAddInput, context: AgentToolContext): AgentToolRun {
  // gsap-pixi additions (2026-10-08): a registered block takes ONE setProp (motion, or partStyles for a part).
  const block = runBlockMotion(input, context);
  if (block !== undefined) return block;
  if (input.part !== undefined && readTree(context, input.id) !== undefined) {
    return no(`"part" names an element of a registered block; "${input.id}" is a composed region · use "find" (its exact text) or "path".`);
  }
  // end gsap-pixi additions
  const address: ElementAddress =
    input.find !== undefined
      ? { id: input.id, find: input.find }
      : { id: input.id, path: input.path ?? [0] };
  const target = resolveElement(context, address);
  if (!target.ok) return target;
  const { node, path } = target.value;
  if (node.kind !== 'element') return no(`${formatPath(path)} is not an element; a timeline goes on a section, heading, image or container.`);
  if (input.recipe === 'velocity-marquee' && node.attributes?.['data-ck-behavior'] !== 'marquee') {
    return no('velocity-marquee speeds up an existing marquee: put it on the element with data-ck-behavior="marquee".');
  }
  const patch = timelineAttrs(input.recipe, { scrub: input.scrub });
  if ('error' in patch) return no(patch.error);
  const current = node.attributes ?? {};
  const attributes: Record<string, string | null> = {};
  for (const [name, value] of Object.entries(patch)) {
    if (value === null) {
      if (current[name as keyof typeof current] !== undefined) attributes[name] = null;
      continue;
    }
    const problem = customCodeAttributeProblem(node.tag, name, value);
    if (problem !== undefined) return no(problem);
    if (current[name as keyof typeof current] !== value) attributes[name] = value;
  }
  const steps: AgentToolStep[] = [];
  if (Object.keys(attributes).length > 0) steps.push(step('patchTreeNode', { id: input.id, path: [...path], attributes }));
  // parallax-depth moves layers marked 1-3: mark the repeated items (else the direct children) when nothing is marked yet.
  if (input.recipe === 'parallax-depth' && !(node.children ?? []).some(hasDepth)) {
    const listAt = repeatedItemsPath(node) ?? [];
    const list = nodeAt(node, listAt) ?? node;
    let depth = 0;
    for (const [index, child] of (list.kind === 'icon' ? [] : (list.children ?? [])).entries()) {
      if (child.kind !== 'element' || depth >= MAX_DEPTH_LAYERS) continue;
      steps.push(
        step('patchTreeNode', {
          id: input.id,
          path: [...path, ...listAt, index],
          attributes: { 'data-ck-depth': String((depth % 3) + 1) },
        }),
      );
      depth += 1;
    }
  }
  if (steps.length === 0) return no(`the element already plays ${input.recipe}.`);
  const label = timelineLabel(input.recipe);
  return finish(context, steps, mediaLocale(context) === 'ar' ? label.ar : label.en, `timeline ${input.recipe}`);
}

export const motionAddTool = defineAgentTool<MotionAddInput>({
  name: 'motion.add',
  lanes: ['edit', 'build'],
  summary: 'Cinematic scroll animation on an element',
  // gsap-pixi additions (2026-10-08): `part` (+ `index`) on a registered block; no address = the whole section.
  signature: '{id,find?|path?|part?,recipe,scrub?}',
  parse,
  run,
});
