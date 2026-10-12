/**
 * LOCAL STAND-IN for the Pixi Studio library types (DESIGN.md §A.1).
 *
 * The presets-a package was asked to import `ScriptEntry` and `ScriptParamSpec`
 * from `@craftkit/builder-schema` (package `schema-library`, wave 1). When this
 * file was written (2026-10-10) `schema/src/studio/**` did not exist yet, so the
 * shapes are copied here VERBATIM from DESIGN §A.1. They are structural types:
 * once the schema exports land, replace the body of this file with
 *
 *   export type { ScriptEntry, ScriptParamSpec, ... } from '@craftkit/builder-schema';
 *
 * and nothing else in `set-a/**` changes (every preset imports from here).
 */

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

export type ScriptKind = 'scene' | 'interaction' | 'snippet';
export type ScriptTier = 'builtin' | 'project' | 'personal';
export type ScriptAuthor = 'craftkit' | 'agent' | 'user';
export type ScriptTrust = 'trusted' | 'unreviewed';

/** Each side 1..80 chars (names) or ≤ 280 (descriptions). */
export interface Bilingual {
  en: string;
  ar: string;
}

export type ScriptParamType =
  'number' | 'range' | 'color' | 'palette' | 'select' | 'toggle' | 'text' | 'image' | 'sound';
export type ScriptParamValue = number | string | boolean | readonly string[];

export interface ScriptParamSpec {
  /** `/^[a-z][a-zA-Z0-9]{0,31}$/` */
  key: string;
  type: ScriptParamType;
  label: Bilingual;
  /** Must match the type (palette = string[] of #hex, or 'theme'). */
  default: ScriptParamValue;
  min?: number;
  max?: number;
  step?: number;
  /** select only, 2..24 options. */
  options?: { value: string; label: Bilingual }[];
  group?: 'look' | 'motion' | 'interaction' | 'sound';
  help?: Bilingual;
}

export interface ScriptVersion {
  version: number;
  code: string;
  params: ScriptParamSpec[];
  savedAt: string;
  note?: string;
}

export interface ScriptEntry {
  /** Library id: lower-case kebab, ≤ 48. */
  id: string;
  name: Bilingual;
  description?: Bilingual;
  /** ≤ 12 kebab keys; bilingual labels via STUDIO_TAG_LABELS. */
  tags: string[];
  kind: ScriptKind;
  /** ≤ 32 000 chars and passes scriptCodeIssues. */
  code: string;
  /** ≤ 24, unique keys. */
  params: ScriptParamSpec[];
  /** Declared; lint holds it equal to what the code names. */
  libs: StudioLibKey[];
  /** The code uses ck.sound or audio:true. */
  sound: boolean;
  reducedMotion: 'still' | 'hide' | 'same';
  thumbnail?: string;
  version: number;
  history?: ScriptVersion[];
  parentId?: string;
  author: ScriptAuthor;
  trust: ScriptTrust;
  licence: string;
  origin?: string;
  createdAt: string;
  updatedAt: string;
}
