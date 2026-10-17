/**
 * Builders for the set-A builtin scene presets (DESIGN.md §B.3).
 *
 * Every preset is a `ScriptEntry` written by CraftKit: author 'craftkit', trust
 * 'trusted', licence MIT, version 1, kind 'scene', still frame under reduced
 * motion. The builders below keep each preset file down to what is particular
 * to it: its names, tags, libs, its own parameters and its code.
 */
import type {
  Bilingual,
  ScriptEntry,
  ScriptParamSpec,
  ScriptParamValue,
  StudioLibKey,
} from './studio-types';

/** One fixed timestamp: builtin entries never change under a clock. */
export const SET_A_SAVED_AT = '2026-10-10T00:00:00.000Z';

type Group = NonNullable<ScriptParamSpec['group']>;

function label(en: string, ar: string): Bilingual {
  return { en, ar };
}

/** A slider. */
export function range(
  key: string,
  en: string,
  ar: string,
  value: number,
  min: number,
  max: number,
  step: number,
  group: Group = 'look',
): ScriptParamSpec {
  return { key, type: 'range', label: label(en, ar), default: value, min, max, step, group };
}

/** A switch. */
export function toggle(
  key: string,
  en: string,
  ar: string,
  value: boolean,
  group: Group = 'look',
): ScriptParamSpec {
  return { key, type: 'toggle', label: label(en, ar), default: value, group };
}

/** A free text field (Arabic stays whole: scripts split it by words only). */
export function text(
  key: string,
  en: string,
  ar: string,
  value: string,
  group: Group = 'look',
): ScriptParamSpec {
  return { key, type: 'text', label: label(en, ar), default: value, group };
}

/** A closed choice. `options` are [value, en, ar]. */
export function select(
  key: string,
  en: string,
  ar: string,
  value: string,
  options: readonly (readonly [string, string, string])[],
  group: Group = 'look',
): ScriptParamSpec {
  return {
    key,
    type: 'select',
    label: label(en, ar),
    default: value,
    options: options.map(([optionValue, optionEn, optionAr]) => ({
      value: optionValue,
      label: label(optionEn, optionAr),
    })),
    group,
  };
}

export interface SharedParamOptions {
  seed: number;
  speed?: number;
  density?: number;
  /** Adds the `interactive` switch (pointer reactions). */
  interactive?: boolean;
}

/**
 * The params every preset shares (§B.3): palette, seed, speed, density and,
 * where the scene reacts to the pointer, interactive.
 */
export function sharedParams(options: SharedParamOptions): ScriptParamSpec[] {
  const shared: ScriptParamSpec[] = [
    {
      key: 'palette',
      type: 'palette',
      label: label('Palette', 'لوحة الألوان'),
      default: 'theme',
      group: 'look',
      help: label('Theme colours, or up to six of your own.', 'ألوان القالب، أو حتى ستة ألوان من اختيارك.'),
    },
    {
      key: 'seed',
      type: 'number',
      label: label('Seed', 'البذرة'),
      default: options.seed,
      min: 1,
      max: 9999,
      step: 1,
      group: 'look',
      help: label('Same seed, same picture.', 'البذرة نفسها تعطي الصورة نفسها.'),
    },
    range('speed', 'Speed', 'السرعة', options.speed ?? 1, 0, 3, 0.05, 'motion'),
    range('density', 'Density', 'الكثافة', options.density ?? 1, 0.2, 2, 0.05, 'look'),
  ];
  if (options.interactive === true) {
    shared.push(toggle('interactive', 'React to pointer', 'التفاعل مع المؤشر', true, 'interaction'));
  }
  return shared;
}

export interface PresetDefinition {
  id: string;
  name: Bilingual;
  description: Bilingual;
  tags: string[];
  /** Always includes 'kit' (ck.scene implies it). */
  libs: StudioLibKey[];
  params: ScriptParamSpec[];
  code: string;
}

/** A builtin set-A preset as a ScriptEntry. */
export function definePreset(definition: PresetDefinition): ScriptEntry {
  return {
    id: definition.id,
    name: definition.name,
    description: definition.description,
    tags: definition.tags,
    kind: 'scene',
    code: definition.code.trim(),
    params: definition.params,
    libs: definition.libs,
    sound: false,
    reducedMotion: 'still',
    version: 1,
    author: 'craftkit',
    trust: 'trusted',
    licence: 'MIT',
    createdAt: SET_A_SAVED_AT,
    updatedAt: SET_A_SAVED_AT,
  };
}

/** The default value of each param, keyed (tests compare it with `ck.params`). */
export function paramDefaults(entry: ScriptEntry): Record<string, ScriptParamValue> {
  return Object.fromEntries(entry.params.map((spec) => [spec.key, spec.default]));
}
