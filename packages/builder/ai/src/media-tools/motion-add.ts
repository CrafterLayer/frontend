import {
  customCodeAttributeProblem,
  CUSTOM_CODE_TIMELINE_RECIPES,
  timelineAttrs,
  timelineLabel,
  type CustomCodeNode,
  type CustomCodeTimelineRecipe,
} from '@craftkit/builder-schema';

import { formatPath, resolveElement, type ElementAddress } from '../style-tools/address';
import { finish, step } from '../style-tools/finish';
import { isRecord } from '../tools/agent/shared';
import { defineAgentTool, type AgentToolContext, type AgentToolParse, type AgentToolRun, type AgentToolStep } from '../tools/agent/types';
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
  readonly recipe: CustomCodeTimelineRecipe;
  readonly scrub?: boolean | undefined;
}

const KEYS = ['id', 'find', 'path', 'recipe', 'scrub'] as const;
const MAX_DEPTH_LAYERS = 6;

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
  return {
    ok: true,
    value: {
      id: id.trim(),
      recipe: recipe as CustomCodeTimelineRecipe,
      ...(typeof find === 'string' ? { find } : {}),
      ...(path === undefined ? {} : { path: path as number[] }),
      ...(scrub === undefined ? {} : { scrub }),
    },
  };
}

function hasDepth(node: CustomCodeNode): boolean {
  if (node.kind === 'icon') return false;
  if (node.kind === 'element' && node.attributes?.['data-ck-depth'] !== undefined) return true;
  return (node.children ?? []).some(hasDepth);
}

function run(input: MotionAddInput, context: AgentToolContext): AgentToolRun {
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
  // parallax-depth moves layers marked 1-3: mark the direct children when nothing is marked yet.
  if (input.recipe === 'parallax-depth' && !(node.children ?? []).some(hasDepth)) {
    let depth = 0;
    for (const [index, child] of (node.children ?? []).entries()) {
      if (child.kind !== 'element' || depth >= MAX_DEPTH_LAYERS) continue;
      steps.push(
        step('patchTreeNode', {
          id: input.id,
          path: [...path, index],
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
  signature: '{id,find?|path?,recipe,scrub?}',
  parse,
  run,
});
