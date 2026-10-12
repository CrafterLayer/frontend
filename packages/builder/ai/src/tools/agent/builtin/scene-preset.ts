import {
  paramsDiffFromDefaults,
  validateParamValues,
  type CustomCodeJsMeta,
  type CustomCodeJsParams,
  type MediaRecipe,
  type ScriptParamSpec,
} from '@craftkit/builder-schema';

import { propKeys } from '../../../data-tools/data-place';
import { insertSection } from '../../../media-tools/placement';
import {
  SCENE_PRESET_CATEGORIES,
  SCENE_PRESETS,
  scenePreset,
  scenePresetsIn,
  type ScenePreset,
} from '../../../scene-presets/catalog';
import { finish, step } from '../../../style-tools/finish';
import {
  fail,
  inputRecord,
  isArabicLocale,
  isElement,
  isRecord,
  okParse,
  readTree,
  regionIds,
  setProp,
  unknownKeys,
  type TreeElementNode,
} from '../shared';
import {
  defineAgentTool,
  type AgentToolContext,
  type AgentToolParse,
  type AgentToolRun,
  type AgentToolStep,
} from '../types';

/**
 * scene.preset (creative-power Phase 2 F, 2026-10-12) — one of the 30 curated, tested Pixi
 * scenes (scene-presets/catalog.ts) on the page in one step, instead of thousands of tokens of
 * scene code the model would write and the door would then have to repair.
 *
 * The preset lands as a customCode region's page code: `js` is its code as catalogued, `jsMeta`
 * its library reference (builtin tier), name, tags, libs and param spec — so the Studio's scene
 * settings form tunes it — and `jsParams` only the values that differ from its defaults, after
 * `params` is checked against that spec (an unknown key or a wrong type is refused, with the
 * preset's own keys, so the repair round can fix the call).
 *
 * Where (media.add's placement words):
 * - nothing, or `after`: a new scene section — media.add's insert rule (after `after`, else at
 *   the end above the closing call to action and the footer), sized by its width
 *   (aspect-ratio + min/max-height, never vh: the canvas and Preview differ in vh).
 * - `behind` / `into`: the scene fills that composed region behind its content. The canvas is
 *   the region's last child at z-index 0, so the outer element is lifted above it and made
 *   see-through, and the backdrop the scene replaces (a cover photo, a scrim, a media.add
 *   scene layer or background video) is removed — its photo feeds a photo preset's `image`.
 * - `id`: that region's scene is swapped for this one; its id, tree and css stay.
 *
 * It writes page code, so the door refuses it while free code mode is off (validate-plan.ts,
 * the same sentence any other `js` gets) — a tool sees no run options.
 */

export type ScenePlacement = 'after' | 'into' | 'behind' | 'id';

export interface ScenePresetInput {
  readonly preset: ScenePreset;
  /** The `params` given, coerced to the preset's spec (only the keys given). */
  readonly values: CustomCodeJsParams;
  /** Values the spec clamped or cut, said in the note. */
  readonly adjusted: readonly string[];
  readonly place?: { readonly key: ScenePlacement; readonly id: string } | undefined;
}

const KEYS = ['preset', 'after', 'into', 'behind', 'id', 'params'] as const;
const PLACEMENTS: readonly ScenePlacement[] = ['after', 'into', 'behind', 'id'];
const MAX_ID = 120;

/** A new scene section: sized by its width, never by the viewport. */
export const SCENE_SECTION_CSS =
  '.ck-scene{position:relative;width:100%;aspect-ratio:16/9;min-height:320px;max-height:720px}';
/** A region hosting a scene behind its content: the content above the canvas, see-through. */
export const SCENE_HOST_CSS =
  '.ck-scene-host{position:relative;z-index:1;background:transparent;min-height:320px}';
const HOST_CLASS = 'ck-scene-host';

const OPENS_STAGE = /\bck\s*\.\s*(?:stage|scene)\s*\(/u;
const ENGINE_ATTRIBUTES = ['data-ck-scene', 'data-ck-density', 'data-ck-palette'] as const;

/** Every preset id, grouped by category: `mural:a|b … toy:y|z`. */
export function scenePresetMenu(): string {
  return SCENE_PRESET_CATEGORIES.map(
    (category) =>
      `${category}:${scenePresetsIn(category)
        .map(({ id }) => id)
        .join('|')}`,
  ).join(' ');
}

/** The ids sharing the most words with an unknown name, for a refusal that names the near miss. */
function nearIds(name: string): readonly string[] {
  const words = name
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((word) => word.length > 2);
  const scored = SCENE_PRESETS.map(({ id }) => ({
    id,
    shared: id.split('-').filter((part) => words.some((word) => part.startsWith(word))).length,
  })).filter(({ shared }) => shared > 0);
  const best = Math.max(0, ...scored.map(({ shared }) => shared));
  return scored
    .filter(({ shared }) => shared === best)
    .map(({ id }) => id)
    .slice(0, 3);
}

function paramKeys(preset: ScenePreset): string {
  return preset.params.map(({ key }) => key).join(', ');
}

function parseParams(
  preset: ScenePreset,
  raw: unknown,
): AgentToolParse<{ values: CustomCodeJsParams; adjusted: readonly string[] }> {
  if (raw === undefined) return okParse({ values: {}, adjusted: [] });
  if (!isRecord(raw)) {
    return fail(`"params" is an object of ${preset.id}'s settings: ${paramKeys(preset)}.`);
  }
  const { values, issues } = validateParamValues(preset.params, raw);
  const refused = issues.flatMap((issue) => {
    if (issue.code === 'clamped' || issue.code === 'truncated') return [];
    if (issue.code === 'unknown-key') {
      return [
        `"${issue.key}" is not a setting of ${preset.id} (its settings: ${paramKeys(preset)}).`,
      ];
    }
    return [issue.message.en];
  });
  if (refused.length > 0) return fail(`params: ${refused.join(' ')}`);
  const adjusted = issues
    .filter((issue) => issue.code === 'clamped' || issue.code === 'truncated')
    .map((issue) => issue.message.en.replace(/\.$/u, ''));
  return okParse({ values, adjusted });
}

function parse(input: unknown): AgentToolParse<ScenePresetInput> {
  const record = inputRecord(input);
  if (record === undefined) {
    return fail('input must be {"preset":"<id>","after?":"<region id>","params?":{…}}.');
  }
  const extra = unknownKeys(record, KEYS);
  if (extra.length > 0) return fail(`unknown keys ${extra.join(', ')}; use ${KEYS.join(', ')}.`);
  const name = record['preset'];
  if (typeof name !== 'string' || name.trim() === '') {
    return fail(`"preset" is required, one of ${scenePresetMenu()}.`);
  }
  // A title as shown ("Flow-field silk") reads as its id.
  const preset = scenePreset(name.trim().toLowerCase().replace(/\s+/gu, '-'));
  if (preset === undefined) {
    const near = nearIds(name);
    return fail(
      `no scene preset "${name}"${near.length === 0 ? '' : ` (did you mean ${near.join(' or ')}?)`}; use one of ${scenePresetMenu()}.`,
    );
  }
  const places: { key: ScenePlacement; id: string }[] = [];
  for (const key of PLACEMENTS) {
    const value = record[key];
    if (value === undefined) continue;
    if (typeof value !== 'string' || value.trim() === '' || value.length > MAX_ID) {
      return fail(`"${key}" is the node id of a region on the page.`);
    }
    places.push({ key, id: value.trim() });
  }
  if (places.length > 1) {
    return fail(
      'say where with at most one of "after" (a new scene section), "behind"/"into" (the scene fills that region behind its content) or "id" (swap that region\'s scene).',
    );
  }
  const params = parseParams(preset, record['params']);
  if (!params.ok) return params;
  return okParse({ preset, ...params.value, place: places[0] });
}

// ── What the region carries ─────────────────────────────────────────────────

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** The library reference and spec the Studio's scene settings read (never rendered). */
function metaOf(preset: ScenePreset): CustomCodeJsMeta {
  return {
    ref: { tier: 'builtin', id: preset.id, version: preset.entry.version },
    name: { en: preset.title.en, ar: preset.title.ar },
    tags: [...preset.tags],
    params: clone(preset.params) as ScriptParamSpec[],
    libs: [...preset.libs],
  };
}

/** Only what differs from the preset's defaults, as the Studio stores it. */
function storedParams(preset: ScenePreset, values: CustomCodeJsParams): CustomCodeJsParams {
  return clone(paramsDiffFromDefaults(preset.params, { ...preset.defaults, ...values }));
}

function title(context: AgentToolContext, preset: ScenePreset): string {
  return isArabicLocale(context) ? preset.title.ar : preset.title.en;
}

function note(input: ScenePresetInput, where: string, stored: CustomCodeJsParams): string {
  const keys = Object.keys(stored);
  return [
    `scene ${input.preset.id} (${input.preset.category}) ${where}`,
    ...(keys.length === 0 ? [] : [`params ${keys.join(', ')}`]),
    ...input.adjusted,
  ].join(' · ');
}

function codeProps(context: AgentToolContext): readonly string[] | string {
  const keys = propKeys(context.kernel, 'customCode');
  return keys.includes('js')
    ? keys
    : 'this site\'s regions cannot carry page code (no "js" prop): use media.add scene instead.';
}

// ── A new scene section ───────────────────────────────────────────────────────

function insertScene(
  input: ScenePresetInput,
  context: AgentToolContext,
  declared: readonly string[],
): AgentToolRun {
  const { preset } = input;
  const recipe: MediaRecipe = {
    label: { en: preset.title.en, ar: preset.title.ar },
    tree: {
      kind: 'root',
      children: [
        {
          kind: 'element',
          tag: 'section',
          className: 'ck-scene',
          attributes: { 'aria-hidden': 'true' },
        },
      ],
    },
    css: SCENE_SECTION_CSS,
  };
  const placed = insertSection(context, recipe, { after: input.place?.id, anchor: 'scene' });
  if (!placed.ok) return placed;
  const [first, ...rest] = placed.steps;
  /* v8 ignore next -- insertSection always returns its one insertNode step. */
  if (first === undefined) return { ok: false, error: 'nothing to insert.' };
  const stored = storedParams(preset, input.values);
  const props = isRecord(first.args['props']) ? first.args['props'] : {};
  const code: Record<string, unknown> = { js: preset.code };
  if (declared.includes('jsMeta')) code['jsMeta'] = metaOf(preset);
  if (declared.includes('jsParams') && Object.keys(stored).length > 0) code['jsParams'] = stored;
  return {
    ok: true,
    steps: [{ ...first, args: { ...first.args, props: { ...props, ...code } } }, ...rest],
    note: note(
      input,
      input.place === undefined ? 'as a new section' : `after ${input.place.id}`,
      stored,
    ),
  };
}

// ── A scene in a region that is already there ─────────────────────────────────

/** A child the scene replaces: a cover photo or scrim under the content, an engine layer, a bg video. */
function isBackdrop(node: unknown): node is TreeElementNode {
  if (!isElement(node)) return false;
  if (node.attributes?.['data-ck-scene'] !== undefined) return true;
  if (node.tag === 'video' && node.attributes?.['aria-hidden'] === 'true') return true;
  const classes = (node.className ?? '').split(/\s+/u);
  return classes.includes('absolute') && classes.some((name) => /^(?:[\w-]+:)*-z-/u.test(name));
}

/** The https photo a removed cover showed (an img, or the img inside a picture). */
function coverPhoto(nodes: readonly TreeElementNode[]): string | undefined {
  for (const node of nodes) {
    const img =
      node.tag === 'img'
        ? node
        : node.children?.find((child) => isElement(child) && child.tag === 'img');
    const src = isElement(img) ? img.attributes?.['src'] : undefined;
    if (src?.startsWith('https://') === true) return src;
  }
  return undefined;
}

/** The tree steps that turn a region's outer element into a scene host. */
function hostSteps(
  id: string,
  outer: TreeElementNode,
): { readonly steps: readonly AgentToolStep[]; readonly removed: readonly TreeElementNode[] } {
  const children = outer.children ?? [];
  const removed: TreeElementNode[] = [];
  const steps: AgentToolStep[] = [];
  for (let at = children.length - 1; at >= 0; at -= 1) {
    const child = children[at];
    if (!isBackdrop(child)) continue;
    removed.unshift(child);
    steps.push(step('removeTreeNode', { id, path: [0, at] }));
  }
  const classes = (outer.className ?? '').split(/\s+/u).filter((name) => name !== '');
  const attributes: Record<string, null> = {};
  for (const name of ENGINE_ATTRIBUTES)
    if (outer.attributes?.[name] !== undefined) attributes[name] = null;
  if (outer.attributes?.['data-ck-behavior'] === 'bg-video') attributes['data-ck-behavior'] = null;
  if (!classes.includes(HOST_CLASS) || Object.keys(attributes).length > 0) {
    steps.push(
      step('patchTreeNode', {
        id,
        path: [0],
        ...(classes.includes(HOST_CLASS)
          ? {}
          : { set: { className: [...classes, HOST_CLASS].join(' ') } }),
        ...(Object.keys(attributes).length === 0 ? {} : { attributes }),
      }),
    );
  }
  return { steps, removed };
}

function codeSteps(
  context: AgentToolContext,
  id: string,
  preset: ScenePreset,
  stored: CustomCodeJsParams,
  declared: readonly string[],
): AgentToolStep[] {
  const steps = [setProp(id, 'js', preset.code)];
  if (declared.includes('jsMeta')) steps.push(setProp(id, 'jsMeta', metaOf(preset)));
  const before = context.readProp(id, 'jsParams');
  const had = isRecord(before) && Object.keys(before).length > 0;
  if (declared.includes('jsParams') && (had || Object.keys(stored).length > 0)) {
    steps.push(setProp(id, 'jsParams', stored));
  }
  // A region named after the preset it showed is renamed after the one it shows now.
  const meta = context.readProp(id, 'jsMeta');
  const name = isRecord(meta) ? meta['name'] : undefined;
  const old = isRecord(name) ? Object.values(name) : typeof name === 'string' ? [name] : [];
  if (old.includes(context.readProp(id, 'label')))
    steps.push(setProp(id, 'label', title(context, preset)));
  return steps;
}

function sceneInRegion(
  input: ScenePresetInput,
  context: AgentToolContext,
  place: { readonly key: ScenePlacement; readonly id: string },
  declared: readonly string[],
): AgentToolRun {
  const { preset } = input;
  const { id, key } = place;
  const nodes = context.kernel.getDocument().nodes;
  const node = Object.hasOwn(nodes, id) ? nodes[id] : undefined;
  if (node === undefined) {
    return {
      ok: false,
      error: `"${key}": no region "${id}" on the page; use one of ${regionIds(context).slice(0, 12).join(', ') || '(none)'}.`,
    };
  }
  const tree = readTree(context, id);
  if (node.type !== 'customCode' || tree === undefined) {
    return {
      ok: false,
      error: `"${id}" is a ${node.type} block, not a composed region: a scene runs in a customCode region · send "after":"${id}" for a scene section below it, or media.add scene behind it.`,
    };
  }
  const label = `${isArabicLocale(context) ? 'مشهد' : 'Scene'} · ${title(context, preset)}`;
  const current = context.readProp(id, 'js');
  const running = typeof current === 'string' && current.trim() !== '';
  if (running && key !== 'id' && !OPENS_STAGE.test(current)) {
    return {
      ok: false,
      error: `"${id}" already runs its own page code (not a scene), and a region runs one script · "id":"${id}" replaces that code with the scene, or "after":"${id}" adds a scene section below it.`,
    };
  }
  let values = input.values;
  const steps: AgentToolStep[] = [];
  if (!running) {
    const outer = tree.children[0];
    if (!isElement(outer) || tree.children.length !== 1) {
      return {
        ok: false,
        error: `"${id}" has no single outer element to host a scene; send "after":"${id}" for a scene section.`,
      };
    }
    const host = hostSteps(id, outer);
    if (host.steps.length > 0) {
      const tried = finish(context, host.steps, label);
      if (!tried.ok) return tried;
      steps.push(...tried.steps);
    }
    // A photo preset behind a photo hero brings that photo to life.
    const photo = coverPhoto(host.removed);
    const spec = preset.params.find((entry) => entry.key === 'image' && entry.type === 'image');
    if (photo !== undefined && spec !== undefined && values['image'] === undefined) {
      const checked = validateParamValues(preset.params, { image: photo });
      if (checked.issues.length === 0) values = { ...values, ...checked.values };
    }
  }
  const stored = storedParams(preset, values);
  steps.push(...codeSteps(context, id, preset, stored, declared));
  if (!running) {
    const css = context.readProp(id, 'css');
    const existing = typeof css === 'string' ? css : '';
    if (!existing.includes(SCENE_HOST_CSS)) {
      steps.push(
        setProp(
          id,
          'css',
          existing.trim() === '' ? SCENE_HOST_CSS : `${existing}\n${SCENE_HOST_CSS}`,
        ),
      );
    }
  }
  const [first, ...rest] = steps;
  /* v8 ignore next -- the js step is always there. */
  if (first === undefined) return { ok: false, error: 'nothing to change.' };
  return {
    ok: true,
    steps: [{ ...first, title: label.slice(0, 160) }, ...rest],
    note: note(
      { ...input, values },
      running ? `replaces the scene of ${id}` : `behind ${id}`,
      stored,
    ),
  };
}

function run(input: ScenePresetInput, context: AgentToolContext): AgentToolRun {
  const declared = codeProps(context);
  if (typeof declared === 'string') return { ok: false, error: declared };
  const { place } = input;
  if (place === undefined || place.key === 'after') return insertScene(input, context, declared);
  return sceneInRegion(input, context, place, declared);
}

export const scenePresetTool = defineAgentTool<ScenePresetInput>({
  name: 'scene.preset',
  lanes: ['section', 'edit'],
  summary: 'A curated Pixi scene; needs free code',
  signature: '{preset,after?|into?|behind?:id,params?:{key:value},id?}',
  parse,
  run,
});
