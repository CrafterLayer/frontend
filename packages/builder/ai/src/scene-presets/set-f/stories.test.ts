import { describe, expect, it } from 'vitest';

import { suggestReadyScenes } from '../../agent/scene-ready';
import { estimateCanonicalJsonTokens } from '../../internal/canonical-json';
import { scenePresetMenu } from '../../tools/agent/builtin/scene-preset';
import { PLAYBOOK_PRESET_IDS, SCENE_PRESET_CATEGORIES, scenePreset } from '../catalog';
import { PRESETS_SET_F } from './index';

/*
  Set F (mural stories, 2026-10-14): illustrated murals that tell a story in beats on one
  s.lib.anim timeline. Beyond the catalogue checks in presets.test.ts, each one is RUN here
  against a recording stand-in for the scene kit, Pixi and the anim library: it builds without
  touching the DOM (no UI of its own), registers one tick and its disposal, holds a still frame in
  the editor and under reduced motion, scrubs with s.scroll when asked, mirrors in RTL, and draws
  the same picture from the same seed (and a different one from another).
*/

const AsyncFunction = (
  Object.getPrototypeOf(async function () {
    /* the constructor is all this needs */
  }) as { constructor: new (name: string, body: string) => (ck: unknown) => Promise<unknown> }
).constructor;

type Log = string[];

/** Every value a display object or a timeline call carries, in a stable text form. */
function plain(value: unknown): string {
  if (typeof value === 'number') return Number.isFinite(value) ? value.toFixed(2) : String(value);
  if (typeof value === 'function') return 'fn';
  if (Array.isArray(value)) return `[${value.map(plain).join(',')}]`;
  if (value instanceof Node) return `#${String(value.id)}`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value)
      .map(([key, inner]) => `${key}:${plain(inner)}`)
      .join(',')}}`;
  }
  return String(value);
}

let ids = 0;

/** A Pixi display object stand-in: transform fields, children, and recorded drawing calls. */
class Node {
  readonly id = (ids += 1);
  children: Node[] = [];
  parent: Node | undefined;
  x = 0;
  y = 0;
  alpha = 1;
  rotation = 0;
  tint = 0xffffff;
  blendMode = 'normal';
  visible = true;
  f = 0;
  readonly scale = point(1, 1);
  readonly pivot = point(0, 0);
  readonly skew = point(0, 0);
  readonly anchor = point(0, 0);
  readonly position = {
    set: (x: number, y?: number) => {
      this.x = x;
      this.y = y ?? x;
    },
  };

  constructor(readonly log: Log) {}

  addChild<T extends Node>(child: T): T {
    child.parent = this;
    this.children.push(child);
    return child;
  }
}

function point(x: number, y: number) {
  return {
    x,
    y,
    set(nx: number, ny?: number) {
      this.x = nx;
      this.y = ny ?? nx;
    },
  };
}

function pixiFor(log: Log) {
  const graphicsMethods = [
    'rect',
    'roundRect',
    'circle',
    'ellipse',
    'poly',
    'moveTo',
    'lineTo',
    'quadraticCurveTo',
    'bezierCurveTo',
    'arc',
    'closePath',
    'fill',
    'stroke',
  ];
  class Graphics extends Node {
    context: unknown;
    constructor(context?: unknown) {
      super(log);
      this.context = context ?? {};
      for (const name of graphicsMethods) {
        (this as unknown as Record<string, unknown>)[name] = (...args: unknown[]) => {
          log.push(`${String(this.id)}.${name}(${args.map(plain).join(',')})`);
          return this;
        };
      }
    }
  }
  class Container extends Node {
    constructor() {
      super(log);
    }
  }
  class Sprite extends Node {
    constructor(readonly texture: unknown) {
      super(log);
    }
  }
  class FillGradient {
    destroyed = false;
    constructor(readonly options: unknown) {
      log.push(`gradient(${plain(options)})`);
    }
    destroy() {
      this.destroyed = true;
    }
  }
  return { Container, Graphics, Sprite, FillGradient };
}

/** The anim library as the stories use it: a recording timeline, rigs that remember their state. */
function animFor(log: Log, calls: Log) {
  const timelines: Record<string, unknown>[] = [];
  return {
    timelines,
    create(options: { reducedMotion?: boolean }) {
      const rigs: { state: string }[] = [];
      let disposed = false;
      return {
        reducedMotion: options.reducedMotion === true,
        rigs,
        get disposed() {
          return disposed;
        },
        update(dt: number) {
          calls.push(`update(${plain(dt)})`);
        },
        dispose() {
          disposed = true;
        },
        rig(parts: Record<string, Node>, rigOptions: unknown) {
          for (const part of Object.values(parts)) expect(part).toBeInstanceOf(Node);
          const rig = {
            state: 'idle',
            speed: 1,
            set(state: string) {
              rig.state = state;
              return true;
            },
            face() {
              /* the stand-in has no pose */
            },
          };
          log.push(`rig(${plain(rigOptions)})`);
          rigs.push(rig);
          return rig;
        },
        timeline(timelineOptions: unknown) {
          const record = (name: string) =>
            function (this: unknown, ...args: unknown[]) {
              calls.push(`${name}(${args.map(plain).join(',')})`);
              return timeline;
            };
          const timeline: Record<string, unknown> = {
            options: timelineOptions,
            to: record('to'),
            from: record('from'),
            fromTo: record('fromTo'),
            call: record('call'),
            wait: record('wait'),
            label: record('label'),
            seek: record('seek'),
            pause: record('pause'),
            resume: record('resume'),
            progress(value?: number) {
              if (value === undefined) return 0;
              calls.push(`progress(${plain(value)})`);
              return timeline;
            },
            time() {
              return 0;
            },
          };
          timelines.push(timeline);
          return timeline;
        },
      };
    },
  };
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

interface RunOptions {
  seed?: number;
  reducedMotion?: boolean;
  editor?: boolean;
  dir?: 1 | -1;
  scrub?: boolean;
}

async function run(code: string, options: RunOptions = {}) {
  ids = 0;
  const log: Log = [];
  const calls: Log = [];
  const PIXI = pixiFor(log);
  const anim = animFor(log, calls);
  const ticks: ((time: { t: number; dt: number }) => void)[] = [];
  const disposers: (() => void)[] = [];
  const animators: ReturnType<typeof anim.create>[] = [];
  let sceneOptions: Record<string, unknown> = {};
  let random = mulberry32(1);
  const mix = (a: number, b: number, t: number) => {
    const ch = (shift: number) =>
      Math.round(((a >> shift) & 255) + (((b >> shift) & 255) - ((a >> shift) & 255)) * t);
    return (ch(16) << 16) | (ch(8) << 8) | ch(0);
  };
  const s = {
    PIXI,
    world: new PIXI.Container(),
    lib: {
      anim: {
        create(o: { reducedMotion?: boolean }) {
          const made = anim.create(o);
          animators.push(made);
          return made;
        },
      },
      peeps: { texture: () => Promise.resolve({ texture: true }) },
    },
    palette: {
      colors: [0x67e8f9, 0xa5f3fc, 0xf1f5f9, 0x94a3b8, 0x0e7490],
      accent: 0x67e8f9,
      text: 0xf1f5f9,
      muted: 0x94a3b8,
      surface: 0x101525,
      dark: true,
      mix,
      hex: () => '#67e8f9',
    },
    scroll: { progress: 0.4, velocity: 0.2, visible: true },
    reducedMotion: options.reducedMotion === true,
    editor: options.editor === true,
    dir: options.dir ?? 1,
    random: () => random(),
    rand: (a: number, b: number) => a + (b - a) * random(),
    int: (a: number, b: number) => a + Math.floor((b - a + 1) * random()),
    count: (n: number) => n,
    noise2: (x: number, y: number) => Math.sin(x * 12.9898 + y * 78.233),
    fbm: (x: number, y: number) => Math.sin(x * 3.1 + y * 1.7) * 0.6,
    poisson: (w: number, h: number, r: number, max: number) =>
      Array.from({ length: Math.min(max, 40) }, () => [random() * w, random() * h + r * 0]),
    tick: (fn: (time: { t: number; dt: number }) => void) => ticks.push(fn),
    dispose: (fn: () => void) => disposers.push(fn),
  };
  const ck = {
    params(defaults: Record<string, unknown>) {
      return {
        ...defaults,
        ...(options.seed === undefined ? {} : { seed: options.seed }),
        ...(options.scrub === undefined ? {} : { scrub: options.scrub }),
      };
    },
    scene(o: Record<string, unknown>) {
      sceneOptions = o;
      random = mulberry32(Number(o['seed']));
      return Promise.resolve(s);
    },
  };
  await new AsyncFunction('ck', code)(ck);
  return { log, calls, ticks, disposers, animators, sceneOptions, s, anim };
}

const CASES = PRESETS_SET_F.map(([entry]): [string, typeof entry] => [entry.id, entry]);

describe('set F', () => {
  it('lists four mural stories', () => {
    expect(PRESETS_SET_F.map(([entry, category]) => `${category}:${entry.id}`)).toEqual([
      'mural:desert-caravan',
      'mural:fishing-village',
      'mural:seed-to-forest',
      'mural:souq-morning',
    ]);
  });
});

// Mural writers are shown the ready scenes that fit their brief (agent/scene-ready.ts): each story
// comes first for a brief about it, in Arabic or English, with no change to that list's rules.
describe('ready-scene suggestions', () => {
  it.each([
    ['جدارية تحكي قصة قافلة في الصحراء', 'ar', 'desert-caravan'],
    ['قصة جدارية عن قرية الصيادين والقوارب', 'ar', 'fishing-village'],
    ['جدارية لغابة تنمو من بذرة', 'ar', 'seed-to-forest'],
    ['جدارية للسوق القديم في الصباح', 'ar', 'souq-morning'],
    ['A mural story of a desert caravan', 'en', 'desert-caravan'],
    ['An illustrated mural of a fishing village', 'en', 'fishing-village'],
    ['A mural story: a seed grows into a forest with birds', 'en', 'seed-to-forest'],
    ['An illustrated mural story of an old market street waking up', 'en', 'souq-morning'],
  ])('offers %s (%s) the %s story first', (brief, lang, id) => {
    expect(suggestReadyScenes(brief, lang)[0]?.id).toBe(id);
  });
});

describe.each(CASES)('mural story %s', (id, entry) => {
  it('is catalogued as a mural and taught by the mural playbook, not the cached menu', () => {
    expect(scenePreset(id)?.category).toBe('mural');
    expect(PLAYBOOK_PRESET_IDS.has(id)).toBe(true);
    expect(scenePresetMenu()).not.toContain(id);
    expect(scenePresetMenu(SCENE_PRESET_CATEGORIES)).toContain(id);
  });

  it('composes on s.world at the 1280 × 720 design with the anim timeline, scrub and tones', () => {
    expect(entry.code).toMatch(
      /ck\.scene\(\{libs:\['viewport','anim'(?:,'peeps')?\],seed:p\.seed,design:\{width:1280,height:720,fit:'cover',zoom:true\}\}\)/u,
    );
    expect(entry.libs).toEqual(expect.arrayContaining(['kit', 'viewport', 'anim']));
    expect(entry.params.map((spec) => spec.key)).toEqual(
      expect.arrayContaining(['seed', 'speed', 'scrub', 'tones']),
    );
    expect(entry.code).not.toMatch(/Math\.random|window\.|document\.|ck\.root|s\.onResize/u);
    // NO UI: no buttons, captions, dialogue or text of its own.
    expect(entry.code).not.toMatch(/button|s\.text\(|new P\.Text|dialogue|aria-live/iu);
    expect(entry.tags).toEqual(expect.arrayContaining(['story', 'illustrated']));
    // Every param it offers does something (the kit reads the palette itself).
    for (const spec of entry.params) {
      if (spec.key !== 'palette') expect(entry.code).toContain(`p.${spec.key}`);
    }
  });

  it('applies in one short call instead of a page of code, and stays well under the region cap', () => {
    const apply = estimateCanonicalJsonTokens({ preset: id });
    expect(apply).toBeLessThanOrEqual(12);
    expect(estimateCanonicalJsonTokens({ js: entry.code })).toBeGreaterThan(apply * 100);
    expect(entry.code.length).toBeLessThan(16_000);
  });

  it('runs: a looping timeline of labelled beats, one tick, characters on rigs, all disposed', async () => {
    const result = await run(entry.code);
    expect(result.animators).toHaveLength(1);
    const [timeline] = result.anim.timelines;
    expect(timeline?.['options']).toEqual({ repeat: -1, paused: false });
    const labels = result.calls.filter((call) => call.startsWith('label('));
    expect(labels.length).toBeGreaterThanOrEqual(3);
    expect(labels.length).toBeLessThanOrEqual(5);
    // The camera pans the panorama on the same timeline.
    expect(result.calls.some((call) => call.startsWith('to({pan:0.00},{pan:'))).toBe(true);
    expect(result.log.some((line) => line.startsWith('rig('))).toBe(true);
    expect(result.ticks).toHaveLength(1);
    result.ticks[0]?.({ t: 1, dt: 1 / 60 });
    expect(result.calls).toContain('update(0.02)');
    // The loop: a veil in the night colour fades the end into the first beat.
    expect(result.calls.some((call) => call.includes('{alpha:1.00},{alpha:0.00}'))).toBe(true);
    expect(result.disposers).toHaveLength(1);
    result.disposers[0]?.();
    expect(result.animators[0]?.disposed).toBe(true);
  });

  it.each([
    ['reduced motion', { reducedMotion: true }],
    ['the editor', { editor: true }],
  ] as const)('holds one composed still beat under %s', async (_label, options) => {
    const result = await run(entry.code, options);
    expect(result.anim.timelines[0]?.['options']).toEqual({ repeat: -1, paused: true });
    const seeks = result.calls.filter((call) => call.startsWith('progress('));
    expect(seeks).toHaveLength(1);
    const at = Number(/progress\(([\d.]+)\)/u.exec(seeks[0] ?? '')?.[1]);
    expect(at).toBeGreaterThan(0.2);
    expect(at).toBeLessThan(0.8);
    result.ticks[0]?.({ t: 5, dt: 1 / 60 });
    expect(result.calls.filter((call) => call.startsWith('update('))).toEqual([]);
    // No loop veil in a still frame.
    expect(
      result.calls.some(
        (call) => call.startsWith('fromTo(#') && call.includes('alpha:1.00},{alpha:0.00}'),
      ),
    ).toBe(false);
  });

  it('scrubs the paused timeline with s.scroll.progress when scrub is on', async () => {
    const result = await run(entry.code, { scrub: true });
    expect(result.anim.timelines[0]?.['options']).toEqual({ repeat: -1, paused: true });
    for (let frame = 0; frame < 30; frame += 1) result.ticks[0]?.({ t: frame / 30, dt: 1 / 30 });
    const last = result.calls.filter((call) => call.startsWith('progress(')).at(-1) ?? '';
    // Eased toward the stand-in's scroll progress (0.4).
    expect(Number(/progress\(([\d.]+)\)/u.exec(last)?.[1])).toBeCloseTo(0.4, 1);
    for (const rig of result.animators[0]?.rigs ?? []) expect(rig).toBeDefined();
  });

  it('mirrors the whole picture in RTL', async () => {
    const ltr = await run(entry.code, { dir: 1 });
    const rtl = await run(entry.code, { dir: -1 });
    const rootOf = (result: typeof ltr) => result.s.world.children[0] ?? new Node([]);
    expect(rootOf(ltr).scale.x).toBe(1);
    expect(rootOf(rtl).scale.x).toBe(-1);
    expect(rootOf(rtl).x).toBe(1280);
  });

  it('draws the same picture from the same seed and another from another seed', async () => {
    const seed = Number(entry.params.find((spec) => spec.key === 'seed')?.default);
    const first = await run(entry.code, { seed });
    const again = await run(entry.code, { seed });
    const other = await run(entry.code, { seed: seed + 1 });
    expect(first.log.length).toBeGreaterThan(100);
    expect(again.log).toEqual(first.log);
    expect(other.log).not.toEqual(first.log);
  });
});
