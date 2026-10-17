import { SCENE_PRESETS } from '../scene-presets/catalog';

import {
  closingParen,
  readSceneSource,
  receiverOf,
  type SceneSource,
} from './page-plan/scene-source';

interface Content {
  geometry: boolean;
  paint: boolean;
}
interface DisplayObject {
  readonly kind: string;
  readonly id: string | undefined;
  readonly index: number;
  readonly open: number;
  readonly close: number;
  readonly content: Content;
}
const SHAPES = new Set([
  'rect',
  'roundRect',
  'circle',
  'ellipse',
  'poly',
  'polygon',
  'star',
  'regularPoly',
  'lineTo',
  'arc',
  'arcTo',
  'bezierCurveTo',
  'quadraticCurveTo',
]);
const PAINT = new Set(['fill', 'stroke']);
const CHAIN = /\s*\.\s*([\w$]+)\s*\(/uy;

function ranges(bare: string, from: number, to: number): readonly (readonly [number, number])[] {
  const result: [number, number][] = [];
  let start = from,
    depth = 0;
  for (let index = from; index < to; index += 1) {
    const char = bare[index];
    if (char === '(' || char === '[' || char === '{') depth += 1;
    else if (char === ')' || char === ']' || char === '}') depth -= 1;
    else if (char === ',' && depth === 0) {
      result.push([start, index]);
      start = index + 1;
    }
  }
  result.push([start, to]);
  return result;
}

function value(source: SceneSource, from: number, to: number): boolean {
  const bare = source.bare.slice(from, to).replace(/[\s'"`{}[\]]/gu, '');
  if (/^(?:(?:[\w$]+\.)*Texture\.EMPTY|null|undefined|false|0)$/u.test(bare)) return false;
  return (
    bare !== '' ||
    source.literals.some(({ start, text }) => start >= from && start < to && text.trim() !== '')
  );
}

function geometry(source: SceneSource, method: string, open: number, close: number): boolean {
  if (!SHAPES.has(method) || !value(source, open + 1, close)) return false;
  const args = ranges(source.bare, open + 1, close).map(([from, to]) =>
    source.bare.slice(from, to).trim(),
  );
  const sizes =
    method === 'circle' ? [2] : ['rect', 'roundRect', 'ellipse'].includes(method) ? [2, 3] : [];
  return sizes.every((index) => {
    const size = args[index];
    return size !== undefined && (!/^-?\d+(?:\.\d+)?$/u.test(size) || Number(size) > 0);
  });
}

/** Read fluent methods on one constructor or one named Graphics object. */
function chain(source: SceneSource, start: number, content: Content): number {
  let cursor = start;
  for (;;) {
    CHAIN.lastIndex = cursor;
    const match = CHAIN.exec(source.bare);
    if (match === null) return cursor;
    const open = CHAIN.lastIndex - 1;
    const close = closingParen(source.bare, open);
    const method = match[1] ?? '';
    if (geometry(source, method, open, close)) content.geometry = true;
    if (PAINT.has(method)) content.paint = true;
    cursor = close + 1;
  }
}

function escaped(id: string): string {
  return id.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function graphicsContent(source: SceneSource, object: DisplayObject): boolean {
  const { content, id } = object;
  if (id !== undefined) {
    const pattern = new RegExp(`(?<![\\w$])${escaped(id)}\\s*(?=\\.)`, 'gu');
    for (const match of source.bare.matchAll(pattern))
      chain(source, match.index + match[0].length, content);
  }
  return content.geometry && content.paint;
}

function textContent(source: SceneSource, object: DisplayObject): boolean {
  const args = source.bare.slice(object.open + 1, object.close);
  if (args.trim().startsWith('{')) {
    const field = /\btext\s*:\s*/u.exec(args);
    if (field === null) return false;
    const start = object.open + 1 + field.index + field[0].length;
    const first = ranges(source.bare, start, object.close - 1)[0];
    return first !== undefined && value(source, first[0], first[1]);
  }
  const first = ranges(source.bare, object.open + 1, object.close)[0];
  return first !== undefined && value(source, first[0], first[1]);
}

function objectContent(
  source: SceneSource,
  object: DisplayObject,
  objects: readonly DisplayObject[],
): boolean {
  if (object.kind === 'Graphics') {
    if (graphicsContent(source, object)) return true;
    const context = source.bare.slice(object.open + 1, object.close).trim();
    return objects.some(
      (other) =>
        other.kind === 'GraphicsContext' && other.id === context && graphicsContent(source, other),
    );
  }
  if (object.kind === 'Text') return textContent(source, object);
  if (object.kind === 'Sprite' || object.kind === 'Particle') {
    const args = source.bare.slice(object.open + 1, object.close);
    if (args.trim().startsWith('{')) {
      const field = /\btexture\s*:\s*/u.exec(args);
      if (field !== null) {
        const start = object.open + 1 + field.index + field[0].length;
        const first = ranges(source.bare, start, object.close - 1)[0];
        if (first !== undefined && value(source, first[0], first[1])) return true;
      } else if (/\btexture\s*[,}]/u.test(args)) return true;
    } else if (value(source, object.open + 1, object.close)) return true;
    if (object.id === undefined) return false;
    const assigned = new RegExp(
      `${escaped(object.id)}\\s*\\.\\s*texture\\s*=\\s*([^;]+);`,
      'u',
    ).exec(source.bare);
    if (assigned === null) return false;
    return value(
      source,
      assigned.index + assigned[0].length - (assigned[1]?.length ?? 0) - 1,
      assigned.index + assigned[0].length - 1,
    );
  }
  if (object.kind.startsWith('Mesh')) {
    const args = source.bare.slice(object.open + 1, object.close);
    return (
      /\b(?:geometry|vertices|points|texture)\s*[:,}]/u.test(args) &&
      value(source, object.open + 1, object.close)
    );
  }
  return false;
}

/**
 * A conservative drawing witness, not a pixel verdict. Trusted exact catalog scripts already
 * have runtime fixtures. Bespoke programs need populated objects attached to a stage/world;
 * allocating or attaching an empty Graphics alone cannot count as a completed scene.
 */
export function sceneProgramHasContent(code: unknown): boolean {
  if (typeof code !== 'string' || code.trim() === '') return false;
  if (SCENE_PRESETS.some((preset) => preset.code === code)) return true;
  const source = readSceneSource(code);
  if (!/\bck\s*\.\s*(?:scene|stage)\s*\(/u.test(source.bare)) return false;
  const objects: DisplayObject[] = [];
  for (const match of source.bare.matchAll(
    /\bnew\s+[\w$.]*(GraphicsContext|Graphics|Sprite|Text|Mesh\w*|Particle)\s*\(/gu,
  )) {
    if (objects.length >= 256) break;
    const index = match.index;
    const open = index + match[0].length - 1;
    const close = closingParen(source.bare, open);
    const assigned = /([\w$]+(?:\.[\w$]+)*)\s*=\s*$/u.exec(
      source.bare.slice(Math.max(0, index - 100), index),
    );
    const content = { geometry: false, paint: false };
    chain(source, close + 1, content);
    objects.push({ kind: match[1] ?? '', id: assigned?.[1], index, open, close, content });
  }
  const parents = new Map<string, Set<string>>();
  const roots = new Set<string>(['app.stage']);
  for (const match of source.bare.matchAll(
    /\b([\w$]+)\s*=\s*await\s+ck\s*\.\s*(?:scene|stage)\s*\(/gu,
  )) {
    const id = match[1];
    if (id !== undefined)
      for (const member of ['world', 'stage', 'app.stage']) roots.add(`${id}.${member}`);
  }
  const attachments: { receiver: string; args: readonly (readonly [number, number])[] }[] = [];
  for (const match of source.bare.matchAll(/\b(addChild(?:At)?|addParticle)\s*\(/gu)) {
    const receiver = receiverOf(source.bare, match.index);
    if (receiver === '' || receiver === '?') continue;
    const open = match.index + match[0].length - 1;
    const args = ranges(source.bare, open + 1, closingParen(source.bare, open));
    attachments.push({ receiver, args });
    for (const [from, to] of args) {
      const id = source.bare
        .slice(from, to)
        .trim()
        .replace(/^\.\.\.\s*/u, '');
      if (!/^[\w$]+(?:\.[\w$]+)*$/u.test(id)) continue;
      const owners = parents.get(id) ?? new Set<string>();
      owners.add(receiver);
      parents.set(id, owners);
    }
  }
  // A stage/world alias retains ownership; an arbitrary unmounted container does not.
  for (let pass = 0; pass < 8; pass += 1) {
    let added = false;
    for (const match of source.bare.matchAll(
      /\b([\w$]+)\s*=\s*([\w$]+(?:\.[\w$]+)*)\s*(?=[,;])/gu,
    )) {
      if (roots.has(match[2] ?? '') && !roots.has(match[1] ?? '')) {
        roots.add(match[1] ?? '');
        added = true;
      }
    }
    if (!added) break;
  }
  const attached = (id: string): boolean => {
    const seen = new Set<string>(),
      stack = [id];
    while (stack.length > 0) {
      const current = stack.pop();
      if (current === undefined || seen.has(current)) continue;
      if (roots.has(current)) return true;
      seen.add(current);
      stack.push(...(parents.get(current) ?? []));
    }
    return false;
  };
  for (const object of objects) {
    if (!objectContent(source, object, objects)) continue;
    if (object.id !== undefined && attached(object.id)) return true;
    if (object.id !== undefined) continue;
    if (
      attachments.some(
        ({ receiver, args }) =>
          attached(receiver) &&
          args.some(
            ([from, to]) =>
              source.bare.slice(from, object.index).trim() === '' &&
              object.index >= from &&
              object.close < to,
          ),
      )
    )
      return true;
  }
  // These APIs populate their owned stage directly; noise/filter factories do not.
  for (const match of source.bare.matchAll(
    /\b([\w$]+)\s*\.\s*lib\s*\.\s*(emitter\s*\.\s*spawn|tilemap\s*\.\s*world)\s*\(/gu,
  )) {
    const open = match.index + match[0].length - 1;
    const args = ranges(source.bare, open + 1, closingParen(source.bare, open));
    const first = args[0],
      second = args[1];
    if (first === undefined || second === undefined) continue;
    const receiver = source.bare.slice(first[0], first[1]).trim();
    const owner = match[1] ?? '';
    const target = (match[2] ?? '').startsWith('emitter') ? owner : `${owner}.app`;
    if (receiver === target && value(source, second[0], second[1])) return true;
  }
  return false;
}
