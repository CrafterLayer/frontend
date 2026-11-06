/*
  Creature definitions for `s.lib.creatures` (character art, 2026-11-05). A character is data:
  a kind (an archetype recipe), a name or seed that fixes its look, and optional art direction —
  palette, head and body shape, ears, horns, wings, tail, spikes, eyes, mouth, pattern, accessory
  and mood. `defineCreature` turns whatever authored scene code passed (plain JavaScript: missing,
  misspelt or out-of-range values) into one complete, frozen definition; unknown fields are
  ignored and unknown values fall back to the kind's recipe.

  Originals only: every recipe is our own shape language (round, soft, big-eyed) and none copies
  a known character or brand. There is no pig recipe (the owner excluded pigs), and nothing is
  meant to scare a 3-9 year old — 'grumpy' pouts, it never glares.
*/

import {
  accentOf,
  bellyOf,
  hex,
  inkOf,
  lchToNumber,
  numberToLch,
  parseColor,
  unmuddy,
  type Lch,
  type Palette,
} from './color';

export const CREATURE_KINDS = [
  'dragon',
  'unicorn',
  'monster',
  'dino',
  'robot',
  'alien',
  'ghost',
  'slime',
  'griffin',
  'fox',
  'bunny',
  'bear',
  'star',
  'mushroom',
  'sea',
] as const;
export type CreatureKind = (typeof CREATURE_KINDS)[number];

export const CREATURE_MOODS = [
  'happy',
  'calm',
  'surprised',
  'sad',
  'sleepy',
  'excited',
  'shy',
  'grumpy',
] as const;
export type CreatureMood = (typeof CREATURE_MOODS)[number];

export const BODY_SHAPES = ['pear', 'round', 'tall', 'chubby'] as const;
export const HEAD_SHAPES = ['round', 'wide', 'tall', 'box'] as const;
export const EAR_STYLES = [
  'none',
  'round',
  'pointy',
  'long',
  'droopy',
  'pony',
  'fin',
  'tuft',
  'antenna',
  'bolts',
] as const;
export const HORN_STYLES = ['none', 'nubs', 'unicorn', 'antlers', 'crystal'] as const;
export const WING_STYLES = ['none', 'bat', 'feather', 'fairy'] as const;
export const TAIL_STYLES = ['none', 'spade', 'thick', 'fluffy', 'puff', 'pony', 'tuft'] as const;
export const SPIKE_STYLES = ['none', 'crest', 'plates', 'mane'] as const;
export const EYE_STYLES = ['big', 'small', 'lashes', 'one', 'three'] as const;
export const MOUTH_STYLES = ['auto', 'fang', 'beak', 'none'] as const;
export const PATTERNS = [
  'none',
  'spots',
  'stripes',
  'stars',
  'hearts',
  'plates',
  'feathers',
  'mask',
  'panel',
] as const;
export const ACCESSORIES = [
  'none',
  'bow',
  'scarf',
  'flower',
  'crown',
  'glasses',
  'leaf',
  'party-hat',
  'mark',
] as const;

export type BodyShape = (typeof BODY_SHAPES)[number];
export type HeadShape = (typeof HEAD_SHAPES)[number];
export type EarStyle = (typeof EAR_STYLES)[number];
export type HornStyle = (typeof HORN_STYLES)[number];
export type WingStyle = (typeof WING_STYLES)[number];
export type TailStyle = (typeof TAIL_STYLES)[number];
export type SpikeStyle = (typeof SPIKE_STYLES)[number];
export type EyeStyle = (typeof EYE_STYLES)[number];
export type MouthStyle = (typeof MOUTH_STYLES)[number];
export type Pattern = (typeof PATTERNS)[number];
export type Accessory = (typeof ACCESSORIES)[number];

export const CREATURE_LIMITS = Object.freeze({
  minSize: 24,
  maxSize: 1024,
  defaultSize: 200,
  maxName: 64,
});

/** What scene code passes. Every field is optional; `kind: 'random'` lets the seed choose. */
export interface CreatureInput {
  kind?: CreatureKind | 'random' | (string & {});
  name?: string;
  seed?: string | number;
  palette?: Partial<Record<keyof Palette, string | number>> | string | number;
  body?: BodyShape;
  head?: HeadShape;
  ears?: EarStyle;
  horns?: HornStyle;
  wings?: WingStyle;
  tail?: TailStyle;
  spikes?: SpikeStyle;
  eyes?: EyeStyle;
  mouth?: MouthStyle;
  pattern?: Pattern;
  accessory?: Accessory;
  mood?: CreatureMood;
  /** false draws no ink outline (a softer, painted look). */
  outline?: boolean;
}

/** A complete, normalised character (frozen, JSON-safe). */
export interface CreatureDef {
  readonly kind: CreatureKind;
  readonly name: string;
  /** The 32-bit seed the name (or seed) hashes to; it fixes the small variations. */
  readonly seed: number;
  readonly palette: Readonly<Record<keyof Palette, string>>;
  readonly body: BodyShape;
  readonly head: HeadShape;
  readonly ears: EarStyle;
  readonly horns: HornStyle;
  readonly wings: WingStyle;
  readonly tail: TailStyle;
  readonly spikes: SpikeStyle;
  readonly eyes: EyeStyle;
  readonly mouth: MouthStyle;
  readonly pattern: Pattern;
  readonly accessory: Accessory;
  readonly mood: CreatureMood;
  readonly outline: boolean;
}

/* Words an author may write for a kind. */
const KIND_ALIASES: Readonly<Record<string, CreatureKind>> = {
  pony: 'unicorn',
  blob: 'monster',
  'friendly-monster': 'monster',
  dinosaur: 'dino',
  bot: 'robot',
  martian: 'alien',
  spirit: 'ghost',
  bird: 'griffin',
  owl: 'griffin',
  chick: 'griffin',
  'fox-spirit': 'fox',
  kitsune: 'fox',
  rabbit: 'bunny',
  'bunny-sprite': 'bunny',
  'bear-cub': 'bear',
  cub: 'bear',
  teddy: 'bear',
  'star-sprite': 'star',
  'mushroom-sprite': 'mushroom',
  'sea-creature': 'sea',
  whale: 'sea',
  octopus: 'sea',
  octo: 'sea',
  jelly: 'sea',
};

/** A kind's art direction. Hue lists are OKLCH hues; the seed picks one and jitters it. */
interface Recipe {
  hues: readonly number[];
  l: readonly [number, number];
  c: readonly [number, number];
  body: BodyShape;
  head: HeadShape;
  ears: EarStyle;
  horns: HornStyle;
  wings: WingStyle;
  tail: TailStyle;
  spikes: SpikeStyle;
  eyes: EyeStyle;
  mouth: MouthStyle;
  patterns: readonly Pattern[];
  accessories: readonly Accessory[];
  /** Iris hues the seed picks from. */
  irises?: readonly number[];
  /** Accent turn from the body hue (degrees); the complementary 160 by default. */
  accentTurn?: number;
  /** A temperature complement instead: coral on cool bodies, aqua on warm or pink ones. */
  accentWarmCool?: boolean;
}

const R = (r: Partial<Recipe> & Pick<Recipe, 'hues' | 'l' | 'c'>): Recipe => ({
  body: 'pear',
  head: 'round',
  ears: 'none',
  horns: 'none',
  wings: 'none',
  tail: 'none',
  spikes: 'none',
  eyes: 'big',
  mouth: 'auto',
  patterns: ['none'],
  accessories: ['none'],
  ...r,
});

export const RECIPES: Readonly<Record<CreatureKind, Recipe>> = {
  dragon: R({
    hues: [150, 175, 200, 255, 290, 320, 25],
    l: [0.74, 0.82],
    c: [0.1, 0.13],
    ears: 'fin',
    horns: 'nubs',
    wings: 'bat',
    tail: 'spade',
    spikes: 'crest',
    mouth: 'fang',
    patterns: ['plates'],
    accessories: ['none', 'none', 'scarf', 'crown'],
    accentWarmCool: true,
  }),
  unicorn: R({
    hues: [300, 330, 260, 200, 60],
    l: [0.94, 0.97],
    c: [0.02, 0.04],
    ears: 'pony',
    horns: 'unicorn',
    tail: 'pony',
    spikes: 'mane',
    eyes: 'lashes',
    patterns: ['none', 'stars'],
    accessories: ['none', 'flower', 'bow'],
    irises: [300, 240, 330],
    accentTurn: 40,
  }),
  monster: R({
    hues: [20, 60, 200, 260, 300, 340, 175],
    l: [0.7, 0.8],
    c: [0.12, 0.15],
    body: 'round',
    horns: 'nubs',
    mouth: 'fang',
    patterns: ['spots', 'none', 'stripes'],
    accessories: ['none', 'none', 'bow', 'party-hat'],
  }),
  dino: R({
    hues: [130, 145, 165, 190, 60, 300],
    l: [0.74, 0.8],
    c: [0.11, 0.14],
    tail: 'thick',
    spikes: 'plates',
    patterns: ['spots', 'stripes', 'none'],
    accessories: ['none', 'none', 'scarf', 'party-hat'],
    accentTurn: 180,
  }),
  robot: R({
    hues: [235, 210, 180, 90, 20],
    l: [0.84, 0.9],
    c: [0.025, 0.05],
    body: 'chubby',
    head: 'box',
    ears: 'antenna',
    patterns: ['panel'],
    accessories: ['none', 'none', 'bow', 'glasses'],
    irises: [195, 160, 85],
    accentTurn: 170,
  }),
  alien: R({
    hues: [130, 150, 175, 300, 320],
    l: [0.8, 0.86],
    c: [0.1, 0.14],
    head: 'wide',
    ears: 'antenna',
    patterns: ['none', 'spots'],
    accessories: ['none', 'none', 'glasses', 'scarf'],
  }),
  ghost: R({
    hues: [290, 230, 340, 165, 200],
    l: [0.95, 0.97],
    c: [0.02, 0.035],
    body: 'round',
    patterns: ['none'],
    accessories: ['none', 'none', 'bow', 'party-hat'],
    irises: [260, 300, 200],
  }),
  slime: R({
    hues: [140, 175, 200, 300, 330, 85],
    l: [0.78, 0.84],
    c: [0.13, 0.17],
    body: 'round',
    patterns: ['none'],
    accessories: ['none', 'none', 'leaf', 'crown'],
  }),
  griffin: R({
    hues: [80, 70, 55, 230, 200],
    l: [0.8, 0.86],
    c: [0.08, 0.12],
    ears: 'tuft',
    wings: 'feather',
    tail: 'tuft',
    mouth: 'beak',
    patterns: ['feathers'],
    accessories: ['none', 'scarf', 'crown'],
    accentTurn: 160,
  }),
  fox: R({
    hues: [50, 55, 45, 330, 290, 200],
    l: [0.74, 0.82],
    c: [0.09, 0.14],
    ears: 'pointy',
    tail: 'fluffy',
    patterns: ['mask'],
    accessories: ['mark', 'mark', 'scarf', 'bow'],
    accentTurn: 300,
  }),
  bunny: R({
    hues: [80, 350, 300, 60, 200],
    l: [0.88, 0.94],
    c: [0.025, 0.05],
    ears: 'long',
    tail: 'puff',
    patterns: ['none'],
    accessories: ['leaf', 'flower', 'bow', 'none'],
    accentTurn: 120,
  }),
  bear: R({
    hues: [55, 65, 70, 30, 340],
    l: [0.66, 0.78],
    c: [0.05, 0.09],
    body: 'chubby',
    head: 'wide',
    ears: 'round',
    tail: 'puff',
    patterns: ['none'],
    accessories: ['none', 'scarf', 'bow', 'party-hat'],
    accentTurn: 200,
  }),
  star: R({
    hues: [92, 85, 345, 200, 300],
    l: [0.88, 0.92],
    c: [0.1, 0.15],
    body: 'round',
    patterns: ['none'],
    accessories: ['none', 'none', 'bow', 'crown'],
    irises: [260, 300, 40],
    accentTurn: 200,
  }),
  mushroom: R({
    hues: [25, 355, 310, 55, 240],
    l: [0.64, 0.72],
    c: [0.13, 0.16],
    patterns: ['spots'],
    accessories: ['none', 'none', 'leaf', 'bow'],
    accentTurn: 120,
  }),
  sea: R({
    hues: [200, 230, 15, 340, 290, 175],
    l: [0.74, 0.82],
    c: [0.1, 0.13],
    body: 'round',
    ears: 'fin',
    patterns: ['spots', 'none'],
    accessories: ['none', 'none', 'bow', 'crown'],
  }),
};

const IRISES = [55, 240, 145, 300, 75, 195];

function pick<T extends string>(list: readonly T[], value: unknown, fallback: T): T {
  return typeof value === 'string' && (list as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/** A deterministic 32-bit hash (FNV-1a with a final avalanche). */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** mulberry32: a small seeded generator, 0 ≤ r < 1. */
export function rngOf(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The identity text: case, accents of spacing and surrounding blanks do not matter. */
function seedText(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return undefined;
  const text = value.trim().toLowerCase().replace(/\s+/gu, ' ').slice(0, CREATURE_LIMITS.maxName);
  return text.length > 0 ? text : undefined;
}

export function kindOf(value: unknown): CreatureKind | 'random' {
  if (typeof value !== 'string') return 'random';
  const word = value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/gu, '-');
  if ((CREATURE_KINDS as readonly string[]).includes(word)) return word as CreatureKind;
  return KIND_ALIASES[word] ?? 'random';
}

const between = (r: () => number, [a, b]: readonly [number, number]) => a + (b - a) * r();
const choose = <T>(r: () => number, list: readonly T[]): T =>
  list[Math.floor(r() * list.length) % list.length] as T;

function paletteOf(kind: CreatureKind, r: () => number, input: unknown): Palette {
  const recipe = RECIPES[kind];
  const given =
    typeof input === 'string' || typeof input === 'number'
      ? { body: input }
      : typeof input === 'object' && input !== null
        ? (input as Record<string, unknown>)
        : {};
  // The seed always draws the same numbers in the same order, whatever the author overrides.
  const hue = choose(r, recipe.hues) + (r() - 0.5) * 16;
  const base: Lch = { l: between(r, recipe.l), c: between(r, recipe.c), h: hue };
  const iris = choose(r, recipe.irises ?? IRISES) + (r() - 0.5) * 12;
  const authored = parseColor(given['body']);
  const body = authored ?? lchToNumber(unmuddy(base));
  const b = numberToLch(body);
  const warmCool = (h: number) => (h >= 140 && h < 290 ? 28 : 195);
  const accent =
    recipe.accentWarmCool === true && authored === undefined
      ? lchToNumber({ l: 0.78, c: 0.13, h: warmCool(((b.h % 360) + 360) % 360) })
      : recipe.accentTurn === undefined || authored !== undefined
        ? accentOf(body)
        : lchToNumber(
            unmuddy({
              l: Math.max(0.7, Math.min(0.86, b.l - 0.02)),
              c: Math.max(0.1, Math.min(0.15, b.c + 0.03)),
              h: b.h + recipe.accentTurn,
            }),
          );
  return {
    body,
    belly: parseColor(given['belly']) ?? bellyOf(body),
    accent: parseColor(given['accent']) ?? accent,
    eyes: parseColor(given['eyes']) ?? lchToNumber({ l: 0.56, c: 0.13, h: iris }),
    ink: parseColor(given['ink']) ?? inkOf(body),
  };
}

/** The normalised, frozen definition for any input (see CreatureInput). */
export function defineCreature(input?: CreatureInput | null | string): CreatureDef {
  const raw: Record<string, unknown> =
    typeof input === 'string'
      ? { kind: input }
      : typeof input === 'object' && input !== null
        ? { ...input }
        : {};
  const name =
    typeof raw['name'] === 'string' ? raw['name'].trim().slice(0, CREATURE_LIMITS.maxName) : '';
  const asked = kindOf(raw['kind']);
  // A whole-number seed is the hash itself, so a definition (or random(n)) round-trips exactly.
  const given = raw['seed'];
  const seed =
    typeof given === 'number' && Number.isInteger(given) && given >= 0 && given <= 0xffffffff
      ? given
      : hashString(seedText(given) ?? seedText(name) ?? (asked === 'random' ? 'random' : asked));
  const r = rngOf(seed);
  const kind: CreatureKind = asked === 'random' ? choose(r, CREATURE_KINDS) : asked;
  const recipe = RECIPES[kind];
  const palette = paletteOf(kind, r, raw['palette']);
  const pattern = choose(r, recipe.patterns);
  const accessory = choose(r, recipe.accessories);
  return Object.freeze({
    kind,
    name,
    seed,
    palette: Object.freeze({
      body: hex(palette.body),
      belly: hex(palette.belly),
      accent: hex(palette.accent),
      eyes: hex(palette.eyes),
      ink: hex(palette.ink),
    }),
    body: pick(BODY_SHAPES, raw['body'], recipe.body),
    head: pick(HEAD_SHAPES, raw['head'], recipe.head),
    ears: pick(EAR_STYLES, raw['ears'], recipe.ears),
    horns: pick(HORN_STYLES, raw['horns'], recipe.horns),
    wings: pick(WING_STYLES, raw['wings'], recipe.wings),
    tail: pick(TAIL_STYLES, raw['tail'], recipe.tail),
    spikes: pick(SPIKE_STYLES, raw['spikes'], recipe.spikes),
    eyes: pick(EYE_STYLES, raw['eyes'], recipe.eyes),
    mouth: pick(MOUTH_STYLES, raw['mouth'], recipe.mouth),
    pattern: pick(PATTERNS, raw['pattern'], pattern),
    accessory: pick(ACCESSORIES, raw['accessory'], accessory),
    mood: moodOf(raw['mood']),
    outline: raw['outline'] !== false,
  });
}

/* Mood words an author may write. */
const MOOD_ALIASES: Readonly<Record<string, CreatureMood>> = {
  joy: 'happy',
  glad: 'happy',
  smile: 'happy',
  neutral: 'calm',
  content: 'calm',
  wow: 'surprised',
  amazed: 'surprised',
  shocked: 'surprised',
  unhappy: 'sad',
  cry: 'sad',
  tired: 'sleepy',
  sleep: 'sleepy',
  thrilled: 'excited',
  delighted: 'excited',
  bashful: 'shy',
  embarrassed: 'shy',
  'grumpy-but-cute': 'grumpy',
  cross: 'grumpy',
  angry: 'grumpy',
  mad: 'grumpy',
  pouty: 'grumpy',
};

/** The mood a word names, or undefined. */
export function knownMood(value: unknown): CreatureMood | undefined {
  if (typeof value !== 'string') return undefined;
  const word = value.trim().toLowerCase();
  if ((CREATURE_MOODS as readonly string[]).includes(word)) return word as CreatureMood;
  return MOOD_ALIASES[word];
}

/** The mood a word names; 'happy' for anything unknown. */
export function moodOf(value: unknown): CreatureMood {
  return knownMood(value) ?? 'happy';
}

/** A whole random character for a seed (any number or text): define({ kind: 'random', seed }). */
export function randomCreature(seed?: unknown): CreatureDef {
  return defineCreature({
    kind: 'random',
    seed: typeof seed === 'number' || typeof seed === 'string' ? seed : 'random',
  });
}

/** The palette of a definition as numbers. */
export function paletteNumbers(def: CreatureDef): Palette {
  return {
    body: parseColor(def.palette.body) ?? 0xf2a65a,
    belly: parseColor(def.palette.belly) ?? 0xfff1e0,
    accent: parseColor(def.palette.accent) ?? 0x7ec8e3,
    eyes: parseColor(def.palette.eyes) ?? 0x4a3a6a,
    ink: parseColor(def.palette.ink) ?? 0x3a2e48,
  };
}

/** Accepts a definition or an input and returns a definition (re-normalising either way). */
export function asDef(input: unknown): CreatureDef {
  return defineCreature(input as CreatureInput | null | undefined);
}
