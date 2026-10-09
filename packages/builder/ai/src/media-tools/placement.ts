import type { BuilderKernel } from '@craftkit/builder-core';
import {
  // gsap-pixi additions (2026-10-08)
  CUSTOM_CODE_SCENE_INFO,
  HOSTED_SCENES,
  isHostedScene,
  MOTION_PROP,
  type CustomCodeScene,
  type SceneDensity,
  type ScenePalette,
  // end gsap-pixi additions
  mediaRecipeNode,
  mediaRecipeProblems,
  type CustomCodeElement,
  type CustomCodeNode,
  type MediaRecipe,
} from '@craftkit/builder-schema';

import { finish, step } from '../style-tools/finish';
// gsap-pixi additions (2026-10-08)
import { blockDisplayName } from '../style-tools/part-address';
// end gsap-pixi additions
import { liveToolContext } from '../style-tools/run-direct';
import {
  declaresProp,
  isElement,
  isRecord,
  readTree,
  rootChildren,
  rootIdOf,
  type TreeElementNode,
  type TreeRoot,
} from '../tools/agent/shared';
import type { AgentToolContext, AgentToolRun, AgentToolStep } from '../tools/agent/types';
// gsap-pixi additions (2026-10-08)
import { registeredHero } from './registered-sections';
// end gsap-pixi additions
import { mediaLocale } from './resolve-images';

/**
 * Where a media recipe lands (media-motion DESIGN §F.1 "Expansion").
 *
 * - No `into` / `behind`: ONE `insertNode customCode {label, tree, css}` under
 *   the page root, after `after` or before the footer — the `kit.insert` rule
 *   (section-kit/tools.ts), re-stated here so that file stays untouched.
 * - `into: id`: the element-level recipe is appended to that region's content
 *   container with `insertTreeNode`; its CSS is appended to the region's css.
 * - `behind: id`: the layer becomes the FIRST child of the region's outer
 *   element (`insertTreeNode`, or `setTreeNode` over a layer already there),
 *   and one `patchTreeNode` gives the host the classes / behaviour it needs.
 *
 * Every tree step is replayed through the tree door (`finish`) before the
 * plan's door judges it, so a refusal reads in this tool's terms.
 */

function refuse(error: string): AgentToolRun {
  return { ok: false, error };
}

function regionsList(context: AgentToolContext): string {
  const regions = rootChildren(context.kernel).filter((id) => readTree(context, id) !== undefined);
  return regions.slice(0, 12).join(', ') || '(none)';
}

/** The label a new region carries in Layers and the Undo history, in the page language. */
export function recipeLabel(context: AgentToolContext, recipe: MediaRecipe, title?: string): string {
  const own = title?.trim() ?? '';
  const label = own !== '' ? own : mediaLocale(context) === 'ar' ? recipe.label.ar : recipe.label.en;
  return label.slice(0, 80);
}

/** A fresh anchor id for an inserted section, numbered past any id the page already uses. */
export function freshAnchor(context: AgentToolContext, base: string): string {
  const text = JSON.stringify(context.kernel.getDocument().nodes);
  const used = (id: string) => text.includes(`"id":"${id}"`);
  let candidate = base;
  for (let n = 2; used(candidate); n += 1) candidate = `${base}-${String(n)}`;
  return candidate;
}

function isFooterRegion(context: AgentToolContext, id: string): boolean {
  const outer = readTree(context, id)?.children[0];
  return isRecord(outer) && outer['tag'] === 'footer';
}

/**
 * The hero: the first region holding the page's h1, else the first region
 * whose outer element is a `<section>` (a header or nav bar is never the hero).
 * gsap-pixi (2026-10-08): on a page of registered blocks (the playground), the
 * registered `hero` block — a hero inside a background surface included.
 */
export function heroRegionId(context: AgentToolContext): string | undefined {
  const regions = rootChildren(context.kernel).flatMap((id) => {
    const tree = readTree(context, id);
    return tree === undefined ? [] : [{ id, tree }];
  });
  const withH1 = regions.find(({ tree }) => JSON.stringify(tree).includes('"tag":"h1"'));
  if (withH1 !== undefined) return withH1.id;
  // gsap-pixi additions (2026-10-08): a registered `hero` block is the hero before any guess from a region's tag.
  const registered = registeredHero(context.kernel)?.id;
  if (registered !== undefined) return registered;
  // end gsap-pixi additions
  return regions.find(({ tree }) => tree.children.find(isElement)?.tag === 'section')?.id;
}

/** The hero of a live page (the direct readings run before any plan step). */
export function heroOf(kernel: BuilderKernel): string | undefined {
  return heroRegionId(liveToolContext(kernel));
}

function sectionIndex(context: AgentToolContext, after: string | undefined): { index?: number } | string {
  const children = rootChildren(context.kernel);
  if (after !== undefined) {
    const at = children.indexOf(after);
    if (at < 0) return `"after": no section "${after}" on the page; use one of ${children.slice(0, 12).join(', ')}.`;
    return { index: at + 1 };
  }
  // At the end, but never under the footer.
  const footer = children.findIndex((id) => isFooterRegion(context, id));
  return footer >= 0 ? { index: footer } : {};
}

/** The recipe's outer section, carrying a fresh anchor id when it has none. */
function anchored(context: AgentToolContext, recipe: MediaRecipe, anchorBase: string): MediaRecipe {
  const outer = mediaRecipeNode(recipe);
  if (outer.tag !== 'section' || outer.attributes?.id !== undefined) return recipe;
  const node: CustomCodeElement = { ...outer, attributes: { id: freshAnchor(context, anchorBase), ...outer.attributes } };
  return { ...recipe, tree: { ...recipe.tree, children: [node] } };
}

/** A recipe the door would refuse never leaves the tool: the builders' own guard, re-run. */
function recipeProblem(recipe: MediaRecipe): string | undefined {
  const problems = mediaRecipeProblems(recipe);
  return problems.length === 0 ? undefined : `the recipe failed the door: ${problems.slice(0, 3).join('; ')}`;
}

/** ONE `insertNode customCode` step for a standalone recipe. */
export function insertSection(
  context: AgentToolContext,
  recipe: MediaRecipe,
  options: { readonly after?: string | undefined; readonly title?: string | undefined; readonly anchor: string },
): AgentToolRun {
  const problem = recipeProblem(recipe);
  if (problem !== undefined) return refuse(problem);
  const place = sectionIndex(context, options.after);
  if (typeof place === 'string') return refuse(place);
  const placed = anchored(context, recipe, options.anchor);
  const label = recipeLabel(context, placed, options.title);
  return {
    ok: true,
    steps: [
      {
        command: 'insertNode',
        args: {
          type: 'customCode',
          parentId: rootIdOf(context.kernel),
          ...(place.index === undefined ? {} : { index: place.index }),
          props: { label, tree: placed.tree, ...(placed.css === '' ? {} : { css: placed.css }) },
        },
        title: label,
      },
    ],
    note: `media ${options.anchor}`,
  };
}

function outerOf(context: AgentToolContext, id: string): { tree: TreeRoot; outer: TreeElementNode } | string {
  const tree = readTree(context, id);
  if (tree === undefined) return `"${id}" is not a composed region on this page; use one of: ${regionsList(context)}.`;
  const outer = tree.children[0];
  if (!isElement(outer) || tree.children.length !== 1) {
    return `"${id}" has no single outer element to place media in; use kit.insert or another region.`;
  }
  return { tree, outer };
}

/** The region's content container: down from the outer element while it wraps exactly one div. */
function contentPath(outer: TreeElementNode): { path: number[]; count: number } {
  const path = [0];
  let node = outer;
  for (;;) {
    const children = node.children ?? [];
    const only = children.length === 1 ? children[0] : undefined;
    if (only === undefined || !isElement(only) || only.tag !== 'div') break;
    path.push(0);
    node = only;
  }
  return { path, count: node.children?.length ?? 0 };
}

/** The css step that adds the recipe's region CSS to a region, when it is not there yet. */
function cssStep(context: AgentToolContext, id: string, css: string): AgentToolStep[] {
  if (css === '') return [];
  const current = context.readProp(id, 'css');
  const existing = typeof current === 'string' ? current : '';
  if (existing.includes(css)) return [];
  return [{ command: 'setProp', args: { id, key: 'css', value: existing === '' ? css : `${existing}\n${css}` } }];
}

/** Append an element-level recipe to a region's content container. */
export function insertInto(context: AgentToolContext, id: string, recipe: MediaRecipe): AgentToolRun {
  const problem = recipeProblem(recipe);
  if (problem !== undefined) return refuse(problem);
  const found = outerOf(context, id);
  if (typeof found === 'string') return refuse(found);
  const { path, count } = contentPath(found.outer);
  const node = mediaRecipeNode(recipe) as CustomCodeNode;
  const label = recipeLabel(context, recipe);
  const run = finish(context, [step('insertTreeNode', { id, parent: path, index: count, node })], label);
  if (!run.ok) return run;
  return { ...run, steps: [...run.steps, ...cssStep(context, id, recipe.css)] };
}

/** What a host must carry under a layer: classes, and (bg-video) its behaviour. */
export interface LayerHost {
  readonly className: string;
  readonly behavior?: string | undefined;
  /**
   * A see-through layer (particles) goes ABOVE the host's cover photo and
   * scrim; an opaque one (a video, a gradient) between the photo and the
   * scrim, so the text keeps its contrast. Absent: opaque.
   */
  readonly overlay?: boolean | undefined;
}

/*
  media-motion fix pass (2026-10-06): particles placed behind the hero-overlay
  kit were invisible — the layer went in as child [0] with -z-10, and the
  kit's cover img and gradient scrim (also -z-10) came later in the DOM, so
  they painted on top while Pixi drew 120 frames a second under them. Equal
  z-index siblings paint in tree order, so the layer now goes AFTER the
  covers it must show over, with the same -z-10 and below the content.
*/
/** A cover the host already paints under its content: an absolute, negatively stacked photo or scrim. */
function coverKind(node: unknown): 'photo' | 'scrim' | undefined {
  if (!isElement(node) || isLayer(node)) return undefined;
  const classes = (node.className ?? '').split(/\s+/u);
  if (!classes.includes('absolute') || !classes.some((name) => name.startsWith('-z-'))) return undefined;
  return node.tag === 'img' || node.tag === 'picture' || node.tag === 'video' ? 'photo' : 'scrim';
}

/** Where the layer sits among the host's children (the old layer, if any, left out). */
function layerIndex(children: readonly unknown[], overlay: boolean): number {
  let index = 0;
  for (const [at, child] of children.entries()) {
    const kind = coverKind(child);
    if (kind === 'photo' || (kind === 'scrim' && overlay)) index = at + 1;
  }
  return index;
}

/** A first child that is a background layer already: a scene div or a decorative video. */
function isLayer(node: unknown): boolean {
  if (!isElement(node)) return false;
  if (node.attributes?.['data-ck-scene'] !== undefined) return true;
  return node.tag === 'video' && node.attributes?.['aria-hidden'] === 'true';
}

const POSITIONED = /(?:^|\s)(?:relative|absolute|fixed|sticky)(?:\s|$)/u;

function hostClassName(current: string | undefined, wanted: string): string | undefined {
  const classes = (current ?? '').split(/\s+/u).filter((name) => name !== '');
  const missing = wanted
    .split(/\s+/u)
    .filter((name) => name !== '' && !classes.includes(name))
    .filter((name) => name !== 'relative' || !POSITIONED.test(current ?? ''));
  return missing.length === 0 ? undefined : [...classes, ...missing].join(' ');
}

/** Put a layer FIRST inside a region's outer element, and give the host what it needs. */
export function insertBehind(
  context: AgentToolContext,
  id: string,
  recipe: MediaRecipe,
  host: LayerHost,
): AgentToolRun {
  const problem = recipeProblem(recipe);
  if (problem !== undefined) return refuse(problem);
  const found = outerOf(context, id);
  if (typeof found === 'string') return refuse(found);
  const { outer } = found;
  const behavior = outer.attributes?.['data-ck-behavior'];
  if (host.behavior !== undefined && behavior !== undefined && behavior !== host.behavior) {
    return refuse(`"${id}" already runs data-ck-behavior "${behavior}"; a background video needs the section's behaviour — put it on another region or remove "${behavior}" first.`);
  }
  const node = mediaRecipeNode(recipe) as CustomCodeNode;
  const children = outer.children ?? [];
  const existing = children.findIndex(isLayer);
  const others = existing < 0 ? children : children.filter((_child, at) => at !== existing);
  const wanted = layerIndex(others, host.overlay === true);
  const steps: AgentToolStep[] =
    existing === wanted
      ? [step('setTreeNode', { id, path: [0, existing], node })]
      : [
          ...(existing < 0 ? [] : [step('removeTreeNode', { id, path: [0, existing] })]),
          step('insertTreeNode', { id, parent: [0], index: wanted, node }),
        ];
  const className = hostClassName(outer.className, host.className);
  const attributes: Record<string, string | null> = {};
  if (host.behavior !== undefined && behavior !== host.behavior) attributes['data-ck-behavior'] = host.behavior;
  // A scene replacing a background video: the host's bg-video behaviour has nothing left to play.
  if (host.behavior === undefined && behavior === 'bg-video') attributes['data-ck-behavior'] = null;
  if (className !== undefined || Object.keys(attributes).length > 0) {
    steps.push(
      step('patchTreeNode', {
        id,
        path: [0],
        ...(className === undefined ? {} : { set: { className } }),
        ...(Object.keys(attributes).length === 0 ? {} : { attributes }),
      }),
    );
  }
  const run = finish(context, steps, recipeLabel(context, recipe));
  if (!run.ok) return run;
  return { ...run, steps: [...run.steps, ...cssStep(context, id, recipe.css)] };
}

// gsap-pixi additions (2026-10-08)
/** What a scene behind a registered block is asked for. */
export interface BlockSceneRequest {
  readonly scene: CustomCodeScene;
  readonly density?: SceneDensity | undefined;
  readonly palette?: ScenePalette | undefined;
  /** The call named images (a hosted scene draws from the palette, never from images). */
  readonly images?: boolean | undefined;
}

/**
 * A scene behind a REGISTERED block (diagnosis blocker 11): a registered
 * section has no tree to insert a layer into, so the scene goes into its
 * `motion` prop (`scene`, `sceneDensity`, `scenePalette`) with ONE setProp,
 * and the engine hosts it behind the block's content at runtime. Only the
 * palette scenes (particles, mesh-gradient) can be hosted. Undefined when
 * `id` is not a registered block (a composed region, or no node at all).
 */
export function sceneOnBlock(context: AgentToolContext, id: string, request: BlockSceneRequest): AgentToolRun | undefined {
  const nodes = context.kernel.getDocument().nodes;
  if (!Object.hasOwn(nodes, id)) return undefined;
  const node = nodes[id];
  if (node === undefined || node.type === 'customCode' || readTree(context, id) !== undefined) return undefined;
  if (context.kernel.context.registry.block(node.type) === undefined) return undefined;
  const name = blockDisplayName(node.type);
  if (!isHostedScene(request.scene)) {
    return refuse(
      `"${id}" is a registered ${name} block: only ${HOSTED_SCENES.join(' or ')} can draw behind its content (the ${request.scene} scene needs a composed region's layer) · use one of those, or omit "behind" for a new ${request.scene} section.`,
    );
  }
  if (request.images === true) {
    return refuse(`a ${request.scene} background behind a registered block draws in the theme's colours · drop "images".`);
  }
  if (!declaresProp(context.kernel, id, MOTION_PROP)) {
    return refuse(
      `${name} "${id}" has no motion setting to carry a background · put the scene behind a section block (e.g. the hero), or omit "behind" for a new scene section.`,
    );
  }
  const current = context.readProp(id, MOTION_PROP);
  const base: Record<string, unknown> = isRecord(current) ? { ...current } : {};
  const next: Record<string, unknown> = { ...base, scene: request.scene };
  delete next['sceneDensity'];
  delete next['scenePalette'];
  if (request.density !== undefined) next['sceneDensity'] = request.density;
  if (request.palette !== undefined) next['scenePalette'] = request.palette;
  if (JSON.stringify(Object.entries(base).sort()) === JSON.stringify(Object.entries(next).sort())) {
    return refuse(`${name} "${id}" already has the ${request.scene} background.`);
  }
  const label = CUSTOM_CODE_SCENE_INFO[request.scene].label;
  const title = mediaLocale(context) === 'ar' ? `خلفية متحركة: ${label.ar}` : `Animated background: ${label.en}`;
  return {
    ok: true,
    steps: [{ command: 'setProp', args: { id, key: MOTION_PROP, value: next }, title }],
    note: `scene ${request.scene} behind ${id}`,
  };
}
// end gsap-pixi additions
