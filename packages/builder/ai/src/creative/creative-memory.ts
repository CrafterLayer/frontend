/*
  Character & asset memory — the project's STORY BIBLE (creative agent, 2026-10-12).

  A creative project is written over many turns and by several section writers at once; without
  a shared record the hero's name, colour and voice drift between scenes, and a later turn
  invents an image URL the project never had. This record keeps the canon:

  - characters: id, name, role, colour, look, voice, traits and the portrait asset;
  - assets: the approved images/sprite sheets/tilesets/sounds a scene may load, with licence;
  - locations: named places with mood, palette and weather;
  - facts: short plot canon ("Layla lost her lantern in chapter 1").

  It is DATA, owned and persisted by the host (like session memory): `readCreativeMemory`
  validates anything loaded, every field is bounded, and the context provider renders it as a
  `data` fragment — it can describe the world, never grant authority or carry instructions.
  `learnCreativeMemory` grows it from scenes the Agent actually wrote (their literal
  `dialogue.cast([...])` arrays and loaded asset URLs), so memory follows the real project.
*/

import { literalArgumentsOf, type LiteralValue } from './literal';

export const CREATIVE_MEMORY_LIMITS = Object.freeze({
  characters: 32,
  assets: 64,
  locations: 24,
  facts: 40,
  traits: 6,
  palette: 6,
  text: 200,
  name: 80,
});

export interface CreativeCharacterV1 {
  readonly id: string;
  readonly name: string;
  readonly role?: string;
  readonly color?: string;
  /** How to draw them: shapes, clothes, colours. */
  readonly look?: string;
  /** How they speak. */
  readonly voice?: string;
  readonly traits?: readonly string[];
  /** Asset id or URL of the portrait. */
  readonly portrait?: string;
}

export type CreativeAssetKind =
  'image' | 'portrait' | 'background' | 'sprite-sheet' | 'tileset' | 'audio';

export const CREATIVE_ASSET_KINDS: readonly CreativeAssetKind[] = [
  'image',
  'portrait',
  'background',
  'sprite-sheet',
  'tileset',
  'audio',
];

export interface CreativeAssetV1 {
  readonly id: string;
  readonly kind: CreativeAssetKind;
  readonly url: string;
  readonly license?: string;
  /** The character it depicts, by id. */
  readonly owner?: string;
  readonly notes?: string;
}

export interface CreativeLocationV1 {
  readonly id: string;
  readonly name: string;
  readonly mood?: string;
  readonly palette?: readonly string[];
  readonly weather?: string;
}

export interface CreativeMemoryV1 {
  readonly schemaVersion: 1;
  readonly title?: string;
  readonly genre?: string;
  readonly tone?: string;
  readonly palette?: readonly string[];
  readonly characters: readonly CreativeCharacterV1[];
  readonly assets: readonly CreativeAssetV1[];
  readonly locations: readonly CreativeLocationV1[];
  readonly facts: readonly string[];
}

export interface CreativeMemoryRead {
  readonly memory: CreativeMemoryV1;
  /** What was dropped or clipped, for the host to log; never sent to the model. */
  readonly issues: readonly string[];
}

const ID = /^[\p{L}\p{N}_-]{1,48}$/u;
const HEX = /^#[0-9a-f]{6}$/u;
const SAFE_URL = /^(?:https:\/\/|data:image\/(?:png|jpeg|webp|gif);base64,|\/|\.\/|assets\/)/iu;

export function emptyCreativeMemory(): CreativeMemoryV1 {
  return { schemaVersion: 1, characters: [], assets: [], locations: [], facts: [] };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const clean = value.replace(/\s+/gu, ' ').trim();
  return clean === '' ? undefined : clean.slice(0, max);
}

/** A stable id from a display name: "Layla Noor" → "layla-noor", "ليلى" → "ليلى". */
export function creativeSlug(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 48);
  return slug === '' ? 'character' : slug;
}

export function normalizeColor(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffffff) {
    return `#${value.toString(16).padStart(6, '0')}`;
  }
  if (typeof value !== 'string') return undefined;
  const raw = value.trim().toLowerCase().replace(/^0x/u, '#');
  if (HEX.test(raw)) return raw;
  if (/^#[0-9a-f]{3}$/u.test(raw)) return `#${raw.slice(1).replace(/./gu, '$&$&')}`;
  return undefined;
}

function list(
  value: unknown,
  max: number,
  each: (item: unknown) => string | undefined,
): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: string[] = [];
  for (const item of value) {
    const clean = each(item);
    if (clean !== undefined && !out.includes(clean)) out.push(clean);
    if (out.length >= max) break;
  }
  return out.length === 0 ? undefined : out;
}

function idOf(value: unknown, fallbackName: string | undefined): string | undefined {
  const given = text(value, 48);
  if (given !== undefined && ID.test(given)) return given;
  return fallbackName === undefined ? undefined : creativeSlug(fallbackName);
}

/** Every key of T, optional ones allowed to be undefined before `compact` drops them. */
type Loose<T> = { [K in keyof T]-?: T[K] | undefined };

function compact<T extends object>(value: Loose<T>): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

function readCharacter(value: unknown, issues: string[]): CreativeCharacterV1 | undefined {
  if (!isRecord(value)) return undefined;
  const name = text(value['name'], CREATIVE_MEMORY_LIMITS.name);
  const id = idOf(value['id'], name);
  if (id === undefined) {
    issues.push('character without id or name dropped');
    return undefined;
  }
  return compact<CreativeCharacterV1>({
    id,
    name: name ?? id,
    role: text(value['role'] ?? value['title'], 40),
    color: normalizeColor(value['color']),
    look: text(value['look'], CREATIVE_MEMORY_LIMITS.text),
    voice: text(value['voice'], 120),
    traits: list(value['traits'], CREATIVE_MEMORY_LIMITS.traits, (item) => text(item, 40)),
    portrait: text(value['portrait'], 2048),
  });
}

function readAsset(value: unknown, issues: string[]): CreativeAssetV1 | undefined {
  if (!isRecord(value)) return undefined;
  const url = text(value['url'], 2048);
  if (url === undefined || !SAFE_URL.test(url)) {
    issues.push(`asset ${text(value['id'], 48) ?? '(no id)'} dropped: missing or unsafe url`);
    return undefined;
  }
  const kind = CREATIVE_ASSET_KINDS.includes(value['kind'] as CreativeAssetKind)
    ? (value['kind'] as CreativeAssetKind)
    : 'image';
  const id = idOf(value['id'], url.split(/[/?#]/u).filter(Boolean).pop() ?? kind);
  if (id === undefined) return undefined;
  return compact<CreativeAssetV1>({
    id,
    kind,
    url,
    license: text(value['license'], 80),
    owner: text(value['owner'], 48),
    notes: text(value['notes'], CREATIVE_MEMORY_LIMITS.text),
  });
}

function readLocation(value: unknown): CreativeLocationV1 | undefined {
  if (!isRecord(value)) return undefined;
  const name = text(value['name'], CREATIVE_MEMORY_LIMITS.name);
  const id = idOf(value['id'], name);
  if (id === undefined) return undefined;
  return compact<CreativeLocationV1>({
    id,
    name: name ?? id,
    mood: text(value['mood'], 80),
    palette: list(value['palette'], CREATIVE_MEMORY_LIMITS.palette, normalizeColor),
    weather: text(value['weather'], 24),
  });
}

function uniqueById<T extends { readonly id: string }>(items: readonly T[], max: number): T[] {
  const seen = new Map<string, T>();
  for (const item of items) seen.set(item.id, item);
  // Newest wins and is kept when the bound is reached.
  return [...seen.values()].slice(-max);
}

/** Validate anything a host loaded; invalid entries are dropped and named in `issues`. */
export function readCreativeMemory(value: unknown): CreativeMemoryRead {
  const issues: string[] = [];
  if (!isRecord(value)) {
    if (value !== undefined && value !== null) issues.push('memory is not an object');
    return { memory: emptyCreativeMemory(), issues };
  }
  if (value['schemaVersion'] !== 1) issues.push('memory schemaVersion is not 1; read as version 1');
  const array = (key: string): readonly unknown[] => {
    const items = value[key];
    return Array.isArray(items) ? items : [];
  };
  const characters = uniqueById(
    array('characters').flatMap((item) => readCharacter(item, issues) ?? []),
    CREATIVE_MEMORY_LIMITS.characters,
  );
  const assets = uniqueById(
    array('assets').flatMap((item) => readAsset(item, issues) ?? []),
    CREATIVE_MEMORY_LIMITS.assets,
  );
  const locations = uniqueById(
    array('locations').flatMap((item) => readLocation(item) ?? []),
    CREATIVE_MEMORY_LIMITS.locations,
  );
  const facts = (
    list(value['facts'], 1_000, (item) => text(item, CREATIVE_MEMORY_LIMITS.text)) ?? []
  ).slice(-CREATIVE_MEMORY_LIMITS.facts);
  const memory = compact<CreativeMemoryV1>({
    schemaVersion: 1 as const,
    title: text(value['title'], 120),
    genre: text(value['genre'], 60),
    tone: text(value['tone'], 80),
    palette: list(value['palette'], CREATIVE_MEMORY_LIMITS.palette, normalizeColor),
    characters,
    assets,
    locations,
    facts,
  });
  return { memory, issues };
}

function mergeById<T extends { readonly id: string }>(
  base: readonly T[],
  update: readonly T[],
  max: number,
): T[] {
  const merged = new Map<string, T>();
  for (const item of base) merged.set(item.id, item);
  for (const item of update) merged.set(item.id, { ...merged.get(item.id), ...item });
  return [...merged.values()].slice(-max);
}

/** Merge an update into the canon: same ids are updated field by field, new ones appended. */
export function mergeCreativeMemory(
  base: CreativeMemoryV1,
  update: Partial<CreativeMemoryV1>,
): CreativeMemoryV1 {
  const next = readCreativeMemory({
    schemaVersion: 1,
    characters: [],
    assets: [],
    locations: [],
    facts: [],
    ...update,
  }).memory;
  return compact<CreativeMemoryV1>({
    schemaVersion: 1 as const,
    title: next.title ?? base.title,
    genre: next.genre ?? base.genre,
    tone: next.tone ?? base.tone,
    palette: next.palette ?? base.palette,
    characters: mergeById(base.characters, next.characters, CREATIVE_MEMORY_LIMITS.characters),
    assets: mergeById(base.assets, next.assets, CREATIVE_MEMORY_LIMITS.assets),
    locations: mergeById(base.locations, next.locations, CREATIVE_MEMORY_LIMITS.locations),
    facts: [...base.facts.filter((fact) => !next.facts.includes(fact)), ...next.facts].slice(
      -CREATIVE_MEMORY_LIMITS.facts,
    ),
  });
}

function castEntries(value: LiteralValue): unknown[] {
  return Array.isArray(value) ? [...(value as readonly unknown[])] : [];
}

/**
 * Learn the canon from a scene script the Agent wrote: the literal cast arrays
 * (`dialogue.cast([...])`), their portraits, textures loaded by literal URL and background cues.
 * Variables and computed values are skipped, never evaluated.
 */
export function learnCreativeMemory(
  code: string,
  base: CreativeMemoryV1 = emptyCreativeMemory(),
): CreativeMemoryV1 {
  if (typeof code !== 'string' || code.trim() === '') return base;
  const characters: unknown[] = [];
  const assets: unknown[] = [];
  for (const cast of literalArgumentsOf(code, 'cast')) {
    for (const entry of castEntries(cast)) {
      if (!isRecord(entry)) continue;
      characters.push({ ...entry, role: entry['role'] ?? entry['title'], traits: entry['traits'] });
      const portrait = text(entry['portrait'], 2048);
      if (portrait !== undefined) {
        assets.push({
          kind: 'portrait',
          url: portrait,
          owner: idOf(entry['id'], text(entry['name'], 80)),
        });
      }
    }
  }
  for (const match of code.matchAll(/\.\s*texture\s*\(\s*(['"])([^'"\n]{1,2048})\1\s*\)/gu)) {
    assets.push({ kind: 'image', url: match[2] });
  }
  const locations = [...code.matchAll(/\bbg\s*:\s*(['"])([\p{L}\p{N}_ -]{1,48})\1/gu)].map(
    (match) => ({
      name: match[2],
    }),
  );
  if (characters.length === 0 && assets.length === 0 && locations.length === 0) return base;
  return mergeCreativeMemory(
    base,
    readCreativeMemory({ schemaVersion: 1, characters, assets, locations }).memory,
  );
}

/** Learn from every script of a project in reading order. */
export function learnCreativeMemoryFromScripts(
  scripts: readonly string[],
  base: CreativeMemoryV1 = emptyCreativeMemory(),
): CreativeMemoryV1 {
  return scripts.reduce((memory, code) => learnCreativeMemory(code, memory), base);
}

export function isCreativeMemoryEmpty(memory: CreativeMemoryV1): boolean {
  return (
    memory.characters.length === 0 &&
    memory.assets.length === 0 &&
    memory.locations.length === 0 &&
    memory.facts.length === 0 &&
    memory.title === undefined
  );
}

/** Compact, line-per-entry text for prompts (far fewer tokens than JSON). */
export function renderCreativeMemory(memory: CreativeMemoryV1): string {
  const lines: string[] = [];
  const head = [memory.title, memory.genre, memory.tone].filter(Boolean).join(' · ');
  if (head !== '') lines.push(`PROJECT: ${head}`);
  if (memory.palette !== undefined) lines.push(`PALETTE: ${memory.palette.join(' ')}`);
  if (memory.characters.length > 0) {
    lines.push(
      'CAST (keep ids, names, colours, looks and voices exactly; reuse in dialogue.cast):',
    );
    for (const c of memory.characters) {
      const parts = [
        `${c.id} = ${c.name}`,
        c.role,
        c.color,
        c.look === undefined ? undefined : `looks: ${c.look}`,
        c.voice === undefined ? undefined : `voice: ${c.voice}`,
        c.traits === undefined ? undefined : `traits: ${c.traits.join(', ')}`,
        c.portrait === undefined ? undefined : `portrait: ${c.portrait}`,
      ].filter((part): part is string => part !== undefined);
      lines.push(`- ${parts.join(' | ')}`);
    }
  }
  if (memory.assets.length > 0) {
    lines.push('APPROVED ASSETS (load only these URLs; never invent others):');
    for (const a of memory.assets) {
      const parts = [
        `${a.id} [${a.kind}] ${a.url}`,
        a.owner === undefined ? undefined : `of ${a.owner}`,
        a.license,
        a.notes,
      ].filter((part): part is string => part !== undefined);
      lines.push(`- ${parts.join(' | ')}`);
    }
  }
  if (memory.locations.length > 0) {
    lines.push('LOCATIONS:');
    for (const l of memory.locations) {
      const parts = [
        `${l.id} = ${l.name}`,
        l.mood,
        l.weather === undefined ? undefined : `weather: ${l.weather}`,
        l.palette?.join(' '),
      ].filter((part): part is string => part !== undefined);
      lines.push(`- ${parts.join(' | ')}`);
    }
  }
  if (memory.facts.length > 0) {
    lines.push('CANON (do not contradict):');
    for (const fact of memory.facts) lines.push(`- ${fact}`);
  }
  return lines.join('\n');
}
