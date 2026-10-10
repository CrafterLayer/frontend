import { z } from 'zod';

import { declaredLibs } from './detect';
import {
  SCRIPT_PARAM_GROUPS,
  SCRIPT_PARAM_TYPES,
  SOUND_BUSES,
  STUDIO_LIB_KEYS,
  type Bilingual,
  type CkScriptsBundle,
  type CustomCodeJsMeta,
  type CustomCodeJsParams,
  type ScriptEntry,
  type ScriptParamOption,
  type ScriptParamSpec,
  type ScriptParamValue,
  type ScriptRef,
  type ScriptVersion,
  type SoundEntry,
  type SoundSource,
} from './types';

/**
 * The zod half of the Pixi Studio data model (pixi-studio DESIGN.md §A.1).
 *
 * Deliberately CHEAP: these schemas run inside `validateSite` (the library is
 * part of the site), so they hold shape, bounds and the libs/sound agreement —
 * all regex work — and never compile code. The syntax check lives in
 * `scriptCodeIssues`, which the commands and the door call once per write.
 *
 * No value import from `../site/library` or `../custom-code/*`: `library.ts`
 * imports THIS module for its `scripts`/`sounds` records, so a value import
 * back would be a cycle that throws at load. The two constants shared with
 * those modules are restated here and pinned equal by `studio.test.ts`.
 */

/** Same as `LIBRARY_ID_PATTERN` (site/library.ts); pinned equal by a test. */
export const STUDIO_ID_PATTERN = /^[a-z][a-z0-9-]{0,47}$/u;
/** Same as `CUSTOM_CODE_REGION_JS_MAX` (custom-code-tree.ts); pinned equal by a test. */
export const STUDIO_CODE_MAX = 32_000;

export const STUDIO_LIMITS = {
  code: STUDIO_CODE_MAX,
  params: 24,
  tags: 12,
  options: 24,
  paletteSwatches: 12,
  label: 80,
  description: 280,
  text: 500,
  imageValue: 2_000,
  soundValue: 200,
  jsParamsJson: 4_000,
  thumbnailBytes: 64 * 1024,
  projectHistory: 5,
  personalHistory: 50,
  zzfxNumbers: 21,
  zzfxSeconds: 4,
  bundleBytes: 8 * 1024 * 1024,
  bundleScripts: 1_000,
  bundleSounds: 500,
} as const;

export const SCRIPT_PARAM_KEY_PATTERN = /^[a-z][a-zA-Z0-9]{0,31}$/u;
export const STUDIO_TAG_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/u;
const HEX_COLOUR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/iu;
const SPDX = /^[A-Za-z0-9][A-Za-z0-9.+-]*(?: (?:AND|OR|WITH) [A-Za-z0-9][A-Za-z0-9.+-]*)*$/u;
const HTTPS_URL = /^https:\/\/[^\s"'<>`\\]+$/u;
const PARENT_ID = /^(?:builtin|project|personal):[a-z][a-z0-9-]{0,47}@\d{1,6}$/u;
const THUMBNAIL = /^data:image\/(?:webp|png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/u;
const RESERVED_IDS: ReadonlySet<string> = new Set(['constructor', 'prototype']);

export function isHexColour(value: string): boolean {
  return HEX_COLOUR.test(value);
}

// ── Atoms ────────────────────────────────────────────────────────────────────

export const studioIdSchema: z.ZodType<string> = z
  .string()
  .regex(
    STUDIO_ID_PATTERN,
    'An id is lower-case kebab-case: a letter, then up to 47 of a-z, 0-9 or "-".',
  )
  .refine((id) => !RESERVED_IDS.has(id), 'That id is reserved.');

function bilingualOf(max: number): z.ZodType<Bilingual> {
  return z.strictObject({
    en: z.string().trim().min(1).max(max),
    ar: z.string().trim().min(1).max(max),
  });
}

export const bilingualSchema: z.ZodType<Bilingual> = bilingualOf(STUDIO_LIMITS.label);
const descriptionSchema = bilingualOf(STUDIO_LIMITS.description);

const isoInstant = z.iso.datetime({ offset: true });

export const studioTagsSchema: z.ZodType<string[]> = z
  .array(z.string().regex(STUDIO_TAG_PATTERN, 'A tag is a lower-case kebab key (≤ 32).'))
  .max(STUDIO_LIMITS.tags)
  .refine((tags) => new Set(tags).size === tags.length, 'A tag is listed twice.');

const libsSchema = z
  .array(z.enum(STUDIO_LIB_KEYS))
  .max(STUDIO_LIB_KEYS.length)
  .refine((libs) => new Set(libs).size === libs.length, 'A library is listed twice.');

const licenceSchema = z
  .string()
  .max(64)
  .regex(SPDX, 'A licence is an SPDX identifier (MIT, Apache-2.0, …).');

const originSchema = z.string().max(500).regex(HTTPS_URL, 'An origin is an https:// URL.');

/** Decoded byte length of a base64 payload (padding-aware). */
function base64Bytes(payload: string): number {
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  return Math.floor((payload.length * 3) / 4) - padding;
}

export function isScriptThumbnail(value: string): boolean {
  // Length first, so a hostile multi-megabyte string never reaches the regex.
  if (value.length > Math.ceil(STUDIO_LIMITS.thumbnailBytes / 3) * 4 + 32) return false;
  const match = THUMBNAIL.exec(value);
  return match !== null && base64Bytes(match[1] ?? '') <= STUDIO_LIMITS.thumbnailBytes;
}

// ── Param spec and values ────────────────────────────────────────────────────

const paramValueSchema: z.ZodType<ScriptParamValue> = z.union([
  z.number(),
  z.string().max(STUDIO_LIMITS.imageValue),
  z.boolean(),
  z.array(z.string().max(STUDIO_LIMITS.imageValue)).max(STUDIO_LIMITS.options).readonly(),
]);

const paramOptionSchema: z.ZodType<ScriptParamOption> = z.strictObject({
  value: z.string().min(1).max(80),
  label: bilingualSchema,
});

export function isPaletteParamValue(value: unknown): boolean {
  if (value === 'theme') return true;
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= STUDIO_LIMITS.paletteSwatches &&
    value.every((entry) => typeof entry === 'string' && HEX_COLOUR.test(entry))
  );
}

/**
 * Why a param's default does not fit its declared type, or undefined.
 * Shared by the spec schema and `inferParamSpec`'s own guard.
 */
export function paramDefaultProblem(spec: {
  type: ScriptParamSpec['type'];
  default: unknown;
  options?: readonly { value: string }[] | undefined;
}): string | undefined {
  const value = spec.default;
  switch (spec.type) {
    case 'number':
    case 'range':
      return typeof value === 'number' && Number.isFinite(value)
        ? undefined
        : 'A number param defaults to a finite number.';
    case 'color':
      return typeof value === 'string' && HEX_COLOUR.test(value)
        ? undefined
        : 'A colour param defaults to a #hex colour.';
    case 'palette':
      return isPaletteParamValue(value)
        ? undefined
        : `A palette param defaults to "theme" or 1–${String(STUDIO_LIMITS.paletteSwatches)} #hex colours.`;
    case 'select':
      return typeof value === 'string' &&
        (spec.options ?? []).some((option) => option.value === value)
        ? undefined
        : 'A select param defaults to one of its option values.';
    case 'toggle':
      return typeof value === 'boolean' ? undefined : 'A toggle param defaults to true or false.';
    case 'text':
      return typeof value === 'string' && value.length <= STUDIO_LIMITS.text
        ? undefined
        : `A text param defaults to a string of at most ${String(STUDIO_LIMITS.text)} characters.`;
    case 'image':
      return typeof value === 'string' && value.length <= STUDIO_LIMITS.imageValue
        ? undefined
        : 'An image param defaults to a URL, a data URL or an asset id.';
    case 'sound':
      return typeof value === 'string' && value.length <= STUDIO_LIMITS.soundValue
        ? undefined
        : 'A sound param defaults to a sound reference.';
  }
}

export const scriptParamSpecSchema: z.ZodType<ScriptParamSpec> = z
  .strictObject({
    key: z
      .string()
      .regex(
        SCRIPT_PARAM_KEY_PATTERN,
        'A param key is camelCase: a lower-case letter, then up to 31 letters or digits.',
      ),
    type: z.enum(SCRIPT_PARAM_TYPES),
    label: bilingualSchema,
    default: paramValueSchema,
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().positive().optional(),
    options: z.array(paramOptionSchema).min(2).max(STUDIO_LIMITS.options).optional(),
    group: z.enum(SCRIPT_PARAM_GROUPS).optional(),
    help: bilingualSchema.optional(),
  })
  .superRefine((spec, context) => {
    const problem = paramDefaultProblem(spec);
    if (problem !== undefined) {
      context.addIssue({ code: 'custom', path: ['default'], message: `${spec.key}: ${problem}` });
    }
    const numeric = spec.type === 'number' || spec.type === 'range';
    if (spec.type === 'range' && (spec.min === undefined || spec.max === undefined)) {
      context.addIssue({
        code: 'custom',
        path: ['min'],
        message: `${spec.key}: a range param declares min and max.`,
      });
    }
    if (!numeric && (spec.min !== undefined || spec.max !== undefined || spec.step !== undefined)) {
      context.addIssue({
        code: 'custom',
        path: ['min'],
        message: `${spec.key}: min, max and step belong to number and range params.`,
      });
    }
    if (spec.min !== undefined && spec.max !== undefined && spec.min >= spec.max) {
      context.addIssue({
        code: 'custom',
        path: ['max'],
        message: `${spec.key}: max must be greater than min.`,
      });
    }
    if (numeric && typeof spec.default === 'number') {
      if (
        (spec.min !== undefined && spec.default < spec.min) ||
        (spec.max !== undefined && spec.default > spec.max)
      ) {
        context.addIssue({
          code: 'custom',
          path: ['default'],
          message: `${spec.key}: the default lies outside min..max.`,
        });
      }
    }
    if (spec.type !== 'select' && spec.options !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['options'],
        message: `${spec.key}: only a select param has options.`,
      });
    }
    if (spec.type === 'select') {
      const values = (spec.options ?? []).map((option) => option.value);
      if (values.length < 2) {
        context.addIssue({
          code: 'custom',
          path: ['options'],
          message: `${spec.key}: a select param lists 2–${String(STUDIO_LIMITS.options)} options.`,
        });
      }
      if (new Set(values).size !== values.length) {
        context.addIssue({
          code: 'custom',
          path: ['options'],
          message: `${spec.key}: an option value is listed twice.`,
        });
      }
    }
  });

export const scriptParamSpecsSchema: z.ZodType<ScriptParamSpec[]> = z
  .array(scriptParamSpecSchema)
  .max(STUDIO_LIMITS.params)
  .superRefine((specs, context) => {
    const seen = new Set<string>();
    specs.forEach((spec, index) => {
      if (seen.has(spec.key)) {
        context.addIssue({
          code: 'custom',
          path: [index, 'key'],
          message: `Param "${spec.key}" is declared twice.`,
        });
      }
      seen.add(spec.key);
    });
  });

/** Length of the JSON a value set renders as (`data-ck-params`). */
export function jsParamsJsonLength(values: unknown): number {
  try {
    return JSON.stringify(values).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export const customCodeJsParamsSchema: z.ZodType<CustomCodeJsParams> = z
  .record(
    z.string().regex(SCRIPT_PARAM_KEY_PATTERN, 'A param key is camelCase (≤ 32).'),
    paramValueSchema,
  )
  .refine(
    (values) => jsParamsJsonLength(values) <= STUDIO_LIMITS.jsParamsJson,
    `Script values are at most ${String(STUDIO_LIMITS.jsParamsJson)} characters of JSON.`,
  );

// ── Script entries ───────────────────────────────────────────────────────────

const scriptCodeSchema = z
  .string()
  .max(STUDIO_CODE_MAX)
  .refine(
    (code) => !/<\/script/iu.test(code),
    'Script code cannot contain "</script" (it would end the page script).',
  );

export const scriptVersionSchema: z.ZodType<ScriptVersion> = z.strictObject({
  version: z.number().int().min(1),
  code: scriptCodeSchema,
  params: scriptParamSpecsSchema,
  savedAt: isoInstant,
  note: z.string().trim().min(1).max(200).optional(),
});

export const scriptRefSchema: z.ZodType<ScriptRef> = z.strictObject({
  tier: z.enum(['builtin', 'project', 'personal']),
  id: studioIdSchema,
  version: z.number().int().min(1),
});

export const scriptEntrySchema: z.ZodType<ScriptEntry> = z
  .strictObject({
    id: studioIdSchema,
    name: bilingualSchema,
    description: descriptionSchema.optional(),
    tags: studioTagsSchema,
    kind: z.enum(['scene', 'interaction', 'snippet']),
    code: scriptCodeSchema,
    params: scriptParamSpecsSchema,
    libs: libsSchema,
    sound: z.boolean(),
    reducedMotion: z.enum(['still', 'hide', 'same']),
    thumbnail: z
      .string()
      .refine(
        isScriptThumbnail,
        'A thumbnail is a data:image/webp;base64 URL of at most 64 kB (png and jpeg are admitted).',
      )
      .optional(),
    version: z.number().int().min(1),
    history: z.array(scriptVersionSchema).max(STUDIO_LIMITS.personalHistory).optional(),
    parentId: z
      .string()
      .regex(PARENT_ID, 'A parent id is "<tier>:<id>@<version>".')
      .optional(),
    author: z.enum(['craftkit', 'agent', 'user']),
    trust: z.enum(['trusted', 'unreviewed']),
    licence: licenceSchema,
    origin: originSchema.optional(),
    createdAt: isoInstant,
    updatedAt: isoInstant,
  })
  .superRefine((entry, context) => {
    const named = declaredLibs(entry.code);
    const declared = [...entry.libs].sort();
    const used = [...named.libs].sort();
    if (declared.join(',') !== used.join(',')) {
      context.addIssue({
        code: 'custom',
        path: ['libs'],
        message: `libs must list exactly the libraries the code loads: [${named.libs.join(', ')}] (declared [${entry.libs.join(', ')}]).`,
      });
    }
    if (entry.sound !== named.sound) {
      context.addIssue({
        code: 'custom',
        path: ['sound'],
        message: named.sound
          ? 'sound must be true: the code uses ck.sound or audio: true.'
          : 'sound must be false: the code never uses ck.sound or audio: true.',
      });
    }
    for (const [index, past] of (entry.history ?? []).entries()) {
      if (past.version >= entry.version) {
        context.addIssue({
          code: 'custom',
          path: ['history', index, 'version'],
          message: `History version ${String(past.version)} is not older than the entry (v${String(entry.version)}).`,
        });
      }
    }
  });

// ── Sounds ───────────────────────────────────────────────────────────────────

/*
  zzfx parameter order: volume, randomness, frequency, attack, sustain, release,
  shape, shapeCurve, slide, deltaSlide, pitchJump, pitchJumpTime, repeatTime,
  noise, modulation, bitCrush, delay, sustainVolume, decay, tremolo, filter.
  The sound lasts attack + decay + sustain + release + delay seconds; the
  defaults below are zzfx's own.
*/
const ZZFX_LENGTH_DEFAULTS = { attack: 0, sustain: 0, release: 0.1, delay: 0, decay: 0 } as const;

/** Seconds a zzfx parameter list plays for (sound/zzfx-params owns the public twin). */
function zzfxSeconds(params: readonly number[]): number {
  const at = (index: number, fallback: number): number => {
    const value = params[index];
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : fallback;
  };
  return (
    at(3, ZZFX_LENGTH_DEFAULTS.attack) +
    at(18, ZZFX_LENGTH_DEFAULTS.decay) +
    at(4, ZZFX_LENGTH_DEFAULTS.sustain) +
    at(5, ZZFX_LENGTH_DEFAULTS.release) +
    at(16, ZZFX_LENGTH_DEFAULTS.delay)
  );
}

export const zzfxParamsSchema: z.ZodType<number[]> = z
  .array(z.number())
  .min(1)
  .max(STUDIO_LIMITS.zzfxNumbers)
  .superRefine((params, context) => {
    const volume = params[0] ?? 1;
    if (volume < 0 || volume > 1) {
      context.addIssue({ code: 'custom', path: [0], message: 'zzfx volume is 0..1.' });
    }
    if (zzfxSeconds(params) > STUDIO_LIMITS.zzfxSeconds) {
      context.addIssue({
        code: 'custom',
        message: `A zzfx sound lasts at most ${String(STUDIO_LIMITS.zzfxSeconds)} seconds.`,
      });
    }
  });

export const soundSourceSchema: z.ZodType<SoundSource> = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('zzfx'), params: zzfxParamsSchema }),
  z.strictObject({
    kind: z.literal('recipe'),
    recipe: studioIdSchema,
    params: z.record(z.string().regex(SCRIPT_PARAM_KEY_PATTERN), z.number()).optional(),
  }),
  z.strictObject({ kind: z.literal('asset'), assetId: z.string().min(1).max(200) }),
]);

export const soundEntrySchema: z.ZodType<SoundEntry> = z.strictObject({
  id: studioIdSchema,
  name: bilingualSchema,
  tags: studioTagsSchema,
  bus: z.enum(SOUND_BUSES),
  source: soundSourceSchema,
  volume: z.number().min(0).max(1),
  loop: z.boolean().optional(),
  author: z.enum(['craftkit', 'agent', 'user']),
  licence: licenceSchema,
  origin: originSchema.optional(),
  createdAt: isoInstant,
  updatedAt: isoInstant,
});

// ── The customCode jsMeta prop ───────────────────────────────────────────────

export const customCodeJsMetaSchema: z.ZodType<CustomCodeJsMeta> = z.strictObject({
  ref: scriptRefSchema.optional(),
  name: z.union([bilingualSchema, z.string().trim().min(1).max(STUDIO_LIMITS.label)]).optional(),
  tags: studioTagsSchema.optional(),
  params: scriptParamSpecsSchema.optional(),
  libs: libsSchema.optional(),
  save: z.boolean().optional(),
});

// ── The .ckscripts.json bundle ───────────────────────────────────────────────

const bundleAssetSchema = z.strictObject({
  url: z
    .string()
    .regex(/^data:audio\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/]+={0,2}$/u, 'A data:audio URL.'),
  mime: z.string().regex(/^audio\/[a-z0-9.+-]+$/u, 'An audio/* media type.'),
});

export const ckScriptsBundleSchema: z.ZodType<CkScriptsBundle> = z.strictObject({
  format: z.literal('craftkit.scripts'),
  version: z.literal(1),
  exportedAt: isoInstant,
  scripts: z.array(scriptEntrySchema).max(STUDIO_LIMITS.bundleScripts),
  sounds: z.array(soundEntrySchema).max(STUDIO_LIMITS.bundleSounds),
  assets: z.record(z.string().min(1).max(200), bundleAssetSchema).optional(),
  checksums: z.record(
    z.string().min(1).max(64),
    z.string().regex(/^[0-9a-f]{16}$/u, 'A checksum is 16 hex characters.'),
  ),
});
