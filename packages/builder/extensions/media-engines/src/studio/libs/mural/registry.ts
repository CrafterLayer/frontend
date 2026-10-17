import type { Primitive } from './types';
import { aurora, clouds, gradient, moon, rain, snow, stars, sun } from './sky';
import { cliffs, dunes, hills, mountains, plains, rocks } from './land';
import { bubbles, lake, river, sea, underwater, waves } from './water';
import { bush, cactus, coral, flowers, grass, seaweed, tree, TREE_KINDS } from './plants';
import { arches, house, mosque, skyline } from './city';
import {
  barn,
  bridge,
  campfire,
  fence,
  lantern,
  lanterns,
  pagoda,
  tent,
  torii,
  windmill,
} from './built';
import { boat, car, ship, train } from './vehicles';
import { BEAST_NAMES, beast, bird, butterfly, fish } from './creatures';
import { PERSON_KINDS, person } from './people';
import { PLANET_KINDS, castle, comet, dragon, fireflies, planet, rocket, sparkles } from './wonder';

/*
  The item vocabulary (mural kit, 2026-10-14): every name a spec may place, its group, whether it
  spans a range (`wide`) or stands at a point, its default size, count and kinds, and the aliases
  and plurals a model is likely to write. Unknown names are reported with the closest real one.
*/

export interface Entry {
  draw: Primitive;
  group: string;
  /** Spans from..to (hills, sea, a skyline…); otherwise stands at x and repeats with `count`. */
  wide?: boolean;
  /** Covers the whole view and never pans (rain, snow). */
  overlay?: boolean;
  size: number;
  count?: number;
  kinds?: readonly string[];
  /** Where y defaults: the sky (a fixed height), the horizon, or the layer's ground. */
  at?: number;
}

const SKY = 'sky';
const LAND = 'land';
const WATER = 'water';
const PLANTS = 'plants';
const BUILT = 'built';
const CREATURES = 'creatures';
const PEOPLE = 'people';
const SPACE = 'space';
const FANTASY = 'fantasy';

export const ITEMS: Readonly<Record<string, Entry>> = {
  gradient: { draw: gradient, group: SKY, wide: true, size: 400, at: 400 },
  sun: { draw: sun, group: SKY, size: 100, at: 130 },
  moon: { draw: moon, group: SKY, size: 100, kinds: ['crescent', 'full'], at: 140 },
  stars: { draw: stars, group: SKY, wide: true, size: 100, count: 160, at: 470 },
  clouds: {
    draw: clouds,
    group: SKY,
    wide: true,
    size: 100,
    count: 5,
    kinds: ['puffy', 'streak'],
    at: 260,
  },
  aurora: { draw: aurora, group: SKY, wide: true, size: 100, at: 300 },
  rain: { draw: rain, group: SKY, wide: true, overlay: true, size: 100, count: 220 },
  snow: { draw: snow, group: SKY, wide: true, overlay: true, size: 100, count: 160 },
  hills: { draw: hills, group: LAND, wide: true, size: 90 },
  mountains: { draw: mountains, group: LAND, wide: true, size: 220, kinds: ['rocky', 'snowy'] },
  dunes: { draw: dunes, group: LAND, wide: true, size: 70 },
  plains: {
    draw: plains,
    group: LAND,
    wide: true,
    size: 40,
    kinds: ['grass', 'fields', 'snow', 'sand', 'road'],
  },
  rocks: { draw: rocks, group: LAND, size: 60 },
  cliffs: { draw: cliffs, group: LAND, size: 100 },
  sea: { draw: sea, group: WATER, wide: true, size: 100, count: 120 },
  waves: { draw: waves, group: WATER, wide: true, size: 60 },
  river: { draw: river, group: WATER, size: 60 },
  lake: { draw: lake, group: WATER, size: 60, kinds: ['lake', 'pond'] },
  underwater: { draw: underwater, group: WATER, wide: true, size: 100 },
  bubbles: { draw: bubbles, group: WATER, wide: true, size: 100, count: 24 },
  tree: { draw: tree, group: PLANTS, size: 150, kinds: TREE_KINDS },
  bush: { draw: bush, group: PLANTS, size: 70 },
  grass: { draw: grass, group: PLANTS, wide: true, size: 100, count: 90 },
  flowers: { draw: flowers, group: PLANTS, wide: true, size: 100, count: 40 },
  cactus: { draw: cactus, group: PLANTS, size: 110 },
  seaweed: { draw: seaweed, group: PLANTS, size: 110 },
  coral: { draw: coral, group: PLANTS, size: 90, kinds: ['branch', 'fan', 'brain'] },
  house: { draw: house, group: BUILT, size: 100, kinds: ['cottage', 'arab', 'japanese'] },
  skyline: {
    draw: skyline,
    group: BUILT,
    wide: true,
    size: 100,
    kinds: ['generic', 'old', 'modern'],
  },
  mosque: { draw: mosque, group: BUILT, size: 100, kinds: ['teal', 'gold'] },
  arches: { draw: arches, group: BUILT, wide: true, size: 100 },
  bridge: { draw: bridge, group: BUILT, size: 100, kinds: ['stone', 'wood'] },
  lantern: { draw: lantern, group: BUILT, size: 100, kinds: ['fanous', 'paper', 'street'] },
  lanterns: {
    draw: lanterns,
    group: BUILT,
    wide: true,
    size: 100,
    count: 8,
    kinds: ['fanous', 'paper'],
  },
  tent: { draw: tent, group: BUILT, size: 100, kinds: ['bedouin', 'camp'] },
  campfire: { draw: campfire, group: BUILT, size: 100 },
  fence: { draw: fence, group: BUILT, wide: true, size: 100 },
  barn: { draw: barn, group: BUILT, size: 100 },
  windmill: { draw: windmill, group: BUILT, size: 100 },
  torii: { draw: torii, group: BUILT, size: 100 },
  pagoda: { draw: pagoda, group: BUILT, size: 100 },
  boat: { draw: boat, group: BUILT, size: 90, kinds: ['sail', 'row'] },
  ship: { draw: ship, group: BUILT, size: 100 },
  car: { draw: car, group: BUILT, size: 80 },
  train: { draw: train, group: BUILT, size: 70, count: 3 },
  bird: { draw: bird, group: CREATURES, size: 70, at: 220 },
  fish: { draw: fish, group: CREATURES, size: 60, kinds: ['tropical', 'koi'] },
  butterfly: { draw: butterfly, group: CREATURES, size: 60 },
  person: { draw: person, group: PEOPLE, size: 100, kinds: PERSON_KINDS },
  planet: { draw: planet, group: SPACE, size: 160, kinds: PLANET_KINDS, at: 250 },
  rocket: { draw: rocket, group: SPACE, size: 100 },
  comet: { draw: comet, group: SPACE, size: 100, at: 160 },
  castle: { draw: castle, group: FANTASY, size: 100 },
  dragon: { draw: dragon, group: FANTASY, size: 100, at: 220 },
  fireflies: { draw: fireflies, group: FANTASY, wide: true, size: 100, count: 30 },
  sparkles: { draw: sparkles, group: FANTASY, wide: true, size: 100, count: 24 },
};

for (const name of BEAST_NAMES) {
  (ITEMS as Record<string, Entry>)[name] = { draw: beast(name), group: CREATURES, size: 100 };
}

/** Other words for an item, each with the kind it implies. */
const ALIASES: Readonly<Record<string, [string, string?]>> = {
  sky: ['gradient'],
  star: ['stars'],
  cloud: ['clouds'],
  hill: ['hills'],
  mountain: ['mountains'],
  dune: ['dunes'],
  desert: ['dunes'],
  ground: ['plains'],
  field: ['plains', 'fields'],
  fields: ['plains', 'fields'],
  road: ['plains', 'road'],
  rock: ['rocks'],
  cliff: ['cliffs'],
  ocean: ['sea'],
  wave: ['waves'],
  pond: ['lake', 'pond'],
  bubble: ['bubbles'],
  palm: ['tree', 'palm'],
  pine: ['tree', 'pine'],
  olive: ['tree', 'olive'],
  cypress: ['tree', 'cypress'],
  blossom: ['tree', 'blossom'],
  sakura: ['tree', 'blossom'],
  forest: ['tree'],
  trees: ['tree'],
  bushes: ['bush'],
  flower: ['flowers'],
  city: ['skyline'],
  town: ['skyline', 'old'],
  oldtown: ['skyline', 'old'],
  towers: ['skyline', 'modern'],
  houses: ['house'],
  dome: ['mosque'],
  minaret: ['mosque'],
  arch: ['arches'],
  fanous: ['lantern', 'fanous'],
  lamp: ['lantern', 'street'],
  fire: ['campfire'],
  boats: ['boat'],
  sailboat: ['boat', 'sail'],
  birds: ['bird'],
  koi: ['fish', 'koi'],
  butterflies: ['butterfly'],
  people: ['person'],
  man: ['person', 'robe'],
  woman: ['person', 'dress'],
  child: ['person', 'child'],
  diver: ['person', 'diver'],
  figure: ['person'],
  earth: ['planet', 'earth'],
  mars: ['planet', 'mars'],
  firefly: ['fireflies'],
  magic: ['sparkles'],
  sparkle: ['sparkles'],
};

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0] ?? 0;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const next = row[j] ?? 0;
      row[j] = Math.min(next + 1, (row[j - 1] ?? 0) + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = next;
    }
  }
  return row[b.length] ?? 0;
}

/** The item a written name means, with the kind it implies; or the closest name to suggest. */
export function lookup(raw: string): { name: string; kind?: string } | { suggest?: string } {
  const word = raw
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/gu, '');
  if (ITEMS[word] !== undefined) return { name: word };
  const alias = ALIASES[word] ?? (word.endsWith('s') ? ALIASES[word.slice(0, -1)] : undefined);
  if (alias !== undefined)
    return { name: alias[0], ...(alias[1] === undefined ? {} : { kind: alias[1] }) };
  if (word.endsWith('s') && ITEMS[word.slice(0, -1)] !== undefined)
    return { name: word.slice(0, -1) };
  let best = '';
  let score = 3;
  for (const name of [...Object.keys(ITEMS), ...Object.keys(ALIASES)]) {
    const d = distance(word, name);
    if (d < score) [best, score] = [name, d];
  }
  return best === '' ? {} : { suggest: best };
}

/** Item names by group, for the reference and for agents. */
export function vocabulary(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [name, entry] of Object.entries(ITEMS)) (out[entry.group] ??= []).push(name);
  return out;
}
