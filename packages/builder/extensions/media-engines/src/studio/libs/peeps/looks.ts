/*
  The looks of `s.lib.peeps` (character art, 2026-10-13): Open Peeps, Pablo Stanley's hand-drawn
  people (design CC0 1.0), drawn by DiceBear's open-peeps style (code MIT). Everything here is
  pure and synchronous: options in, one SVG string out, the same string for the same options on
  every page and every visit.

  Identity comes from the seed (a character's name): DiceBear draws hair, skin, outfit and hair
  colour from one seeded sequence in a fixed order, and every pick consumes the sequence whether
  or not an option pins it. So a mood (which pins the face) or an art-direction override (which
  pins one part) never reshuffles the rest of the character.
*/

import { createAvatar } from '@dicebear/core';
import * as openPeeps from '@dicebear/open-peeps';

/** The moods a script names, each mapped to one Open Peeps face (brows, eyes and mouth). */
export const MOOD_FACES = Object.freeze({
  calm: 'smile',
  happy: 'smileBig',
  surprised: 'awe',
  sad: 'solemn',
  angry: 'veryAngry',
  thinking: 'suspicious',
  laughing: 'smileLOL',
  scared: 'concernedFear',
  worried: 'concerned',
  tired: 'tired',
  serious: 'serious',
  love: 'lovingGrin1',
} as const);

export type PeepMood = keyof typeof MOOD_FACES;
export const PEEP_MOODS = Object.freeze(Object.keys(MOOD_FACES) as PeepMood[]);

/* Words a script or a dialogue line's emotion uses for the same moods (English and Arabic). */
const MOOD_ALIASES: Readonly<Record<string, PeepMood>> = Object.freeze({
  neutral: 'calm',
  content: 'calm',
  peaceful: 'calm',
  idle: 'calm',
  joy: 'happy',
  joyful: 'happy',
  glad: 'happy',
  excited: 'happy',
  cheerful: 'happy',
  smile: 'happy',
  shocked: 'surprised',
  amazed: 'surprised',
  astonished: 'surprised',
  wow: 'surprised',
  upset: 'sad',
  unhappy: 'sad',
  crying: 'sad',
  mad: 'angry',
  furious: 'angry',
  annoyed: 'angry',
  curious: 'thinking',
  confused: 'thinking',
  think: 'thinking',
  thoughtful: 'thinking',
  laugh: 'laughing',
  amused: 'laughing',
  afraid: 'scared',
  fear: 'scared',
  frightened: 'scared',
  anxious: 'worried',
  nervous: 'worried',
  sleepy: 'tired',
  exhausted: 'tired',
  stern: 'serious',
  determined: 'serious',
  loving: 'love',
  هادئ: 'calm',
  هادئة: 'calm',
  سعيد: 'happy',
  سعيدة: 'happy',
  فرح: 'happy',
  مندهش: 'surprised',
  مندهشة: 'surprised',
  متفاجئ: 'surprised',
  حزين: 'sad',
  حزينة: 'sad',
  غاضب: 'angry',
  غاضبة: 'angry',
  يفكر: 'thinking',
  تفكر: 'thinking',
  يضحك: 'laughing',
  تضحك: 'laughing',
  خائف: 'scared',
  خائفة: 'scared',
  قلق: 'worried',
  قلقة: 'worried',
  متعب: 'tired',
  متعبة: 'tired',
  جاد: 'serious',
  جادة: 'serious',
  حب: 'love',
});

/** Emoji-style skin tone names over the style's own five tones. */
export const SKIN_TONES = Object.freeze({
  light: 'ffdbb4',
  'medium-light': 'edb98a',
  medium: 'd08b5b',
  'medium-dark': 'ae5d29',
  dark: '694d3d',
} as const);

/** Hair colour names over the style's own palette (`headContrastColor`). */
export const HAIR_COLORS = Object.freeze({
  black: '2c1b18',
  white: 'e8e1e1',
  platinum: 'ecdcbf',
  blonde: 'd6b370',
  pink: 'f59797',
  golden: 'b58143',
  auburn: 'a55728',
  brown: '724133',
  'dark-brown': '4a312c',
  red: 'c93305',
} as const);

/** A few outfit colour names; any '#rrggbb' works too. */
const CLOTHING_COLORS: Readonly<Record<string, string>> = Object.freeze({
  coral: 'e78276',
  orange: 'ffcf77',
  yellow: 'fdea6b',
  green: '78e185',
  teal: '9ddadb',
  blue: '8fa7df',
  pink: 'e279c7',
  white: 'f8fafc',
  black: '1f2937',
});

type Schema = Readonly<Record<string, { items?: { enum?: readonly string[] } } | undefined>>;
const properties = openPeeps.schema.properties as unknown as Schema;
function names(key: string): readonly string[] {
  return Object.freeze([...(properties[key]?.items?.enum ?? [])]);
}

/** The style's own part names, in its schema order (a seed indexes into these). */
export const PEEP_HAIR = names('head');
export const PEEP_FACES = names('face');
export const PEEP_ACCESSORIES = names('accessories');
export const PEEP_FACIAL_HAIR = names('facialHair');
/* Left to the seed, accessories are spectacles: an eyepatch only when a script asks for it. */
const SEEDED_ACCESSORIES = PEEP_ACCESSORIES.filter((name) => name !== 'eyepatch');

export const PEEP_LIMITS = Object.freeze({ minSize: 16, maxSize: 2048, defaultSize: 256 });

/** What a script passes to svg/dataUrl/texture. Unknown or invalid values fall back silently. */
export interface PeepOptions {
  /** The identity: a character's name (case and spacing do not matter). Defaults to `name`. */
  seed?: string | number;
  name?: string;
  /** One of PEEP_MOODS (or an alias such as 'excited', 'سعيد'); default 'calm'. */
  mood?: string;
  /** A raw Open Peeps face name (PEEP_FACES); wins over mood. */
  face?: string;
  /** A hair style (PEEP_HAIR: 'long', 'bun', 'hijab', 'afro', 'short1'…); default from the seed. */
  hair?: string;
  /** A HAIR_COLORS name or '#rrggbb'. */
  hairColor?: string;
  /** A SKIN_TONES name or '#rrggbb'. */
  skin?: string;
  /** The outfit: a colour name or '#rrggbb'; defaults to `color` when that is set. */
  clothing?: string;
  /** The character's colour (a cast colour); it dresses the outfit unless `clothing` is set. */
  color?: string | number;
  /** false: none; true: spectacles from the seed; a name (PEEP_ACCESSORIES): that one. */
  accessories?: boolean | string;
  /** false: none; true: from the seed; a name (PEEP_FACIAL_HAIR): that one. */
  facialHair?: boolean | string;
  /** Mirror the character (they look to the other side). */
  flip?: boolean;
  /** A '#rrggbb' square behind the character; transparent when absent. */
  background?: string;
  /** Clip to a circle (an avatar badge). */
  round?: boolean;
  /** Width and height in CSS pixels (16..2048, default 256). */
  size?: number;
}

const HEX = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/iu;

/** '#abc' / 'abc' / '#aabbcc' / a named colour → 'aabbcc' (lower case), or undefined. */
export function hexOf(
  value: unknown,
  named: Readonly<Record<string, string>> = {},
): string | undefined {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffffff) {
    return value.toString(16).padStart(6, '0');
  }
  if (typeof value !== 'string') return undefined;
  const key = value.trim().toLowerCase();
  const fromName = Object.hasOwn(named, key) ? named[key] : undefined;
  if (fromName !== undefined) return fromName;
  const match = HEX.exec(key);
  if (match === null) return undefined;
  const digits = match[1] ?? '';
  // Only ASCII hex digits reach here, so doubling each character is safe.
  return digits.length === 3 ? digits.replace(/./gu, '$&$&') : digits;
}

/** A character's seed: the name with case and runs of spaces folded, at most 64 characters. */
export function seedOf(value: unknown): string {
  const text = typeof value === 'number' && Number.isFinite(value) ? String(value) : value;
  if (typeof text !== 'string') return 'peep';
  const folded = text.trim().replace(/\s+/gu, ' ').toLowerCase().slice(0, 64);
  return folded === '' ? 'peep' : folded;
}

/** The canonical mood a word names; 'calm' for anything unknown. */
export function moodOf(value: unknown): PeepMood {
  if (typeof value !== 'string') return 'calm';
  const key = value.trim().toLowerCase();
  if (Object.hasOwn(MOOD_FACES, key)) return key as PeepMood;
  return Object.hasOwn(MOOD_ALIASES, key) ? (MOOD_ALIASES[key] ?? 'calm') : 'calm';
}

export function sizeOf(value: unknown): number {
  const size = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : NaN;
  if (Number.isNaN(size)) return PEEP_LIMITS.defaultSize;
  return Math.min(PEEP_LIMITS.maxSize, Math.max(PEEP_LIMITS.minSize, size));
}

function pick(list: readonly string[], value: unknown): string | undefined {
  return typeof value === 'string' && list.includes(value) ? value : undefined;
}

/** Turn a part option (boolean | name) into DiceBear's list + probability, consuming the same picks. */
function part(
  value: unknown,
  list: readonly string[],
  seeded: readonly string[],
  probability: number,
): { values: string[]; probability: number } {
  const named = pick(list, value);
  if (named !== undefined) return { values: [named], probability: 100 };
  if (value === false) return { values: [...seeded], probability: 0 };
  return { values: [...seeded], probability: value === true ? 100 : probability };
}

/** The DiceBear options one PeepOptions object means (exported for tests). */
export function dicebearOptions(options: PeepOptions | null | undefined): Record<string, unknown> {
  const input: PeepOptions = typeof options === 'object' && options !== null ? options : {};
  const face = pick(PEEP_FACES, input.face) ?? MOOD_FACES[moodOf(input.mood)];
  const accessories = part(input.accessories, PEEP_ACCESSORIES, SEEDED_ACCESSORIES, 20);
  const facialHair = part(input.facialHair, PEEP_FACIAL_HAIR, PEEP_FACIAL_HAIR, 10);
  const result: Record<string, unknown> = {
    seed: seedOf(input.seed ?? input.name),
    size: sizeOf(input.size),
    face: [face],
    accessories: accessories.values,
    accessoriesProbability: accessories.probability,
    facialHair: facialHair.values,
    facialHairProbability: facialHair.probability,
    // Masks hide the mood; the pick is still consumed, so the rest of the look stays put.
    maskProbability: 0,
  };
  // An absent key keeps the style's full list; an explicit undefined would empty it.
  const hair = pick(PEEP_HAIR, input.hair);
  if (hair !== undefined) result['head'] = [hair];
  const hairColor = hexOf(input.hairColor, HAIR_COLORS);
  if (hairColor !== undefined) result['headContrastColor'] = [hairColor];
  const skin = hexOf(input.skin, SKIN_TONES);
  if (skin !== undefined) result['skinColor'] = [skin];
  const clothing = hexOf(input.clothing, CLOTHING_COLORS) ?? hexOf(input.color, CLOTHING_COLORS);
  if (clothing !== undefined) result['clothingColor'] = [clothing];
  if (input.flip === true) result['flip'] = true;
  const background = hexOf(input.background);
  if (background !== undefined) result['backgroundColor'] = [background];
  if (input.round === true) result['radius'] = 50;
  return result;
}

/** The SVG markup for one character: same options, same string. */
export function peepSvg(options?: PeepOptions | null): string {
  return createAvatar(openPeeps, dicebearOptions(options)).toString();
}

/** The parts and colours the seed chose (the outfit colour is a character's natural accent). */
export function peepTraits(options?: PeepOptions | null): Readonly<Record<string, string>> {
  const extra = createAvatar(openPeeps, dicebearOptions(options)).toJson().extra;
  const traits: Record<string, string> = {};
  for (const [key, value] of Object.entries(extra)) {
    if (typeof value === 'string') traits[key] = value;
  }
  return Object.freeze(traits);
}

/* Percent-encode only what a data: URL must not carry raw; SVG path data stays readable. */
const URL_UNSAFE = /[^\w .,:;=+\-/'()!*~@$&]/gu;

/** `data:image/svg+xml,…` for an <img>, a CSS background or a dialogue portrait. */
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml,${svg.replaceAll('"', "'").replace(URL_UNSAFE, encodeURIComponent)}`;
}

export function peepDataUrl(options?: PeepOptions | null): string {
  return svgDataUrl(peepSvg(options));
}

export const PEEPS_CREDIT = Object.freeze({
  art: 'Open Peeps by Pablo Stanley (openpeeps.com), CC0 1.0',
  code: 'DiceBear open-peeps style by Florian Körner, MIT',
});
