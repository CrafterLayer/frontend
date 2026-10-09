import {
  CUSTOM_CODE_TIMELINE_RECIPES,
  isCustomCodeTimelineRecipe,
  isHostedScene,
  SCENE_DENSITIES,
  SCENE_HOST_TAGS,
  SCENE_PALETTES,
  type CustomCodeTimelineRecipe,
  type HostedScene,
  type MotionSpec,
  type SceneDensity,
  type ScenePalette,
} from '@craftkit/builder-schema';

import { clearTimelinePatch, recipePatch, type TimelinePatch } from '../TimelineRecipePicker/timeline-patch';

/*
  ── Engine motion as one value (gsap-pixi fix, 2026-10-08) ─────────────────

  The picker speaks one small value — a cinematic-motion recipe (+ how it
  plays) and an animated background (+ density, colours) — and these helpers
  turn it into what each surface stores:

  - a customCode element: `data-ck-timeline/scrub/scene/density/palette`
    attributes (one patch; a recipe removes `data-ck-motion` in the same patch);
  - a registered block's PART: only `data-ck-timeline/scrub`, which the part
    bar model stores in `partStyles` (never an attribute of the block);
  - a registered section: the `motion` prop (`MotionSpec`), merged, never
    replaced; choosing a recipe drops `reveal` (one animation per element).
*/

/** What the engine plays on one element. Absent keys are "none". */
export interface EngineMotionValue {
  readonly timeline?: CustomCodeTimelineRecipe | undefined;
  /** true: with the scrollbar; false: once on enter; absent: as the recipe plays. */
  readonly scrub?: boolean | undefined;
  readonly scene?: HostedScene | undefined;
  readonly density?: SceneDensity | undefined;
  readonly palette?: ScenePalette | undefined;
}

/** The kinds of element a recipe list is narrowed for (the quick bar's kinds). */
export type EngineMotionKind = 'text' | 'media' | 'link' | 'container' | 'icon' | 'component';

const TEXT_RECIPES: readonly CustomCodeTimelineRecipe[] = ['fade-in', 'slide-in', 'split-reveal'];
const MEDIA_RECIPES: readonly CustomCodeTimelineRecipe[] = ['fade-in', 'slide-in', 'scrub-scale', 'parallax-depth'];
const LINK_RECIPES: readonly CustomCodeTimelineRecipe[] = ['fade-in', 'slide-in'];
/** The plain entrances first, then the schema's order. */
const ALL_RECIPES: readonly CustomCodeTimelineRecipe[] = [
  'fade-in',
  'slide-in',
  ...CUSTOM_CODE_TIMELINE_RECIPES.filter((name) => name !== 'fade-in' && name !== 'slide-in'),
];

export interface EngineRecipeOptions {
  /** The element is a marquee (`data-ck-behavior="marquee"`): `velocity-marquee` fits it. */
  readonly marquee?: boolean | undefined;
  /** The recipe stored now: always offered, so the picker can show it. */
  readonly current?: CustomCodeTimelineRecipe | undefined;
}

/**
 * The recipes that make sense on one kind of element: words for text, depth
 * and scale for media, a plain entrance for a button, everything (but the
 * marquee recipe, unless it is a marquee) for a container or a section.
 */
export function engineRecipesFor(
  kind: EngineMotionKind,
  options: EngineRecipeOptions = {},
): readonly CustomCodeTimelineRecipe[] {
  const base =
    kind === 'text'
      ? TEXT_RECIPES
      : kind === 'media'
        ? MEDIA_RECIPES
        : kind === 'link'
          ? LINK_RECIPES
          : kind === 'container'
            ? ALL_RECIPES.filter((name) => name !== 'velocity-marquee' || options.marquee === true)
            : [];
  const current = options.current;
  return current === undefined || base.includes(current) ? base : [...base, current];
}

/** Whether a customCode tag can carry an animated background (a `div` layer or a sectioning element). */
export function isSceneHostTag(tag: string): boolean {
  return tag === 'div' || (SCENE_HOST_TAGS as readonly string[]).includes(tag);
}

function oneOf<T extends string>(list: readonly T[], value: string | undefined): T | undefined {
  return value !== undefined && (list as readonly string[]).includes(value) ? (value as T) : undefined;
}

/** A value with no `undefined` keys (the document is JSON; absence is "none"). */
export function engineMotionValue(value: EngineMotionValue): EngineMotionValue {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

/** Read the engine motion of a customCode element's attributes (only hosted scenes count). */
export function engineMotionOfAttributes(
  attributes: Readonly<Record<string, string | undefined>> | undefined,
): EngineMotionValue {
  const read = attributes ?? {};
  const timeline = read['data-ck-timeline'];
  const scrub = read['data-ck-scrub'];
  const scene = read['data-ck-scene'];
  const hosted = scene !== undefined && isHostedScene(scene) ? scene : undefined;
  return engineMotionValue({
    timeline: timeline !== undefined && isCustomCodeTimelineRecipe(timeline) ? timeline : undefined,
    scrub: scrub === 'true' ? true : scrub === 'false' ? false : undefined,
    scene: hosted,
    density: hosted === undefined ? undefined : oneOf(SCENE_DENSITIES, read['data-ck-density']),
    palette: hosted === undefined ? undefined : oneOf(SCENE_PALETTES, read['data-ck-palette']),
  });
}

/**
 * The attribute patch that takes a customCode element from what it stores to
 * `next` — ONE patch for one transaction. A new recipe removes any CSS preset
 * (`data-ck-motion`) and its preset-only params; a cleared recipe takes its
 * reused params with it; a cleared scene takes its density and colours.
 * Nothing changed ⇒ an empty patch.
 */
export function engineMotionAttributePatch(
  attributes: Readonly<Record<string, string | undefined>> | undefined,
  next: EngineMotionValue,
): TimelinePatch {
  const read = attributes ?? {};
  const before = engineMotionOfAttributes(read);
  const patch: Record<string, string | null> = {};
  if (next.timeline !== before.timeline) {
    if (next.timeline === undefined) Object.assign(patch, clearTimelinePatch(read));
    else Object.assign(patch, recipePatch(next.timeline, next.scrub) ?? {});
  } else if (next.timeline !== undefined && next.scrub !== before.scrub) {
    patch['data-ck-scrub'] = next.scrub === undefined ? null : String(next.scrub);
  }
  if (next.scene !== before.scene || next.density !== before.density || next.palette !== before.palette) {
    if (next.scene === undefined) {
      if (before.scene !== undefined) {
        patch['data-ck-scene'] = null;
        patch['data-ck-density'] = null;
        patch['data-ck-palette'] = null;
      }
    } else {
      patch['data-ck-scene'] = next.scene;
      patch['data-ck-density'] = next.density ?? null;
      patch['data-ck-palette'] = next.palette ?? null;
    }
  }
  return patch;
}

/**
 * The patch a registered PART takes: only its recipe and how it plays (the
 * part bar model stores them in `partStyles`). A part has no scene.
 */
export function engineMotionPartPatch(next: EngineMotionValue): TimelinePatch {
  return {
    'data-ck-timeline': next.timeline ?? null,
    'data-ck-scrub': next.timeline === undefined || next.scrub === undefined ? null : String(next.scrub),
  };
}

/** Read the engine motion of a registered section's `motion` prop. */
export function engineMotionOfSpec(spec: MotionSpec | undefined): EngineMotionValue {
  if (spec === undefined) return {};
  return engineMotionValue({
    timeline: spec.timeline,
    scrub: spec.timeline === undefined ? undefined : spec.scrub,
    scene: spec.scene,
    density: spec.scene === undefined ? undefined : spec.sceneDensity,
    palette: spec.scene === undefined ? undefined : spec.scenePalette,
  });
}

const ENGINE_SPEC_KEYS: ReadonlySet<string> = new Set(['timeline', 'scrub', 'scene', 'sceneDensity', 'scenePalette']);

/**
 * The `motion` prop with `next` merged in (every other key kept). A recipe
 * newly chosen drops `reveal` — the section would otherwise carry two
 * animations, and the renderer plays only the recipe. Clearing removes keys.
 */
export function specWithEngineMotion(spec: MotionSpec | undefined, next: EngineMotionValue): MotionSpec {
  const before = engineMotionOfSpec(spec);
  const dropReveal = next.timeline !== undefined && next.timeline !== before.timeline;
  const kept = Object.entries(spec ?? {}).filter(
    ([key, value]) => value !== undefined && !ENGINE_SPEC_KEYS.has(key) && !(dropReveal && key === 'reveal'),
  );
  const added: [string, unknown][] = [];
  if (next.timeline !== undefined) {
    added.push(['timeline', next.timeline]);
    if (next.scrub !== undefined) added.push(['scrub', next.scrub]);
  }
  if (next.scene !== undefined) {
    added.push(['scene', next.scene]);
    if (next.density !== undefined) added.push(['sceneDensity', next.density]);
    if (next.palette !== undefined) added.push(['scenePalette', next.palette]);
  }
  return Object.fromEntries([...kept, ...added]);
}
