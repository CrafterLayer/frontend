/*
  The cast: one validated table of characters a story's dialogue, portraits and scene code share
  (creative engines, 2026-10-12). It is the runtime half of the agent's character memory — the
  same id, name, colour and expressions every section and every turn refer to.
*/

export interface CastMemberInput {
  id: string;
  name: string;
  color?: string | number;
  title?: string;
  /** Portrait image URL (an approved project asset); the view omits it when absent. */
  portrait?: string;
  /** Expression name → portrait URL. */
  expressions?: Readonly<Record<string, string>>;
  /** Which side of the dialogue box the portrait sits on. */
  side?: 'start' | 'end';
  /** Free text the scene may use (traits, voice notes); never executed. */
  notes?: string;
}

export interface CastMember {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly colorNumber: number;
  readonly title: string;
  readonly portrait: string;
  readonly expressions: Readonly<Record<string, string>>;
  readonly side: 'start' | 'end';
  readonly notes: string;
}

export interface Cast {
  readonly size: number;
  readonly list: readonly CastMember[];
  has(id: string): boolean;
  get(id: string): CastMember | undefined;
  /** Match a cast member by id or (case-insensitive) display name. */
  find(idOrName: string): CastMember | undefined;
  portrait(id: string, expression?: string): string;
}

export const MAX_CAST = 32;
const ID = /^[\p{L}\p{N}_-]{1,48}$/u;
const SAFE_URL = /^(https?:|data:image\/|blob:|\/|\.\/|assets\/)/iu;
const FALLBACK_COLORS = [
  '#f59e0b',
  '#38bdf8',
  '#a78bfa',
  '#34d399',
  '#fb7185',
  '#facc15',
  '#60a5fa',
  '#f472b6',
];

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function url(value: unknown): string {
  const candidate = text(value, 2048);
  return candidate !== '' && SAFE_URL.test(candidate) ? candidate : '';
}

function colorOf(value: unknown, index: number): string {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffffff) {
    return `#${value.toString(16).padStart(6, '0')}`;
  }
  const candidate = text(value, 9);
  if (/^#[0-9a-f]{6}$/iu.test(candidate)) return candidate.toLowerCase();
  if (/^#[0-9a-f]{3}$/iu.test(candidate)) {
    // The pattern above admits only ASCII hex digits, so doubling each character is safe.
    return `#${candidate.slice(1).replace(/./gu, '$&$&')}`.toLowerCase();
  }
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length] ?? '#f59e0b';
}

/** Authored scene code is plain JavaScript, so the members and every field are checked at run time. */
export function createCast(members: unknown): Cast {
  if (!Array.isArray(members) || members.length > MAX_CAST) {
    throw new RangeError(`cast needs 0..${String(MAX_CAST)} characters`);
  }
  const entries: readonly unknown[] = members;
  const byId = new Map<string, CastMember>();
  entries.forEach((entry, index) => {
    if (typeof entry !== 'object' || entry === null)
      throw new TypeError('cast entries must be objects');
    const input = entry as Partial<Record<keyof CastMemberInput, unknown>>;
    const id = text(input.id, 48);
    if (!ID.test(id)) throw new TypeError(`cast id "${id}" must be 1..48 letters, digits, _ or -`);
    if (byId.has(id)) throw new TypeError(`cast id "${id}" is repeated`);
    const name = text(input.name, 80) || id;
    const expressions: Record<string, string> = {};
    if (typeof input.expressions === 'object' && input.expressions !== null) {
      for (const [key, value] of Object.entries(
        input.expressions as Readonly<Record<string, unknown>>,
      ).slice(0, 16)) {
        const safe = url(value);
        if (ID.test(key) && safe !== '') expressions[key] = safe;
      }
    }
    const color = colorOf(input.color, index);
    byId.set(
      id,
      Object.freeze({
        id,
        name,
        color,
        colorNumber: Number.parseInt(color.slice(1), 16),
        title: text(input.title, 80),
        portrait: url(input.portrait),
        expressions: Object.freeze(expressions),
        side: input.side === 'end' ? 'end' : 'start',
        notes: text(input.notes, 500),
      }),
    );
  });
  const list = Object.freeze([...byId.values()]);
  return Object.freeze({
    size: list.length,
    list,
    has: (id: string) => byId.has(id),
    get: (id: string) => byId.get(id),
    find(idOrName: string) {
      if (typeof idOrName !== 'string') return undefined;
      const key = idOrName.trim();
      const direct = byId.get(key);
      if (direct !== undefined) return direct;
      const lower = key.toLocaleLowerCase();
      // Scripts write speakers loosely ("Guide:" for id 'guide', "layla" for name 'Layla').
      return list.find(
        (member) =>
          member.name.toLocaleLowerCase() === lower || member.id.toLocaleLowerCase() === lower,
      );
    },
    portrait(id: string, expression?: string) {
      const member = byId.get(id);
      if (member === undefined) return '';
      return (
        (expression !== undefined ? member.expressions[expression] : undefined) ?? member.portrait
      );
    },
  });
}
