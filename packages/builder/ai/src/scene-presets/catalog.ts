/**
 * The builtin scene preset catalogue (pixi-studio DESIGN.md §B.3): every curated preset of
 * set A and set B in one typed, frozen list, for the agent's `scene.preset` tool and the
 * Studio's builtin library.
 *
 * A preset is ready to place as it stands: its `code` is the customCode `js` (it passes
 * `scriptCodeIssues` and fits the 32 000-character region limit), `libs` are exactly the
 * libraries that code loads, and `params` / `defaults` are its `jsMeta` param spec and the
 * values its own `ck.params({...})` falls back to. `presets.test.ts` holds all of that, and
 * `apps/evals` runs each one in the sandboxed Studio preview.
 */
import type {
  Bilingual,
  ScriptEntry,
  ScriptParamSpec,
  ScriptParamValue,
  StudioLibKey,
} from '@craftkit/builder-schema';

import { PRESETS_SET_A } from './set-a';
import { PRESETS_SET_B } from './set-b';

/**
 * What kind of scene a preset is, for choosing one:
 * - `mural`: an abstract generative picture (fields, growth, tessellations, hand-drawn);
 * - `pattern`: Arabic and Islamic geometry (girih, zellige, mashrabiya, arabesque);
 * - `type`: words as the subject (calligraphy, kinetic and falling words, particle text);
 * - `particles`: flocks, sparks, fireflies, confetti and stars;
 * - `photo`: a picture brought to life (ripple, spotlight, parallax, tilt cards);
 * - `toy`: a playful surface that answers the pointer (magnetic grid, soft blobs).
 */
export const SCENE_PRESET_CATEGORIES = [
  'mural',
  'pattern',
  'type',
  'particles',
  'photo',
  'toy',
] as const;
export type ScenePresetCategory = (typeof SCENE_PRESET_CATEGORIES)[number];

export interface ScenePreset {
  /** The library id (lower-case kebab), unique across the catalogue. */
  readonly id: string;
  /** The preset's name, in English and Arabic. */
  readonly title: Bilingual;
  readonly description: Bilingual;
  readonly category: ScenePresetCategory;
  /** Studio tag keys (`background`, `hero`, `arabic`, `interactive`, …). */
  readonly tags: readonly string[];
  /** Exactly what the code loads: always `kit`, plus each `s.lib.<key>` it uses. */
  readonly libs: readonly StudioLibKey[];
  /** The code may play sound (always muted until a visitor turns it on). */
  readonly sound: boolean;
  /** The `jsMeta.params` spec: the Studio form for this preset's `jsParams`. */
  readonly params: readonly ScriptParamSpec[];
  /** Each param's default, keyed — the values `ck.params({...})` in the code falls back to. */
  readonly defaults: Readonly<Record<string, ScriptParamValue>>;
  /** The customCode `js`: plain JavaScript against the scene API (`ck.params` + `ck.scene`). */
  readonly code: string;
  /** The builtin library entry it came from (author craftkit, trust trusted, MIT). */
  readonly entry: Readonly<ScriptEntry>;
}

const CATEGORY_OF: Readonly<Record<string, ScenePresetCategory>> = {
  'flow-field-silk': 'mural',
  'domain-warp-liquid': 'mural',
  'aurora-curtains': 'mural',
  'circle-packing-bloom': 'mural',
  'recursive-mondrian': 'mural',
  'differential-growth-coral': 'mural',
  'reaction-diffusion-skin': 'mural',
  'topographic-contours': 'mural',
  'voronoi-stained-glass': 'mural',
  'low-poly-terrain': 'mural',
  'rough-notebook': 'mural',
  'girih-starfield': 'pattern',
  'zellige-mosaic': 'pattern',
  'mashrabiya-light': 'pattern',
  'arabesque-vines': 'pattern',
  'calligraphy-ink-reveal': 'type',
  'kinetic-word-grid': 'type',
  'falling-letters-pile': 'type',
  'particle-text-morph': 'type',
  'boids-murmuration': 'particles',
  'firefly-garden': 'particles',
  'ember-storm': 'particles',
  'starfield-warp': 'particles',
  'confetti-celebration': 'particles',
  'liquid-cursor-ripple': 'photo',
  'reveal-spotlight': 'photo',
  'scroll-parallax-depth': 'photo',
  'tilt-card-wall': 'photo',
  'magnetic-dot-grid': 'toy',
  'soft-blob-cluster': 'toy',
};

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

function presetOf(entry: ScriptEntry): ScenePreset {
  const category = CATEGORY_OF[entry.id];
  if (category === undefined) {
    throw new Error(`Scene preset "${entry.id}" has no category in the catalogue.`);
  }
  return {
    id: entry.id,
    title: entry.name,
    description: entry.description ?? entry.name,
    category,
    tags: entry.tags,
    libs: entry.libs,
    sound: entry.sound,
    params: entry.params,
    defaults: Object.fromEntries(entry.params.map((spec) => [spec.key, spec.default])),
    code: entry.code,
    entry,
  };
}

/** Every builtin scene preset, set A then set B, deeply frozen. */
export const SCENE_PRESETS: readonly ScenePreset[] = deepFreeze(
  [...PRESETS_SET_A, ...PRESETS_SET_B].map(presetOf),
);

const BY_ID: ReadonlyMap<string, ScenePreset> = new Map(
  SCENE_PRESETS.map((preset) => [preset.id, preset]),
);

/** The preset with this id, or undefined. */
export function scenePreset(id: string): ScenePreset | undefined {
  return BY_ID.get(id);
}

/** The presets of one category, in catalogue order. */
export function scenePresetsIn(category: ScenePresetCategory): readonly ScenePreset[] {
  return SCENE_PRESETS.filter((preset) => preset.category === category);
}
