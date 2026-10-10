/*
  Compact, dependency-free playback data for ck-sound.js. Human labels, tags
  and repair messages stay in the authoring modules; a published page only
  needs ids, buses, synth values and the validated attribute grammar.
*/

export const SOUND_RECIPE_IDS = [
  'wind',
  'rain',
  'ocean-waves',
  'night-crickets',
  'space-drone',
  'warm-pad',
  'desert-wind',
  'oud-drone',
] as const;

export type SoundRecipeId = (typeof SOUND_RECIPE_IDS)[number];
export const SOUND_RECIPE_PARAM_KEYS = ['intensity', 'tone', 'tempo', 'maqam'] as const;
export type SoundRecipeParamKey = (typeof SOUND_RECIPE_PARAM_KEYS)[number];
export type SoundRecipeParams = Partial<Record<SoundRecipeParamKey, number>>;
export type SoundPlaybackBus = 'ui' | 'sfx' | 'ambient';

export const SOUND_MAQAMS = {
  hijaz: [0, 1, 4, 5, 7, 8, 10, 12],
  rast: [0, 2, 3.5, 5, 7, 9, 10.5, 12],
} as const;

type PlaybackRow = readonly [SoundPlaybackBus, RuntimeZzfxParams | Readonly<SoundRecipeParams>];

/** The one source of truth for built-in playback ids and synthesis values. */
export const SOUND_PLAYBACK_BANK = {
  tap: ['ui', [0.45, 0.02, 600, 0.002, 0.005, 0.05, , 1.8, -2]],
  'soft-click': ['ui', [0.3, 0.03, 800, 0.001, 0.002, 0.03, 1, 2, , , , , , , , , , , , , -2400]],
  'toggle-on': ['ui', [0.4, 0.02, 440, 0.005, 0.04, 0.08, , 1.5, , , 220, 0.04]],
  'toggle-off': ['ui', [0.4, 0.02, 660, 0.005, 0.04, 0.08, , 1.5, , , -220, 0.04]],
  'hover-tick': ['ui', [0.18, 0.02, 1800, , 0.002, 0.02, , 2, , , , , , , , , , , , , -6000]],
  'success-chime': [
    'ui',
    [0.5, 0.02, 660, 0.01, 0.08, 0.3, , 1.6, , , 330, 0.07, , , , , 0.12, 0.6, 0.02],
  ],
  'error-buzz': [
    'ui',
    [0.4, 0.03, 140, 0.01, 0.1, 0.12, 2, , -1, , , , , , 40, , , 0.7, 0.02, , -1200],
  ],
  'notify-pop': ['ui', [0.45, 0.02, 780, 0.005, 0.03, 0.12, , 2, , , 390, 0.05, , , , , 0.05, 0.5]],
  'swipe-whoosh': [
    'ui',
    [0.3, 0.2, 180, 0.06, 0.04, 0.18, 4, , 6, , , , , 1.5, , , , 0.7, , , -2600],
  ],
  'page-turn': [
    'ui',
    [0.28, 0.3, 600, 0.01, 0.03, 0.09, 4, , -3, , , , , 2, , 0.1, , 0.6, 0.02, , 1200],
  ],
  pop: ['sfx', [0.6, , 300, , 0.01, 0.06, , 1.5, 30, , , , , , , , , 0.8]],
  bubble: ['sfx', [0.5, 0.1, , 0.01, 0.03, , , 1.3, 18, 2]],
  sparkle: [
    'sfx',
    [0.35, , 1400, 0.01, 0.12, 0.25, , 1.8, , , 350, 0.03, 0.06, , , , 0.08, 0.6, 0.02, 0.3],
  ],
  coin: ['sfx', [0.6, , 1675, , 0.06, 0.24, 1, 1.82, , , 837, 0.06]],
  'laser-zap': [
    'sfx',
    [0.45, , 900, 0.005, 0.05, 0.15, 2, 0.8, -30, , , , , , , , , 0.7, 0.01, , -3500],
  ],
  rise: ['sfx', [0.45, 0.02, 200, 0.2, 0.3, 0.2, , 1.2, 6, , , , , , , , , 0.8, 0.1]],
  fall: ['sfx', [0.45, 0.02, 900, 0.05, 0.3, 0.25, , 1.2, -6, , , , , , , , , 0.8, 0.1]],
  thud: ['sfx', [0.7, , 90, , 0.02, 0.18, , 1.5, -4, , , , , 0.6, , , , 0.8, 0.02, , -500]],
  'glass-ting': ['sfx', [0.4, 0.03, 2100, , 0.01, 0.6, 1, 2.5, , , , , , , 9, , 0.1, 0.5, 0.03]],
  'magic-burst': [
    'sfx',
    [0.5, 0.1, 600, 0.02, 0.2, 0.4, , 1.5, 2, , 500, 0.08, 0.1, , , , 0.15, 0.6, 0.05, 0.2],
  ],
  wind: ['ambient', { intensity: 0.6, tone: 0.45 }],
  rain: ['ambient', { intensity: 0.6, tone: 0.55, tempo: 0.5 }],
  'ocean-waves': ['ambient', { intensity: 0.6, tone: 0.4, tempo: 0.4 }],
  'night-crickets': ['ambient', { intensity: 0.5, tone: 0.6, tempo: 0.5 }],
  'space-drone': ['ambient', { intensity: 0.5, tone: 0.35 }],
  'warm-pad': ['ambient', { intensity: 0.5, tone: 0.5, tempo: 0.4 }],
  'desert-wind': ['ambient', { intensity: 0.6, tone: 0.6 }],
  'oud-drone': ['ambient', { intensity: 0.55, tone: 0.5, tempo: 0.45, maqam: 0 }],
} as const satisfies Readonly<Record<string, PlaybackRow>>;

export type SoundPlaybackEntry =
  | { kind: 'zzfx'; params: RuntimeZzfxParams; bus: 'ui' | 'sfx' }
  | { kind: 'recipe'; id: SoundRecipeId; params: Readonly<SoundRecipeParams>; bus: 'ambient' };

export function soundPlaybackEntry(id: string): SoundPlaybackEntry | undefined {
  if (!Object.hasOwn(SOUND_PLAYBACK_BANK, id)) return undefined;
  const row = SOUND_PLAYBACK_BANK[id as keyof typeof SOUND_PLAYBACK_BANK];
  return Array.isArray(row[1])
    ? { kind: 'zzfx', params: row[1] as RuntimeZzfxParams, bus: row[0] as 'ui' | 'sfx' }
    : {
        kind: 'recipe',
        id: id as SoundRecipeId,
        params: row[1] as Readonly<SoundRecipeParams>,
        bus: 'ambient',
      };
}

export function isRuntimeSoundId(id: string): boolean {
  return Object.hasOwn(SOUND_PLAYBACK_BANK, id);
}

export function isSoundRecipeId(id: string): id is SoundRecipeId {
  const entry = soundPlaybackEntry(id);
  return entry?.kind === 'recipe';
}

const ZZFX_DEFAULTS: readonly number[] = [
  1, 0.05, 220, 0, 0, 0.1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0,
];

export type RuntimeZzfxParams = readonly (number | null | undefined)[];
export type ZzfxParams = RuntimeZzfxParams;

export function runtimeZzfxParam(params: RuntimeZzfxParams, index: number): number {
  const value = params[index];
  return typeof value === 'number' ? value : (ZZFX_DEFAULTS[index] ?? 0);
}

export { runtimeZzfxParam as zzfxParam };

export function isRuntimeZzfxParams(value: unknown): value is RuntimeZzfxParams {
  if (!Array.isArray(value) || value.length === 0 || value.length > 21) return false;
  if (value.some((item) => item != null && (typeof item !== 'number' || !Number.isFinite(item)))) {
    return false;
  }
  const params = value as RuntimeZzfxParams;
  const volume = runtimeZzfxParam(params, 0);
  const frequency = runtimeZzfxParam(params, 2);
  if (volume < 0 || volume > 1 || frequency < 0 || frequency > 20_000) return false;
  for (const index of [3, 4, 5, 16, 18]) if (runtimeZzfxParam(params, index) < 0) return false;
  return [3, 4, 5, 16, 18].reduce((sum, index) => sum + runtimeZzfxParam(params, index), 0) <= 4;
}

const ZZFX_NUMBER = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/iu;

export function parseRuntimeZzfx(text: string): (number | undefined)[] | undefined {
  const match = /^zzfx\((.*)\)$/u.exec(text);
  if (match === null) return undefined;
  const body = match[1] ?? '';
  if (body === '') return undefined;
  const items = body.split(',');
  if (items.length > 21) return undefined;
  const values: (number | undefined)[] = [];
  for (const item of items) {
    if (item === '') values.push(undefined);
    else if (ZZFX_NUMBER.test(item)) values.push(Number(item));
    else return undefined;
  }
  return isRuntimeZzfxParams(values) ? values : undefined;
}

export const SOUND_TRIGGERS = ['click', 'hover', 'enter', 'leave', 'ambient'] as const;
export type SoundTrigger = (typeof SOUND_TRIGGERS)[number];
export type SoundRefSpec =
  | { kind: 'bank'; id: string }
  | { kind: 'lib'; id: string }
  | { kind: 'asset'; id: string }
  | { kind: 'zzfx'; params: (number | undefined)[] };
export interface SoundToken {
  trigger: SoundTrigger;
  ref: SoundRefSpec;
  volume?: number | undefined;
}

const LIBRARY_ID = /^[a-z][a-z0-9-]{0,47}$/u;
const ASSET_ID = /^[A-Za-z0-9._~%-]{1,128}$/u;
const VOLUME = /^(?:0(?:\.\d{1,3})?|1(?:\.0{1,3})?|\.\d{1,3})$/u;

function runtimeSoundRef(text: string): SoundRefSpec | undefined {
  if (text.startsWith('lib:')) {
    const id = text.slice(4);
    return LIBRARY_ID.test(id) ? { kind: 'lib', id } : undefined;
  }
  if (text.startsWith('asset:')) {
    const id = text.slice(6);
    return ASSET_ID.test(id) ? { kind: 'asset', id } : undefined;
  }
  if (text.startsWith('zzfx(')) {
    const params = parseRuntimeZzfx(text);
    return params === undefined ? undefined : { kind: 'zzfx', params };
  }
  return isRuntimeSoundId(text) ? { kind: 'bank', id: text } : undefined;
}

/** Runtime twin of parseSoundAttribute: same accepted grammar, without repair strings. */
export function parseSoundAttributeRuntime(value: string): { tokens: SoundToken[] } | undefined {
  const raw = value.trim().split(/\s+/u);
  if (raw.length === 0 || raw.length > 4 || raw[0] === '') return undefined;
  const tokens: SoundToken[] = [];
  let ambient = false;
  for (const text of raw) {
    const colon = text.indexOf(':');
    const trigger = text.slice(0, colon);
    if (colon < 0 || !(SOUND_TRIGGERS as readonly string[]).includes(trigger)) return undefined;
    let rest = text.slice(colon + 1);
    let volume: number | undefined;
    const at = rest.lastIndexOf('@');
    if (at >= 0) {
      const level = rest.slice(at + 1);
      if (!VOLUME.test(level)) return undefined;
      volume = Number(level);
      rest = rest.slice(0, at);
    }
    const ref = runtimeSoundRef(rest);
    if (ref === undefined) return undefined;
    if (trigger === 'ambient') {
      if (ambient) return undefined;
      ambient = true;
    }
    tokens.push({ trigger: trigger as SoundTrigger, ref, volume });
  }
  return { tokens };
}
