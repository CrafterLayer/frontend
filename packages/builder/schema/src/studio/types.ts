import type { AssetId } from '../assets/types';
import type { LibraryId } from '../site/library';

/**
 * Pixi Studio data model (pixi-studio DESIGN.md §A.1, binding names).
 *
 * Pure types. The zod schemas that hold them live in `schemas.ts`; the two are
 * kept in step by `satisfies`-style assignments there, so a field added here and
 * forgotten there is a type error, not a silent hole at the door.
 */

/** The add-on libraries a script may load with `ck.use` / `libs: [...]` (D3/D4). */
export const STUDIO_LIB_KEYS = [
  'kit',
  'filters',
  'emitter',
  'physics',
  'brush',
  'rough',
  'viewport',
  'anim',
  'fx',
  'dialogue',
  'ink',
  'tilemap',
  'audio',
  'gameai',
  'hud',
] as const;
export type StudioLibKey = (typeof STUDIO_LIB_KEYS)[number];

/** The keys whose asset binds to the page's ONE Pixi namespace through a factory (D2). */
export const STUDIO_PIXI_BOUND_KEYS: readonly StudioLibKey[] = [
  'kit',
  'filters',
  'emitter',
  'viewport',
  'fx',
  'tilemap',
  'audio',
  'hud',
];

export type ScriptKind = 'scene' | 'interaction' | 'snippet';
export type ScriptTier = 'builtin' | 'project' | 'personal';
export type ScriptAuthor = 'craftkit' | 'agent' | 'user';
export type ScriptTrust = 'trusted' | 'unreviewed';

export const SCRIPT_KINDS: readonly ScriptKind[] = ['scene', 'interaction', 'snippet'];
export const SCRIPT_TIERS: readonly ScriptTier[] = ['builtin', 'project', 'personal'];
export const SCRIPT_AUTHORS: readonly ScriptAuthor[] = ['craftkit', 'agent', 'user'];

/** A label in both UI languages; each side 1..80 characters. */
export interface Bilingual {
  en: string;
  ar: string;
}

export type ScriptParamType =
  'number' | 'range' | 'color' | 'palette' | 'select' | 'toggle' | 'text' | 'image' | 'sound';

export const SCRIPT_PARAM_TYPES: readonly ScriptParamType[] = [
  'number',
  'range',
  'color',
  'palette',
  'select',
  'toggle',
  'text',
  'image',
  'sound',
];

export type ScriptParamGroup = 'look' | 'motion' | 'interaction' | 'sound';
export const SCRIPT_PARAM_GROUPS: readonly ScriptParamGroup[] = [
  'look',
  'motion',
  'interaction',
  'sound',
];

export type ScriptParamValue = number | string | boolean | readonly string[];

export interface ScriptParamOption {
  value: string;
  label: Bilingual;
}

export interface ScriptParamSpec {
  /** `/^[a-z][a-zA-Z0-9]{0,31}$/` */
  key: string;
  type: ScriptParamType;
  label: Bilingual;
  /** Must match `type` (palette = `'theme'` or a list of `#hex`). */
  default: ScriptParamValue;
  min?: number | undefined;
  max?: number | undefined;
  step?: number | undefined;
  /** select only, 2..24. */
  options?: ScriptParamOption[] | undefined;
  group?: ScriptParamGroup | undefined;
  help?: Bilingual | undefined;
}

export interface ScriptVersion {
  version: number;
  code: string;
  params: ScriptParamSpec[];
  savedAt: string;
  note?: string | undefined;
}

export type ScriptReducedMotion = 'still' | 'hide' | 'same';

export interface ScriptEntry {
  id: LibraryId;
  name: Bilingual;
  /** ≤ 280 characters each side. */
  description?: Bilingual | undefined;
  /** ≤ 12 kebab keys; bilingual labels through `STUDIO_TAG_LABELS`. */
  tags: string[];
  kind: ScriptKind;
  /** ≤ 32 000 characters (CUSTOM_CODE_REGION_JS_MAX). */
  code: string;
  /** ≤ 24, unique keys. */
  params: ScriptParamSpec[];
  /** Exactly the libraries the code loads (`declaredLibs(code).libs`). */
  libs: StudioLibKey[];
  /** The code uses `ck.sound` or `audio: true`. */
  sound: boolean;
  reducedMotion: ScriptReducedMotion;
  /** `data:image/webp;base64,…` (png/jpeg admitted for engines without WebP encode), ≤ 64 kB. */
  thumbnail?: string | undefined;
  /** ≥ 1; +1 on each save that changes code or params. */
  version: number;
  /** Older versions, newest first. Project keeps 5, personal keeps 50. */
  history?: ScriptVersion[] | undefined;
  /** Fork lineage: `<tier>:<id>@<version>`. */
  parentId?: string | undefined;
  author: ScriptAuthor;
  trust: ScriptTrust;
  /** SPDX identifier; `MIT` for own work. */
  licence: string;
  /** https URL when adapted from somewhere. */
  origin?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export type SoundBus = 'ui' | 'sfx' | 'ambient' | 'music';
export const SOUND_BUSES: readonly SoundBus[] = ['ui', 'sfx', 'ambient', 'music'];

/**
 * The recipe id is typed as a plain string here: the closed list
 * (`SOUND_RECIPE_IDS`) belongs to the sound engine package and is checked there.
 */
export type SoundRecipeRef = string;

export type SoundSource =
  | { kind: 'zzfx'; params: number[] }
  | { kind: 'recipe'; recipe: SoundRecipeRef; params?: Record<string, number> | undefined }
  | { kind: 'asset'; assetId: AssetId };

export interface SoundEntry {
  id: LibraryId;
  name: Bilingual;
  tags: string[];
  bus: SoundBus;
  source: SoundSource;
  /** 0..1, default 0.6. */
  volume: number;
  loop?: boolean | undefined;
  author: ScriptAuthor;
  licence: string;
  origin?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface ScriptRef {
  tier: ScriptTier;
  id: string;
  version: number;
}

/** The customCode `jsMeta` prop: library reference + param spec, never rendered. */
export interface CustomCodeJsMeta {
  ref?: ScriptRef | undefined;
  name?: Bilingual | string | undefined;
  tags?: string[] | undefined;
  params?: ScriptParamSpec[] | undefined;
  libs?: StudioLibKey[] | undefined;
  /** The agent asked to keep it (the harvester reads this). */
  save?: boolean | undefined;
}

/** The customCode `jsParams` prop: values, rendered as `data-ck-params`; ≤ 4 000 chars of JSON. */
export type CustomCodeJsParams = Record<string, ScriptParamValue>;

/** The `.ckscripts.json` export/import bundle (§A.1). */
export interface CkScriptsBundle {
  format: 'craftkit.scripts';
  version: 1;
  exportedAt: string;
  scripts: ScriptEntry[];
  sounds: SoundEntry[];
  /** Audio bytes for asset sounds. */
  assets?: Record<AssetId, { url: string; mime: string }> | undefined;
  /** `script:<id>` / `sound:<id>` → fnv1a64 of the code / the JSON of the source. */
  checksums: Record<string, string>;
}
