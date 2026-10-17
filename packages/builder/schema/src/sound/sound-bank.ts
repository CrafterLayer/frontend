/*
  The built-in sound bank (pixi-studio DESIGN §C.1): 28 presets as DATA.

  Nothing here is a recording. Twenty presets are ZzFX parameter arrays (a
  tiny MIT synth renders them in the browser) and eight are ambient RECIPES
  (noise + filters + slow LFOs, or a Karplus–Strong string) that the
  `ck-sound.js` engine synthesises. So the bank carries no licence beyond
  ZzFX's, and it costs a few hundred bytes, not megabytes.

  - UI (bus `ui`, 10): quiet, short, for controls.
  - Effects (bus `sfx`, 10): pops, sparkles, sweeps and impacts for murals.
  - Ambient (bus `ambient`, 8): looping beds; `durationMs` is one cycle.

  Pure data and lookups, no imports with runtime cost: the engine bundles it.
*/

import type { Bilingual, SoundBus } from '../studio/types';
import {
  isRuntimeSoundId,
  isSoundRecipeId as isRuntimeRecipeId,
  SOUND_MAQAMS,
  SOUND_PLAYBACK_BANK,
  SOUND_RECIPE_IDS,
  SOUND_RECIPE_PARAM_KEYS,
  runtimeZzfxParam,
  type SoundRecipeId,
  type SoundRecipeParamKey,
  type SoundRecipeParams,
} from './runtime';
import { zzfxDurationSeconds } from './zzfx-params';

export { SOUND_MAQAMS, SOUND_RECIPE_IDS, SOUND_RECIPE_PARAM_KEYS };
export type { SoundRecipeId, SoundRecipeParamKey, SoundRecipeParams };

interface SoundBankBase {
  id: string;
  label: Bilingual;
  bus: SoundBus;
  tags: readonly string[];
  /** One-shot length; for an ambient bed, the length of one cycle. */
  durationMs: number;
}

export interface ZzfxBankEntry extends SoundBankBase {
  kind: 'zzfx';
  params: readonly number[];
}

export interface RecipeBankEntry extends SoundBankBase {
  kind: 'recipe';
  id: SoundRecipeId;
  params: Readonly<SoundRecipeParams>;
}

export type SoundBankEntry = ZzfxBankEntry | RecipeBankEntry;

interface SoundBankDetail {
  readonly label: Bilingual;
  readonly tags: readonly string[];
  readonly durationMs?: number;
}

const BANK_DETAILS = {
  tap: { label: { en: 'Tap', ar: 'نقرة خفيفة' }, tags: ['ui', 'click'] },
  'soft-click': { label: { en: 'Soft click', ar: 'نقرة ناعمة' }, tags: ['ui', 'click'] },
  'toggle-on': { label: { en: 'Toggle on', ar: 'تفعيل' }, tags: ['ui', 'toggle'] },
  'toggle-off': { label: { en: 'Toggle off', ar: 'إيقاف' }, tags: ['ui', 'toggle'] },
  'hover-tick': { label: { en: 'Hover tick', ar: 'تكّة مرور' }, tags: ['ui', 'hover'] },
  'success-chime': {
    label: { en: 'Success chime', ar: 'رنين نجاح' },
    tags: ['ui', 'feedback', 'success'],
  },
  'error-buzz': {
    label: { en: 'Error buzz', ar: 'طنين خطأ' },
    tags: ['ui', 'feedback', 'error'],
  },
  'notify-pop': { label: { en: 'Notification', ar: 'تنبيه' }, tags: ['ui', 'notify'] },
  'swipe-whoosh': {
    label: { en: 'Swipe whoosh', ar: 'سحبة هوائية' },
    tags: ['ui', 'transition', 'motion'],
  },
  'page-turn': {
    label: { en: 'Page turn', ar: 'قلب صفحة' },
    tags: ['ui', 'transition', 'paper'],
  },
  pop: { label: { en: 'Pop', ar: 'فرقعة' }, tags: ['pop', 'impact'] },
  bubble: { label: { en: 'Bubble', ar: 'فقاعة' }, tags: ['pop', 'water'] },
  sparkle: { label: { en: 'Sparkle', ar: 'بريق' }, tags: ['magic', 'shimmer'] },
  coin: { label: { en: 'Coin', ar: 'عملة' }, tags: ['game', 'reward'] },
  'laser-zap': { label: { en: 'Laser zap', ar: 'ليزر' }, tags: ['game', 'sci-fi'] },
  rise: { label: { en: 'Rise', ar: 'صعود' }, tags: ['motion', 'transition'] },
  fall: { label: { en: 'Fall', ar: 'هبوط' }, tags: ['motion', 'transition'] },
  thud: { label: { en: 'Thud', ar: 'ارتطام' }, tags: ['impact'] },
  'glass-ting': { label: { en: 'Glass ting', ar: 'رنّة زجاج' }, tags: ['glass', 'shimmer'] },
  'magic-burst': {
    label: { en: 'Magic burst', ar: 'انفجار سحري' },
    tags: ['magic', 'reward'],
  },
  wind: {
    label: { en: 'Wind', ar: 'رياح' },
    tags: ['ambient', 'nature', 'weather'],
    durationMs: 12_000,
  },
  rain: {
    label: { en: 'Rain', ar: 'مطر' },
    tags: ['ambient', 'nature', 'weather'],
    durationMs: 8_000,
  },
  'ocean-waves': {
    label: { en: 'Ocean waves', ar: 'أمواج البحر' },
    tags: ['ambient', 'nature', 'sea'],
    durationMs: 11_000,
  },
  'night-crickets': {
    label: { en: 'Night crickets', ar: 'صراصير الليل' },
    tags: ['ambient', 'nature', 'night'],
    durationMs: 6_000,
  },
  'space-drone': {
    label: { en: 'Space drone', ar: 'همهمة فضائية' },
    tags: ['ambient', 'space', 'sci-fi'],
    durationMs: 16_000,
  },
  'warm-pad': {
    label: { en: 'Warm pad', ar: 'وسادة دافئة' },
    tags: ['ambient', 'music'],
    durationMs: 10_000,
  },
  'desert-wind': {
    label: { en: 'Desert wind', ar: 'رياح الصحراء' },
    tags: ['ambient', 'nature', 'desert', 'arabic'],
    durationMs: 14_000,
  },
  'oud-drone': {
    label: { en: 'Oud and maqam', ar: 'عود ومقام' },
    tags: ['ambient', 'music', 'arabic'],
    durationMs: 9_000,
  },
} as const satisfies Record<keyof typeof SOUND_PLAYBACK_BANK, SoundBankDetail>;

export const SOUND_BANK: readonly SoundBankEntry[] = Object.entries(SOUND_PLAYBACK_BANK).map(
  ([id, row]): SoundBankEntry => {
    const detail: SoundBankDetail = BANK_DETAILS[id as keyof typeof BANK_DETAILS];
    if (Array.isArray(row[1])) {
      const sparse = row[1];
      const params = Array.from({ length: sparse.length }, (_, index) =>
        runtimeZzfxParam(sparse, index),
      );
      return {
        id,
        label: detail.label,
        bus: row[0] as 'ui' | 'sfx',
        kind: 'zzfx',
        params,
        tags: detail.tags,
        durationMs: Math.round(zzfxDurationSeconds(params) * 1000),
      };
    }
    return {
      id: id as SoundRecipeId,
      label: detail.label,
      bus: 'ambient',
      kind: 'recipe',
      params: row[1] as Readonly<SoundRecipeParams>,
      tags: detail.tags,
      durationMs: detail.durationMs ?? 0,
    };
  },
);

/** Every bank id, in bank order. */
export const SOUND_BANK_IDS: readonly string[] = SOUND_BANK.map((entry) => entry.id);

const BANK_BY_ID: ReadonlyMap<string, SoundBankEntry> = new Map(
  SOUND_BANK.map((entry) => [entry.id, entry]),
);

/** The bank entry for `id`, or undefined. */
export function soundBankEntry(id: string): SoundBankEntry | undefined {
  return BANK_BY_ID.get(id);
}

export function isSoundBankId(id: string): boolean {
  return isRuntimeSoundId(id);
}

export function isSoundRecipeId(id: string): id is SoundRecipeId {
  return isRuntimeRecipeId(id);
}

/** What is wrong with a recipe's tuning, or undefined. */
export function soundRecipeParamsProblem(params: unknown): string | undefined {
  if (params === undefined) return undefined;
  if (typeof params !== 'object' || params === null || Array.isArray(params)) {
    return 'recipe params are an object of numbers';
  }
  for (const [key, value] of Object.entries(params)) {
    if (!(SOUND_RECIPE_PARAM_KEYS as readonly string[]).includes(key)) {
      return `recipe param '${key}' is not one of ${SOUND_RECIPE_PARAM_KEYS.join(', ')}`;
    }
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
      return `recipe param '${key}' is a number from 0 to 1`;
    }
  }
  return undefined;
}

/** Bank entries whose label (either language), id or tag contains `query`. */
export function searchSoundBank(query: string): readonly SoundBankEntry[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return SOUND_BANK;
  return SOUND_BANK.filter(
    (entry) =>
      entry.id.includes(needle) ||
      entry.label.en.toLowerCase().includes(needle) ||
      entry.label.ar.includes(needle) ||
      entry.tags.some((tag) => tag.includes(needle)),
  );
}
