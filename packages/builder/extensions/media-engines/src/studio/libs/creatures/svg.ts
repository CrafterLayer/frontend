/*
  The SVG back-end for `s.lib.creatures` (character art, 2026-11-05): the same part tree the Pixi
  back-end draws, as one self-contained SVG string (no scripts, no external references), for
  plain HTML sections, thumbnails and `texture()`. At rest every joint sits at its pivot with no
  turn, so the static drawing is the layers in tree order; only the fit scale wraps them.
*/

import { hex } from './color';
import { buildCreature, type Built } from './build';
import { asDef, CREATURE_LIMITS, moodOf, type CreatureMood } from './define';
import {
  FRAME,
  type Gradient,
  type Layer,
  type Line,
  type Paint,
  type Part,
  type Prim,
  type Shape,
} from './shapes';

export interface CreatureSvgOptions {
  /** Width and height in px (24..1024); 200 by default. */
  size?: number;
  mood?: CreatureMood | (string & {});
}

export function sizeOf(value: unknown, fallback: number = CREATURE_LIMITS.defaultSize): number {
  const size = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : NaN;
  if (Number.isNaN(size)) return fallback;
  return Math.min(CREATURE_LIMITS.maxSize, Math.max(CREATURE_LIMITS.minSize, size));
}

const n = (v: number) => String(Math.round(v * 100) / 100);

function d(shape: Shape): string {
  if (shape.t === 'ellipse') return '';
  return shape.d
    .map((c) => {
      switch (c[0]) {
        case 'M':
        case 'L':
          return `${c[0]}${n(c[1])} ${n(c[2])}`;
        case 'Q':
          return `Q${n(c[1])} ${n(c[2])} ${n(c[3])} ${n(c[4])}`;
        case 'C':
          return `C${n(c[1])} ${n(c[2])} ${n(c[3])} ${n(c[4])} ${n(c[5])} ${n(c[6])}`;
        default:
          return 'Z';
      }
    })
    .join('');
}

function element(shape: Shape, attrs: string): string {
  if (shape.t === 'ellipse') {
    return `<ellipse cx="${n(shape.cx)}" cy="${n(shape.cy)}" rx="${n(shape.rx)}" ry="${n(shape.ry)}"${attrs}/>`;
  }
  return `<path d="${d(shape)}"${attrs}/>`;
}

class Defs {
  private readonly ids = new Map<Gradient, string>();
  private readonly out: string[] = [];
  constructor(private readonly prefix: string) {}

  ref(g: Gradient): string {
    let id = this.ids.get(g);
    if (id === undefined) {
      id = `${this.prefix}${String(this.ids.size)}`;
      this.ids.set(g, id);
      const stops = g.stops
        .map(
          ([o, c, a]) =>
            `<stop offset="${n(o)}" stop-color="${hex(c)}"${a < 1 ? ` stop-opacity="${n(a)}"` : ''}/>`,
        )
        .join('');
      this.out.push(
        g.type === 'linear'
          ? `<linearGradient id="${id}" x1="${n(g.x1)}" y1="${n(g.y1)}" x2="${n(g.x2)}" y2="${n(g.y2)}">${stops}</linearGradient>`
          : `<radialGradient id="${id}" cx="${n(g.cx)}" cy="${n(g.cy)}" r="${n(g.r)}">${stops}</radialGradient>`,
      );
    }
    return `url(#${id})`;
  }

  toString(): string {
    return this.out.length > 0 ? `<defs>${this.out.join('')}</defs>` : '';
  }
}

function paint(p: Paint, defs: Defs): string {
  return typeof p === 'number' ? hex(p) : defs.ref(p);
}

function strokeAttrs(line: Line, scale = 1): string {
  return ` stroke="${hex(line.c)}" stroke-width="${n(line.w * scale)}"${line.a !== undefined && line.a < 1 ? ` stroke-opacity="${n(line.a)}"` : ''} stroke-linecap="round" stroke-linejoin="round"`;
}

function prim(p: Prim, defs: Defs): string {
  let out = '';
  if (p.fill !== undefined) {
    const alpha = p.alpha !== undefined && p.alpha < 1 ? ` fill-opacity="${n(p.alpha)}"` : '';
    out += element(p.shape, ` fill="${paint(p.fill, defs)}"${alpha}`);
  }
  if (p.line !== undefined) out += element(p.shape, ` fill="none"${strokeAttrs(p.line)}`);
  return out;
}

function layerSvg(l: Layer, defs: Defs): string {
  if (l.prims.length === 0) return '';
  let out = '';
  if (l.outline !== undefined) {
    out += `<g fill="none"${strokeAttrs(l.outline, 2)}>${l.prims.map((p) => element(p.shape, '')).join('')}</g>`;
  }
  return out + l.prims.map((p) => prim(p, defs)).join('');
}

function partSvg(p: Part, defs: Defs): string {
  return p.items
    .map((item) => (item.kind === 'part' ? partSvg(item, defs) : layerSvg(item, defs)))
    .join('');
}

export function builtSvg(built: Built, size: number): string {
  const defs = new Defs(`ck${built.def.seed.toString(36)}${built.mood.slice(0, 2)}`);
  const body = partSvg(built.root, defs);
  const scale = built.fit < 1 ? `<g transform="scale(${n(built.fit)})">` : '<g>';
  const label = built.def.name.length > 0 ? built.def.name : built.def.kind;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${String(size)}" height="${String(size)}" viewBox="${n(FRAME.left)} ${n(FRAME.top)} ${n(FRAME.width)} ${n(FRAME.height)}" role="img" aria-label="${escapeXml(label)}">` +
    `${defs.toString()}${scale}${body}</g></svg>`
  );
}

function escapeXml(text: string): string {
  return text.replace(/[<>&"']/gu, (ch) => `&#${String(ch.charCodeAt(0))};`);
}

/** The character as an SVG string. */
export function creatureSvg(input?: unknown, options?: CreatureSvgOptions | null): string {
  const def = asDef(input);
  const opts = typeof options === 'object' && options !== null ? options : {};
  const mood = opts.mood === undefined ? def.mood : moodOf(opts.mood);
  return builtSvg(buildCreature(def, mood), sizeOf(opts.size));
}

/* Percent-encode only what a data: URL must not carry raw (as peeps does). */
const URL_UNSAFE = /[^\w .,:;=+\-/'()!*~@$&]/gu;

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml,${svg.replaceAll('"', "'").replace(URL_UNSAFE, encodeURIComponent)}`;
}

/** `data:image/svg+xml,…` for an <img>, a CSS background or a dialogue portrait. */
export function creatureDataUrl(input?: unknown, options?: CreatureSvgOptions | null): string {
  return svgDataUrl(creatureSvg(input, options));
}
