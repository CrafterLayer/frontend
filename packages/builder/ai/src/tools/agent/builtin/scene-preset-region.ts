import {
  customCodeJsParamsSchema,
  paramsDiffFromDefaults,
  validateParamValues,
  type CustomCodeJsMeta,
  type CustomCodeJsParams,
  type ScriptParamSpec,
} from '@craftkit/builder-schema';

import type { KitLang, ScenePreset } from '../../../scene-presets/catalog';
import { isArabicLocale, isRecord, readTree, regionIds, setProp } from '../shared';
import type { AgentToolContext, AgentToolRun, AgentToolStep } from '../types';

/*
  What scene.preset writes into a region (split from scene-preset.ts, 2026-10-13): the library
  reference and the stored params, the code steps, the note — and the game and story kits'
  page-language words and their "id" swap, which replaces a region's tree and css with the kit's.
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

/** The language a kit's words are written in for this page (any other language reads English). */
export function kitLang(context: AgentToolContext): KitLang {
  return isArabicLocale(context) ? 'ar' : 'en';
}

/** A kit's word params in the page's language under the values given (the given ones win). */
export function kitValues(
  preset: ScenePreset,
  values: CustomCodeJsParams,
  context: AgentToolContext,
): CustomCodeJsParams {
  const words = preset.region?.params?.[kitLang(context)];
  if (words === undefined) return values;
  return { ...validateParamValues(preset.params, words).values, ...values };
}

// ── What the region carries ─────────────────────────────────────────────────

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** The library reference and spec the Studio's scene settings read (never rendered). */
export function metaOf(preset: ScenePreset): CustomCodeJsMeta {
  return {
    ref: { tier: 'builtin', id: preset.id, version: preset.entry.version },
    name: { en: preset.title.en, ar: preset.title.ar },
    tags: [...preset.tags],
    params: clone(preset.params) as ScriptParamSpec[],
    libs: [...preset.libs],
  };
}

/** Only what differs from the preset's defaults, as the Studio stores it. */
export function storedParams(preset: ScenePreset, values: CustomCodeJsParams): CustomCodeJsParams {
  return clone(paramsDiffFromDefaults(preset.params, { ...preset.defaults, ...values }));
}

export function title(context: AgentToolContext, preset: ScenePreset): string {
  return isArabicLocale(context) ? preset.title.ar : preset.title.en;
}

export function note(input: ScenePresetInput, where: string, stored: CustomCodeJsParams): string {
  const keys = Object.keys(stored);
  return [
    `${input.preset.region === undefined ? 'scene' : `${input.preset.category} kit`} ${input.preset.id} (${input.preset.category}) ${where}`,
    ...(keys.length === 0 ? [] : [`params ${keys.join(', ')}`]),
    ...input.adjusted,
  ].join(' · ');
}

export function codeSteps(
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

// ── A kit in a region that is already there ───────────────────────────────────

/**
 * Retuning an existing preset is a settings edit. Keep its authored program, metadata,
 * translated copy and unrelated settings, including additions made after creation.
 */
export function retuneSameScene(
  input: ScenePresetInput,
  context: AgentToolContext,
  id: string,
  declared: readonly string[],
): AgentToolRun | undefined {
  const current = context.readProp(id, 'js');
  if (typeof current !== 'string' || current.trim() === '') return undefined;
  const meta = context.readProp(id, 'jsMeta');
  const ref = isRecord(meta) ? meta['ref'] : undefined;
  const same = isRecord(ref) && ref['tier'] === 'builtin' && ref['id'] === input.preset.id;
  if (!same && current !== input.preset.code) return undefined;
  if (!declared.includes('jsParams')) {
    return { ok: false, error: 'This region has no jsParams property for retuning its scene.' };
  }
  const before = customCodeJsParamsSchema.safeParse(context.readProp(id, 'jsParams') ?? {});
  if (!before.success)
    return {
      ok: false,
      error: 'The current scene settings are invalid; preserve its authored code.',
    };
  const merged = customCodeJsParamsSchema.safeParse({ ...before.data, ...input.values });
  if (!merged.success)
    return { ok: false, error: 'The merged scene settings exceed the supported limits.' };
  const stored = clone(merged.data);
  return {
    ok: true,
    steps: [
      {
        ...setProp(id, 'jsParams', stored),
        title:
          `${isArabicLocale(context) ? 'مشهد' : 'Scene'} · ${title(context, input.preset)}`.slice(
            0,
            160,
          ),
      },
    ],
    note: note(input, `retunes ${id}`, stored),
  };
}

/**
 * A kit by `id`: the region keeps its id and becomes the kit — tree, css, code, meta and params —
 * unless it already holds this kit, when only the requested settings change.
 */
export function kitInRegion(
  input: ScenePresetInput,
  context: AgentToolContext,
  place: { readonly key: ScenePlacement; readonly id: string },
  declared: readonly string[],
): AgentToolRun {
  const { preset } = input;
  const region = preset.region;
  /* v8 ignore next -- only a kit reaches here. */
  if (region === undefined) return { ok: false, error: 'not a kit.' };
  const { id, key } = place;
  if (key !== 'id') {
    return {
      ok: false,
      error: `${preset.id} is a ${preset.category} kit: a whole section with its own words and controls, so it cannot fill another region · send "after":"${id}" to add it below that region, or "id" to replace a region's scene with it.`,
    };
  }
  const nodes = context.kernel.getDocument().nodes;
  const node = Object.hasOwn(nodes, id) ? nodes[id] : undefined;
  if (node === undefined) {
    return {
      ok: false,
      error: `"id": no region "${id}" on the page; use one of ${regionIds(context).slice(0, 12).join(', ') || '(none)'}.`,
    };
  }
  if (node.type !== 'customCode' || readTree(context, id) === undefined) {
    return {
      ok: false,
      error: `"${id}" is a ${node.type} block, not a composed region · send "after":"${id}" for the ${preset.category} as a new section below it.`,
    };
  }
  const current = context.readProp(id, 'js');
  const running = typeof current === 'string' && current.trim() !== '';
  if (!running) {
    return {
      ok: false,
      error: `"${id}" holds page content, not a scene, and a ${preset.category} kit brings its own · send "after":"${id}" to add it as a new section below it.`,
    };
  }
  const retuned = retuneSameScene(input, context, id, declared);
  if (retuned !== undefined) return retuned;
  const values = kitValues(preset, input.values, context);
  const stored = storedParams(preset, values);
  const steps: AgentToolStep[] = [
    setProp(id, 'tree', clone(region.tree[kitLang(context)])),
    setProp(id, 'css', region.css),
  ];
  steps.push(...codeSteps(context, id, preset, stored, declared));
  const label = `${isArabicLocale(context) ? 'مشهد' : 'Scene'} · ${title(context, preset)}`;
  const [first, ...rest] = steps;
  /* v8 ignore next -- the js step is always there. */
  if (first === undefined) return { ok: false, error: 'nothing to change.' };
  return {
    ok: true,
    steps: [{ ...first, title: label.slice(0, 160) }, ...rest],
    note: note({ ...input, values }, `replaces the scene of ${id}`, stored),
  };
}
