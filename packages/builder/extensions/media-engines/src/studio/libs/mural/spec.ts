import type { Depth, Time } from './types';
import { MOODS, TIMES, readColors } from './palette';
import { ITEMS, lookup, type Entry } from './registry';

/*
  The mural spec, read defensively (mural kit, 2026-10-14). A spec is plain JSON-like data a model
  writes in 1–3k characters; nothing in it may throw. Every key is checked, numbers are clamped,
  unknown items and keys are skipped with a warning that names the closest real word, and the
  result is a normalised spec `compose` draws without further checks.
*/

export const DEPTHS: readonly Depth[] = ['sky', 'far', 'mid', 'near', 'front'];
export const FLAGS = [
  'snow',
  'lights',
  'hang',
  'staff',
  'head',
  'peep',
  'saddle',
  'flowers',
] as const;
const ITEM_KEYS = new Set([
  'item',
  'type',
  'id',
  'x',
  'y',
  'size',
  'from',
  'to',
  'kind',
  'color',
  'colors',
  'count',
  'seed',
  'vary',
  'layer',
  ...FLAGS,
]);
const BEAT_KEYS = new Set([
  'label',
  'at',
  'dur',
  'camera',
  'time',
  'walk',
  'move',
  'fly',
  'drive',
  'swim',
  'show',
  'hide',
  'grow',
  'lights',
  'state',
  'still',
]);
const SPEC_KEYS = new Set([
  'width',
  'seed',
  'mood',
  'palette',
  'colors',
  'tones',
  'time',
  'horizon',
  'ground',
  'sky',
  'layers',
  'cast',
  'beats',
  'mode',
  'scrub',
  'loop',
  'still',
  'speed',
]);
const STATES = new Set([
  'idle',
  'walk',
  'run',
  'jump',
  'wave',
  'talk',
  'celebrate',
  'hurt',
  'think',
]);

export interface NItem {
  name: string;
  entry: Entry;
  depth: Depth;
  id?: string;
  x?: number;
  y?: number;
  size?: number;
  from?: number;
  to?: number;
  kind: string;
  color?: number;
  colors?: number[];
  count?: number;
  seed?: number;
  vary: number;
  flag: Record<string, unknown>;
}

export interface Target {
  x?: number;
  y?: number;
  rotation?: number;
  scale?: number;
  alpha?: number;
}

export interface NBeat {
  label: string;
  at?: number;
  dur: number;
  camera?: number | { x: number };
  time?: Time;
  move: Record<string, Target & { walk: boolean }>;
  show: string[];
  hide: string[];
  grow: string[];
  lights?: boolean;
  state: Record<string, string>;
  still: boolean;
}

export interface NSpec {
  width: number;
  seed: number;
  mood: string;
  colors: Record<string, unknown>;
  theme: boolean;
  times: Time[];
  horizon: number;
  ground: number;
  sky: boolean;
  items: NItem[];
  beats: NBeat[];
  mode: 'loop' | 'scrub' | 'still' | 'once';
  still?: string | number;
  speed: number;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function num(v: unknown, lo: number, hi: number): number | undefined {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : undefined;
}

function strings(v: unknown): string[] {
  return (Array.isArray(v) ? v : [v]).filter((s): s is string => typeof s === 'string' && s !== '');
}

function unknownKeys(
  raw: Record<string, unknown>,
  allowed: Set<string>,
  where: string,
  warn: (m: string) => void,
): void {
  for (const key of Object.keys(raw))
    if (!allowed.has(key)) warn(`${where}: unknown key "${key}" ignored`);
}

function readTime(v: unknown, where: string, warn: (m: string) => void): Time | undefined {
  if (v === undefined) return undefined;
  if (typeof v === 'string' && (TIMES as readonly string[]).includes(v)) return v as Time;
  warn(`${where}: time ${JSON.stringify(v)} is not one of ${TIMES.join(', ')}`);
  return undefined;
}

function readItem(raw: unknown, depth: Depth, warn: (m: string) => void): NItem | undefined {
  const spec = typeof raw === 'string' ? { item: raw } : raw;
  if (!isRecord(spec)) {
    warn(`${depth}: an item must be a name or an object, got ${typeof raw}`);
    return undefined;
  }
  const written = spec['item'] ?? spec['type'];
  if (typeof written !== 'string') {
    warn(`${depth}: an item without "item" was skipped`);
    return undefined;
  }
  const found = lookup(written);
  if (!('name' in found)) {
    warn(
      `${depth}: unknown item "${written}" skipped${found.suggest === undefined ? '' : ` — did you mean "${found.suggest}"?`}`,
    );
    return undefined;
  }
  const entry = ITEMS[found.name];
  if (entry === undefined) return undefined;
  unknownKeys(spec, ITEM_KEYS, found.name, warn);
  let kind =
    typeof spec['kind'] === 'string' ? spec['kind'] : (found.kind ?? entry.kinds?.[0] ?? '');
  if (entry.kinds !== undefined && !entry.kinds.includes(kind)) {
    warn(
      `${found.name}: kind "${kind}" is not one of ${entry.kinds.join(', ')}; using "${entry.kinds[0] ?? ''}"`,
    );
    kind = entry.kinds[0] ?? '';
  }
  const flag: Record<string, unknown> = {};
  for (const key of FLAGS) if (spec[key] !== undefined) flag[key] = spec[key];
  const color = spec['color'] === undefined ? undefined : readColors(spec['color'])?.[0];
  const colors = spec['colors'] === undefined ? undefined : readColors(spec['colors']);
  if (spec['color'] !== undefined && color === undefined)
    warn(`${found.name}: color must be '#rrggbb' or 0xRRGGBB`);
  if (spec['colors'] !== undefined && colors === undefined)
    warn(`${found.name}: colors must be a list of '#rrggbb'`);
  const item: NItem = {
    name: found.name,
    entry,
    depth,
    kind,
    vary: num(spec['vary'], 0, 0.8) ?? 0.25,
    flag,
  };
  const id = spec['id'];
  if (typeof id === 'string' || typeof id === 'number') item.id = String(id);
  const set = (
    key: 'x' | 'y' | 'size' | 'from' | 'to' | 'count' | 'seed',
    lo: number,
    hi: number,
  ) => {
    const value = num(spec[key], lo, hi);
    if (value !== undefined) item[key] = key === 'count' ? Math.round(value) : value;
    else if (spec[key] !== undefined) warn(`${found.name}: ${key} must be a number`);
  };
  set('x', -2000, 12000);
  set('y', -400, 1200);
  set('size', 4, 1200);
  set('from', -2000, 12000);
  set('to', -2000, 12000);
  set('count', 1, 400);
  set('seed', 0, 2 ** 31);
  if (color !== undefined) item.color = color;
  if (colors !== undefined) item.colors = colors;
  return item;
}

function readTarget(v: unknown): Target | undefined {
  if (typeof v === 'number') return { x: v };
  if (!isRecord(v)) return undefined;
  const t: Target = {};
  for (const key of ['x', 'y', 'rotation', 'scale', 'alpha'] as const) {
    const n = num(v[key], -12000, 12000);
    if (n !== undefined) t[key] = n;
  }
  return Object.keys(t).length > 0 ? t : undefined;
}

function readBeat(
  raw: unknown,
  index: number,
  ids: Set<string>,
  warn: (m: string) => void,
): NBeat | undefined {
  if (!isRecord(raw)) {
    warn(`beat ${String(index + 1)}: must be an object`);
    return undefined;
  }
  unknownKeys(raw, BEAT_KEYS, `beat ${String(index + 1)}`, warn);
  const label =
    typeof raw['label'] === 'string' && /^[A-Za-z_]\w*$/u.test(raw['label'])
      ? raw['label']
      : `b${String(index + 1)}`;
  const known = (id: string, what: string) => {
    if (ids.has(id)) return true;
    warn(`beat "${label}": ${what} "${id}" has no item with that id`);
    return false;
  };
  const beat: NBeat = {
    label,
    dur: num(raw['dur'], 0.5, 30) ?? 5,
    move: {},
    show: [],
    hide: [],
    grow: [],
    state: {},
    still: raw['still'] === true,
  };
  const at = num(raw['at'], 0, 600);
  if (at !== undefined) beat.at = at;
  const camera = raw['camera'];
  const camX = isRecord(camera) ? num(camera['x'], -2000, 12000) : undefined;
  if (typeof camera === 'number' && Number.isFinite(camera))
    beat.camera = camera <= 1 ? Math.max(0, camera) : { x: camera };
  else if (camX !== undefined) beat.camera = { x: camX };
  else if (camera !== undefined) warn(`beat "${label}": camera is 0..1 or { x }`);
  const time = readTime(raw['time'], `beat "${label}"`, warn);
  if (time !== undefined) beat.time = time;
  for (const key of ['walk', 'move', 'fly', 'drive', 'swim'] as const) {
    const moves = raw[key];
    if (moves === undefined) continue;
    if (!isRecord(moves)) {
      warn(`beat "${label}": ${key} is { id: x } or { id: { x, y } }`);
      continue;
    }
    for (const [id, to] of Object.entries(moves)) {
      const target = readTarget(to);
      if (target === undefined) warn(`beat "${label}": ${key}.${id} needs a number or { x, y }`);
      else if (known(id, key)) beat.move[id] = { ...target, walk: key === 'walk' };
    }
  }
  for (const key of ['show', 'hide', 'grow'] as const)
    beat[key] = strings(raw[key]).filter((id) => known(id, key));
  if (raw['lights'] !== undefined) beat.lights = raw['lights'] === true || raw['lights'] === 'on';
  if (isRecord(raw['state'])) {
    for (const [id, state] of Object.entries(raw['state'])) {
      if (typeof state === 'string' && STATES.has(state)) {
        if (known(id, 'state')) beat.state[id] = state;
      } else warn(`beat "${label}": state "${String(state)}" is not a rig state`);
    }
  }
  return beat;
}

/** Read a spec into its normalised form; every problem becomes a warning, never an exception. */
export function normalize(input: unknown, warnings: string[] = []): NSpec {
  const warn = (message: string) => {
    if (warnings.length < 40) warnings.push(message);
  };
  const spec = isRecord(input) ? input : {};
  if (!isRecord(input)) warn('the spec must be an object; drew an empty mural');
  unknownKeys(spec, SPEC_KEYS, 'spec', warn);
  const moodRaw = spec['mood'] ?? spec['palette'];
  let mood = typeof moodRaw === 'string' ? moodRaw : 'meadow';
  if (MOODS[mood] === undefined) {
    if (moodRaw !== 'theme')
      warn(`mood "${mood}" is not one of ${Object.keys(MOODS).join(', ')}; using meadow`);
    mood = 'meadow';
  }
  const timeList = (Array.isArray(spec['time']) ? spec['time'] : [spec['time'] ?? 'day'])
    .map((t: unknown) => readTime(t, 'time', warn))
    .filter((t): t is Time => t !== undefined);
  const horizon = num(spec['horizon'], 120, 700) ?? 470;
  const out: NSpec = {
    width: num(spec['width'], 1280, 8000) ?? 1280,
    seed: Math.round(num(spec['seed'], 0, 2 ** 31) ?? 1),
    mood,
    colors: isRecord(spec['colors']) ? spec['colors'] : {},
    theme: spec['tones'] === 'theme' || moodRaw === 'theme',
    times: timeList.length > 0 ? timeList : ['day'],
    horizon,
    ground: num(spec['ground'], horizon, 720) ?? Math.max(horizon, 640),
    sky: spec['sky'] !== false,
    items: [],
    beats: [],
    mode:
      spec['scrub'] === true || spec['mode'] === 'scrub'
        ? 'scrub'
        : spec['mode'] === 'still'
          ? 'still'
          : spec['loop'] === false || spec['mode'] === 'once'
            ? 'once'
            : 'loop',
    speed: num(spec['speed'], 0.1, 4) ?? 1,
  };
  const layers = spec['layers'];
  const add = (raw: unknown, depth: Depth) => {
    const own = isRecord(raw) && typeof raw['layer'] === 'string' ? raw['layer'] : depth;
    const d = (DEPTHS as readonly string[]).includes(own) ? (own as Depth) : depth;
    const item = readItem(raw, d, warn);
    if (item !== undefined && out.items.length < 300) out.items.push(item);
  };
  if (isRecord(layers)) {
    for (const [name, list] of Object.entries(layers)) {
      if (!(DEPTHS as readonly string[]).includes(name)) {
        warn(`layers: unknown layer "${name}" (use ${DEPTHS.join(', ')})`);
        continue;
      }
      for (const raw of Array.isArray(list) ? list : [list]) add(raw, name as Depth);
    }
  } else if (Array.isArray(layers)) {
    for (const raw of layers) add(raw, 'near');
  } else if (layers !== undefined) warn('layers is { sky, far, mid, near, front: [items] }');
  for (const raw of Array.isArray(spec['cast']) ? spec['cast'] : []) add(raw, 'near');
  const ids = new Set(out.items.flatMap((item) => (item.id === undefined ? [] : [item.id])));
  const beats = Array.isArray(spec['beats']) ? spec['beats'] : [];
  beats.slice(0, 8).forEach((raw, i) => {
    const beat = readBeat(raw, i, ids, warn);
    if (beat !== undefined) out.beats.push(beat);
  });
  if (beats.length > 8) warn('at most 8 beats; the rest were dropped');
  if (out.beats.length > 0 && (out.beats.length < 3 || out.beats.length > 5))
    warn(`a story reads best in 3-5 beats (got ${String(out.beats.length)})`);
  const still = spec['still'];
  if (typeof still === 'string' || (typeof still === 'number' && still >= 0 && still <= 1))
    out.still = still;
  return out;
}
