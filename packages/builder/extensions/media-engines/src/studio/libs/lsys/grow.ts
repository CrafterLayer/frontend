/*
  L-system growth for `s.lib.lsys` (mural libraries 2, 2026-10-13): plants, vines, ferns and
  patterns as line segments in design units, drawn by the scene.

    const L = s.lib.lsys;
    const fern = L.fit(L.grow(s, { preset: 'fern', dir: s.dir }), { x: 80, y: 120, width: 400, height: 560 });
    L.draw(g, L.upTo(fern, t), { color: C.accent, width: 3 });   // grows as t goes 0 → 1

  The rewriting is lindenmayer 1.5.4 (MIT, © Tom Brewe), including its context-sensitive
  'A<B>C' rule keys; the turtle, the seeded choice between weighted successors, the limits, the
  fit, the growth order and the drawing are our own. lindenmayer picks weighted successors with
  Math.random, so it is never given any: a stochastic rule reaches it as a function that draws
  from a generator seeded by `seed` (default: one draw from the scene's s.random), and the same
  seed always grows the same plant. Every string is bounded before it is built (no runaway
  rewriting), and bad input never throws: it grows nothing.
*/

import LSystem, { type LSystemProduction } from 'lindenmayer';

import { mulberry32 } from '../../kit/random';
import { LSYS_PRESETS, type LsysDefinition, type LsysPresetName, type LsysRule } from './presets';

export const LSYS_LIMITS = Object.freeze({
  maxIterations: 12,
  /** The rewritten string never grows past this many symbols; iteration stops before it would. */
  maxSymbols: 200_000,
  maxSegments: 30_000,
  maxRules: 32,
  maxChoices: 8,
  maxRuleLength: 512,
});

export interface LsysOptions {
  /** A ready rule set (`s.lib.lsys.presets`); the options below override it. */
  preset?: LsysPresetName;
  axiom?: string;
  /** symbol → successor, or [successor | { to, p }] chosen per symbol by the seeded generator. */
  rules?: Record<string, LsysRule>;
  iterations?: number;
  /** Degrees per + / -; default 25. */
  angle?: number;
  /** Design units per drawn step; default 10 (fit() rescales). */
  step?: number;
  x?: number;
  y?: number;
  /** Degrees; default -90 (up the screen). */
  heading?: number;
  /** Seeded wobble added to every turn, degrees. */
  jitter?: number;
  /** What " multiplies the step by; default 0.9. */
  shrink?: number;
  /** Symbols that draw a step; default 'FG'. */
  draw?: string;
  /** A whole number; default one draw from the scene's s.random (or 1 without a scene). */
  seed?: number;
  /** -1 mirrors the growth about its start (pass s.dir for right-to-left pages). */
  dir?: number;
}

export interface LsysBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A grown system: segments in design units and when along the growth each one starts. */
export interface LsysResult {
  /** [x0, y0, x1, y1] per segment, in turtle order. */
  readonly segments: Float32Array;
  /** Branch depth per segment: 0 is the trunk, each [ one deeper (thinner strokes). */
  readonly depths: Uint8Array;
  /** Path length from the root to each segment's start (the growth order of upTo). */
  readonly dists: Float32Array;
  /** [x, y] of every branch end — where leaves, buds and flowers go. */
  readonly tips: Float32Array;
  readonly tipDists: Float32Array;
  readonly count: number;
  /** The longest root-to-tip path: upTo's span. */
  readonly length: number;
  readonly maxDepth: number;
  readonly bounds: LsysBounds;
  /** The iterations actually applied (fewer than asked when the string would pass the limit). */
  readonly iterations: number;
  readonly symbols: number;
  /** fit()'s scale (1 when grown). */
  readonly scale: number;
}

interface SceneLike {
  random?(): number;
}

interface Choice {
  readonly to: string;
  readonly weight: number;
}

const RAD = Math.PI / 180;

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function choicesOf(rule: unknown): Choice[] {
  const list = typeof rule === 'string' ? [rule] : Array.isArray(rule) ? rule : [];
  const out: Choice[] = [];
  for (const item of list.slice(0, LSYS_LIMITS.maxChoices)) {
    const record =
      item !== null && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const to = typeof item === 'string' ? item : record['to'];
    const weight = typeof item === 'string' ? 1 : Math.max(0, finite(record['p'], 1));
    if (
      typeof to === 'string' &&
      to.length > 0 &&
      to.length <= LSYS_LIMITS.maxRuleLength &&
      weight > 0
    )
      out.push({ to, weight });
  }
  return out;
}

/** The symbol a rule key rewrites: 'F', or the middle of a context key 'A<B>C'. */
function predecessorOf(key: string): string | undefined {
  const symbol = key.replace(/^.+</u, '').replace(/>.+$/u, '');
  return symbol.length === 1 && !/[\s[\]]/u.test(symbol) ? symbol : undefined;
}

function seedOf(scene: SceneLike | undefined, options: LsysOptions): number {
  if (typeof options.seed === 'number' && Number.isFinite(options.seed))
    return (Math.abs(Math.round(options.seed)) % 2_147_483_646) + 1;
  const drawn = typeof scene?.random === 'function' ? scene.random() : Number.NaN;
  return Number.isFinite(drawn) ? Math.floor(Math.abs(drawn) * 2_147_483_646) + 1 : 1;
}

function pick(choices: readonly Choice[], random: () => number): string {
  const total = choices.reduce((sum, choice) => sum + choice.weight, 0);
  let at = random() * total;
  for (const choice of choices) {
    at -= choice.weight;
    if (at < 0) return choice.to;
  }
  return choices[choices.length - 1]?.to ?? '';
}

/** Rewrite `axiom` up to `iterations` times, stopping before a string would pass maxSymbols. */
function rewrite(
  axiom: string,
  rules: Readonly<Record<string, LsysRule>>,
  iterations: number,
  random: () => number,
): { text: string; applied: number } {
  const productions: Record<string, LSystemProduction> = {};
  const longest = new Map<string, number>();
  for (const [key, rule] of Object.entries(rules).slice(0, LSYS_LIMITS.maxRules)) {
    const symbol = predecessorOf(key);
    const choices = choicesOf(rule);
    if (symbol === undefined || choices.length === 0) continue;
    const only = choices.length === 1 ? choices[0]?.to : undefined;
    productions[key] = { successor: only ?? (() => pick(choices, random)) };
    const size = Math.max(...choices.map((choice) => choice.to.length));
    longest.set(symbol, Math.max(longest.get(symbol) ?? 1, size));
  }
  const system = new LSystem({ axiom, productions, forceObjects: false });
  let text = axiom;
  let applied = 0;
  for (; applied < iterations; applied += 1) {
    let projected = 0;
    for (const symbol of text) projected += longest.get(symbol) ?? 1;
    if (projected > LSYS_LIMITS.maxSymbols) break;
    text = system.applyProductions();
  }
  return { text, applied };
}

const EMPTY_BOUNDS: LsysBounds = Object.freeze({ x: 0, y: 0, width: 0, height: 0 });

export function emptyResult(): LsysResult {
  return {
    segments: new Float32Array(0),
    depths: new Uint8Array(0),
    dists: new Float32Array(0),
    tips: new Float32Array(0),
    tipDists: new Float32Array(0),
    count: 0,
    length: 0,
    maxDepth: 0,
    bounds: EMPTY_BOUNDS,
    iterations: 0,
    symbols: 0,
    scale: 1,
  };
}

export function boundsOf(segments: Float32Array, count: number): LsysBounds {
  if (count === 0) return EMPTY_BOUNDS;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < count * 4; i += 2) {
    const x = segments[i] ?? 0;
    const y = segments[i + 1] ?? 0;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function definitionOf(options: LsysOptions): LsysDefinition | undefined {
  const name = options.preset;
  return typeof name === 'string' && Object.hasOwn(LSYS_PRESETS, name)
    ? LSYS_PRESETS[name]
    : undefined;
}

/** Grow an L-system: `grow(s, options)`, or `grow(options)` without the scene's seed. */
export function grow(first?: unknown, second?: unknown): LsysResult {
  const isScene =
    first !== null &&
    typeof first === 'object' &&
    typeof (first as SceneLike).random === 'function';
  const scene = isScene ? (first as SceneLike) : undefined;
  const raw = isScene ? second : first;
  const options: LsysOptions = raw !== null && typeof raw === 'object' ? raw : {};
  const base =
    definitionOf(options) ?? (options.axiom === undefined ? LSYS_PRESETS.tree : undefined);
  const axiom = typeof options.axiom === 'string' ? options.axiom : (base?.axiom ?? '');
  if (axiom.length === 0 || axiom.length > LSYS_LIMITS.maxRuleLength) return emptyResult();
  const extra: unknown = options.rules;
  const rules = {
    ...base?.rules,
    ...(extra !== null && typeof extra === 'object' ? (extra as Record<string, LsysRule>) : {}),
  };
  const random = mulberry32(seedOf(scene, options));
  const iterations = clamp(
    Math.round(finite(options.iterations, base?.iterations ?? 4)),
    0,
    LSYS_LIMITS.maxIterations,
  );
  const { text, applied } = rewrite(axiom, rules, iterations, random);
  const x0 = finite(options.x, 640);
  const result = turtle(text, {
    x: x0,
    y: finite(options.y, 720),
    heading: finite(options.heading, base?.heading ?? -90) * RAD,
    angle: finite(options.angle, base?.angle ?? 25) * RAD,
    jitter: Math.abs(finite(options.jitter, base?.jitter ?? 0)) * RAD,
    step: Math.max(0, finite(options.step, 10)),
    shrink: clamp(finite(options.shrink, base?.shrink ?? 0.9), 0, 4),
    draw: typeof options.draw === 'string' ? options.draw : (base?.draw ?? 'FG'),
    mirror: options.dir === -1,
    random,
  });
  return { ...result, iterations: applied, symbols: text.length };
}

interface TurtleSettings {
  readonly x: number;
  readonly y: number;
  readonly heading: number;
  readonly angle: number;
  readonly jitter: number;
  readonly step: number;
  readonly shrink: number;
  readonly draw: string;
  readonly mirror: boolean;
  readonly random: () => number;
}

interface TurtleState {
  x: number;
  y: number;
  h: number;
  step: number;
  depth: number;
  dist: number;
}

function turtle(
  text: string,
  settings: TurtleSettings,
): Omit<LsysResult, 'iterations' | 'symbols'> {
  const max = LSYS_LIMITS.maxSegments;
  const segments = new Float32Array(max * 4);
  const depths = new Uint8Array(max);
  const dists = new Float32Array(max);
  const tips: number[] = [];
  const tipDists: number[] = [];
  const stack: TurtleState[] = [];
  const t: TurtleState = {
    x: settings.x,
    y: settings.y,
    h: settings.heading,
    step: settings.step,
    depth: 0,
    dist: 0,
  };
  const sign = settings.mirror ? -1 : 1;
  const turn = (by: number) => {
    t.h += by + (settings.jitter > 0 ? (settings.random() * 2 - 1) * settings.jitter : 0);
  };
  let count = 0;
  let length = 0;
  let maxDepth = 0;
  let drew = false;
  for (const symbol of text) {
    if (settings.draw.includes(symbol)) {
      if (count >= max) break;
      const x = t.x + Math.cos(t.h) * t.step;
      const y = t.y + Math.sin(t.h) * t.step;
      const at = count * 4;
      segments[at] = settings.x + (t.x - settings.x) * sign;
      segments[at + 1] = t.y;
      segments[at + 2] = settings.x + (x - settings.x) * sign;
      segments[at + 3] = y;
      depths[count] = Math.min(255, t.depth);
      dists[count] = t.dist;
      count += 1;
      t.x = x;
      t.y = y;
      t.dist += t.step;
      length = Math.max(length, t.dist);
      maxDepth = Math.max(maxDepth, t.depth);
      drew = true;
    } else if (symbol === 'f') {
      t.x += Math.cos(t.h) * t.step;
      t.y += Math.sin(t.h) * t.step;
      drew = false;
    } else if (symbol === '+') turn(-settings.angle);
    else if (symbol === '-') turn(settings.angle);
    else if (symbol === '|') t.h += Math.PI;
    else if (symbol === '"') t.step *= settings.shrink;
    else if (symbol === '[') {
      if (stack.length < 4096) stack.push({ ...t });
      t.depth += 1;
      drew = false;
    } else if (symbol === ']') {
      if (drew) {
        tips.push(settings.x + (t.x - settings.x) * sign, t.y);
        tipDists.push(t.dist);
      }
      Object.assign(t, stack.pop() ?? t);
      drew = false;
    }
  }
  if (drew) {
    tips.push(settings.x + (t.x - settings.x) * sign, t.y);
    tipDists.push(t.dist);
  }
  const used = segments.slice(0, count * 4);
  return {
    segments: used,
    depths: depths.slice(0, count),
    dists: dists.slice(0, count),
    tips: Float32Array.from(tips),
    tipDists: Float32Array.from(tipDists),
    count,
    length,
    maxDepth,
    bounds: boundsOf(used, count),
    scale: 1,
  };
}
