/*
  A story's people (character art, 2026-10-13): `s.lib.peeps.cast([...])` turns names — or the
  same `{ id, name, color }` entries a dialogue cast takes — into stable looks. The seed is the
  name, so Layla looks the same in every section, chapter and visit; a cast colour dresses the
  outfit, so the dialogue box's name colour and the character agree; `members()` hands
  `s.lib.dialogue.cast` a portrait per mood.
*/

import {
  PEEP_MOODS,
  hexOf,
  moodOf,
  peepDataUrl,
  peepTraits,
  seedOf,
  type PeepMood,
  type PeepOptions,
} from './looks';

export const MAX_PEEP_CAST = 32;
const ID = /^[\p{L}\p{N}_-]{1,48}$/u;

/** A cast entry: a name, or a dialogue-style member with any PeepOptions as art direction. */
export interface PeepCastInput extends PeepOptions {
  id?: string;
  name?: string;
  title?: string;
  side?: 'start' | 'end';
  notes?: string;
}

/** One character: its look (spread it into svg/dataUrl/texture options) plus who it is. */
export interface PeepCharacter extends PeepOptions {
  readonly id: string;
  readonly name: string;
  readonly seed: string;
  /** '#rrggbb': the cast colour, or the outfit colour the seed chose. */
  readonly color: string;
  readonly colorNumber: number;
  readonly title?: string;
  readonly side?: 'start' | 'end';
  readonly notes?: string;
}

/** What `s.lib.dialogue.cast` takes, with the portraits filled in. */
export interface PeepDialogueMember {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly portrait: string;
  readonly expressions: Readonly<Record<string, string>>;
  readonly title?: string;
  readonly side?: 'start' | 'end';
  readonly notes?: string;
}

export interface PeepCast {
  readonly size: number;
  readonly list: readonly PeepCharacter[];
  /** By id or (case-insensitive) name. */
  get(idOrName: string): PeepCharacter | undefined;
  /** Dialogue members with a portrait (calm) and one expression per mood, as data: URLs. */
  members(moods?: readonly string[]): PeepDialogueMember[];
}

/* Only these keys travel from an entry to the look; anything else a script adds is ignored. */
const LOOK_KEYS = [
  'face',
  'hair',
  'hairColor',
  'skin',
  'clothing',
  'accessories',
  'facialHair',
  'flip',
  'background',
  'round',
  'size',
] as const;

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function idFrom(input: PeepCastInput, name: string, index: number): string {
  const given = text(input.id, 48);
  if (ID.test(given)) return given;
  const slug = name
    .toLowerCase()
    .replace(/\s+/gu, '-')
    .replace(/[^\p{L}\p{N}_-]/gu, '')
    .slice(0, 48);
  return ID.test(slug) ? slug : `peep-${String(index + 1)}`;
}

function characterOf(entry: unknown, index: number): PeepCharacter | undefined {
  const input: PeepCastInput =
    typeof entry === 'string'
      ? { name: entry }
      : typeof entry === 'object' && entry !== null
        ? entry
        : {};
  const name = text(input.name, 80) || text(input.id, 48);
  if (name === '') return undefined;
  const look: PeepOptions = {};
  for (const key of LOOK_KEYS) {
    if (input[key] !== undefined) (look as Record<string, unknown>)[key] = input[key];
  }
  const seed = seedOf(input.seed ?? name);
  const given = hexOf(input.color);
  // Without a cast colour the character keeps the outfit its seed chose, and shows it as colour.
  const hex = given ?? (peepTraits({ ...look, seed })['clothingColor'] ?? '#f59e0b').slice(1);
  const title = text(input.title, 80);
  const notes = text(input.notes, 500);
  return Object.freeze({
    ...look,
    ...(title === '' ? {} : { title }),
    ...(input.side === 'start' || input.side === 'end' ? { side: input.side } : {}),
    ...(notes === '' ? {} : { notes }),
    id: idFrom(input, name, index),
    name,
    seed,
    color: `#${hex}`,
    colorNumber: Number.parseInt(hex, 16),
  });
}

/** Authored scene code is plain JavaScript, so every entry is checked at run time. */
export function createPeepCast(entries: unknown): PeepCast {
  if (!Array.isArray(entries) || entries.length > MAX_PEEP_CAST) {
    throw new RangeError(`peeps.cast needs a list of 0..${String(MAX_PEEP_CAST)} names`);
  }
  const byId = new Map<string, PeepCharacter>();
  (entries as readonly unknown[]).forEach((entry, index) => {
    const character = characterOf(entry, index);
    // The same person named twice is one character.
    if (character !== undefined && !byId.has(character.id)) byId.set(character.id, character);
  });
  const list = Object.freeze([...byId.values()]);
  const get = (idOrName: string): PeepCharacter | undefined => {
    if (typeof idOrName !== 'string') return undefined;
    const key = idOrName.trim();
    const lower = key.toLowerCase();
    return (
      byId.get(key) ??
      list.find(
        (member) => member.name.toLowerCase() === lower || member.id.toLowerCase() === lower,
      )
    );
  };
  return Object.freeze({
    size: list.length,
    list,
    get,
    members(moods?: readonly string[]) {
      const wanted: PeepMood[] = Array.isArray(moods)
        ? [...new Set(moods.map(moodOf))].slice(0, 16)
        : [...PEEP_MOODS];
      return list.map((character) => {
        const expressions: Record<string, string> = {};
        for (const mood of wanted) expressions[mood] = peepDataUrl({ ...character, mood });
        const { id, name, color, title, side, notes } = character;
        return Object.freeze({
          id,
          name,
          color,
          portrait: expressions['calm'] ?? peepDataUrl({ ...character, mood: 'calm' }),
          expressions: Object.freeze(expressions),
          ...(title === undefined ? {} : { title }),
          ...(side === undefined ? {} : { side }),
          ...(notes === undefined ? {} : { notes }),
        });
      });
    },
  });
}
