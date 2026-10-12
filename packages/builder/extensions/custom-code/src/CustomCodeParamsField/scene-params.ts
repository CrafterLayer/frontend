import {
  isCustomCodeJsMetaSchema,
  isHexColour,
  isPaletteParamValue,
  SCRIPT_PARAM_KEY_PATTERN,
  scriptParamSpecSchema,
  SOUND_BANK,
  STUDIO_LIMITS,
  studioParamLabel,
  type CustomCodeJsParams,
  type FieldRowState,
  type FieldSibling,
  type ScriptParamSpec,
  type ScriptParamValue,
} from '@craftkit/builder-schema';

import type { ScriptParamsSoundOption } from '../ScriptParamsForm';

/**
 * The scene settings of a composed region (pixi-studio DESIGN.md D8), as the
 * Inspector edits them: the SPEC beside the values, and how a form commit
 * folds back into the stored `jsParams`.
 *
 * Pure and total, like `studio/params.ts`: a stored document that does not
 * fit is read as far as it fits, never thrown on.
 */

export interface SceneParamsModel {
  /** One control per entry, in this order. */
  readonly spec: readonly ScriptParamSpec[];
  /**
   * `declared` — the Studio's spec (`jsMeta.params`). `inferred` — there is
   * none, so every key already stored gets a plain control by its value's
   * type, its default being the value itself (so nothing reads as changed).
   */
  readonly source: 'declared' | 'inferred';
}

/** The stored record as the form reads it (it coerces and clamps each value itself). */
export function storedSceneParams(value: unknown): Readonly<CustomCodeJsParams> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as CustomCodeJsParams)
    : undefined;
}

function recordOf(value: unknown): Readonly<Record<string, unknown>> {
  return storedSceneParams(value) ?? {};
}

/**
 * The param spec the Studio wrote beside the values: `jsMeta.params`, the
 * sibling found by its DECLARATION (`customCodeJsMeta()`), never by its name.
 * Entries that do not parse are left out, so one bad entry costs one control.
 */
export function declaredSceneSpec(
  siblings: readonly FieldSibling[] | undefined,
): readonly ScriptParamSpec[] {
  const meta = siblings?.find((sibling) => isCustomCodeJsMetaSchema(sibling.schema))?.value;
  const params = recordOf(meta)['params'];
  if (!Array.isArray(params)) return [];
  const seen = new Set<string>();
  const out: ScriptParamSpec[] = [];
  for (const entry of params) {
    const parsed = scriptParamSpecSchema.safeParse(entry);
    if (!parsed.success || seen.has(parsed.data.key)) continue;
    seen.add(parsed.data.key);
    out.push(parsed.data);
  }
  return out;
}

function plainSpec(key: string, value: unknown): ScriptParamSpec | undefined {
  const label = studioParamLabel(key);
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { key, type: 'number', label, default: value };
  }
  if (typeof value === 'boolean') return { key, type: 'toggle', label, default: value };
  if (value === 'theme') return { key, type: 'palette', label, default: value };
  if (typeof value === 'string' && isHexColour(value)) {
    return { key, type: 'color', label, default: value.toLowerCase() };
  }
  // Longer than a text param admits: no control, rather than one that would cut it on any write.
  if (typeof value === 'string' && value.length <= STUDIO_LIMITS.text) {
    return { key, type: 'text', label, default: value };
  }
  if (isPaletteParamValue(value)) {
    const colours = (value as readonly string[]).map((entry) => entry.toLowerCase());
    return { key, type: 'palette', label, default: colours };
  }
  return undefined;
}

/** With no spec: one plain control per stored key, by its value's type, in stored order. */
export function inferredSceneSpec(values: unknown): readonly ScriptParamSpec[] {
  return Object.entries(recordOf(values)).flatMap(([key, value]) => {
    if (!SCRIPT_PARAM_KEY_PATTERN.test(key)) return [];
    const spec = plainSpec(key, value);
    return spec === undefined ? [] : [spec];
  });
}

/** What the scene-settings field shows for a stored `jsParams` and its sibling props. */
export function sceneParamsModel(
  values: unknown,
  siblings: readonly FieldSibling[] | undefined,
): SceneParamsModel {
  const declared = declaredSceneSpec(siblings);
  return declared.length > 0
    ? { spec: declared, source: 'declared' }
    : { spec: inferredSceneSpec(values), source: 'inferred' };
}

/** The field type's `hidden` rule: nothing to tune yet — no spec, and no stored value. */
export function sceneParamsHidden(row: FieldRowState): boolean {
  return sceneParamsModel(row.value, row.siblings).spec.length === 0;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((entry, index) => Object.is(entry, b[index]));
  }
  return Object.is(a, b);
}

function sameRecord(a: Readonly<Record<string, unknown>>, b: Readonly<Record<string, unknown>>) {
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => Object.hasOwn(b, key) && sameValue(a[key], b[key]))
  );
}

/**
 * A form commit folded into the stored record — what ONE setProp writes, or
 * `undefined` when nothing changed.
 *
 * The form hands back the spec's keys that differ from their defaults (a
 * value equal to its default is never written). So a declared spec's keys
 * take exactly what the form says, while keys outside the spec — written by
 * the agent or by an older script — are kept as they were: a merge, never a
 * replacement. With an inferred spec every default is the stored value, so the
 * form returns only what changed and that is laid over the record.
 */
export function mergeSceneParams(
  stored: unknown,
  model: SceneParamsModel,
  next: Readonly<CustomCodeJsParams>,
): CustomCodeJsParams | undefined {
  const current = recordOf(stored);
  const specKeys = new Set(model.spec.map((entry) => entry.key));
  const merged: CustomCodeJsParams = {};
  for (const [key, value] of Object.entries(current)) {
    if (model.source === 'declared' && specKeys.has(key)) {
      const chosen = next[key];
      if (chosen !== undefined) merged[key] = chosen;
    } else if (Object.hasOwn(next, key) && next[key] !== undefined) {
      merged[key] = next[key];
    } else {
      merged[key] = value as ScriptParamValue;
    }
  }
  for (const [key, value] of Object.entries(next)) {
    if (!Object.hasOwn(merged, key)) merged[key] = value;
  }
  return sameRecord(merged, current) ? undefined : merged;
}

/** The sound bank, as the choices of a `sound` param (an unknown stored reference stays offered). */
export const SCENE_SOUND_OPTIONS: readonly ScriptParamsSoundOption[] = SOUND_BANK.map((entry) => ({
  value: entry.id,
  label: entry.label,
}));
