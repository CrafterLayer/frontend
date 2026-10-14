import { describe, expect, it } from 'vitest';

import { createAnimLibrary } from '../anim-entry';
import { createMuralLibrary } from '../mural-entry';
import { fakePixi } from '../shared/fake-pixi.test-util';
import { mixRgb } from './util';

/*
  mural kit (2026-10-14): compose and the primitives on a structural Pixi stand-in — every item
  draws, the same seed draws the same marks (another seed others), RTL mirrors the mural, beats
  build one timeline that a tick drives, the editor holds the still beat, and dispose releases it
  all. Real pixels are covered by apps/evals mural-kit.browser.test.ts.
*/

interface Node {
  children: Node[];
  ops?: string[];
  alpha: number;
  x: number;
  destroyed: boolean;
  scale: { x: number; y: number };
}

function scene(
  options: { dir?: 1 | -1; editor?: boolean; reducedMotion?: boolean; anim?: boolean } = {},
) {
  const { PIXI } = fakePixi();
  const world = new PIXI.Container();
  const ticks: ((time: { dt: number; t: number }) => void)[] = [];
  const disposers: (() => void)[] = [];
  const s = {
    PIXI,
    world,
    design: { width: 1280, height: 720 },
    dir: options.dir ?? 1,
    editor: options.editor ?? false,
    reducedMotion: options.reducedMotion ?? false,
    palette: { mix: mixRgb, accent: 0x67e8f9, surface: 0x101525 },
    lib: options.anim === false ? {} : { anim: createAnimLibrary() },
    count: (n: number) => n,
    scroll: { progress: 0, velocity: 0 },
    tick: (fn: (time: { dt: number; t: number }) => void) => ticks.push(fn),
    dispose: (fn: () => void) => disposers.push(fn),
  };
  let t = 0;
  const step = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds * 20); i += 1) {
      t += 0.05;
      for (const fn of ticks) fn({ dt: 0.05, t });
    }
  };
  const end = () => {
    for (const fn of disposers) fn();
  };
  return { s, world: world as unknown as Node, step, end };
}

function marks(node: Node, out: string[] = []): string[] {
  if (node.ops !== undefined) out.push(node.ops.join(','));
  for (const child of node.children) marks(child, out);
  return out;
}

const M = createMuralLibrary();

const SPEC = {
  width: 2400,
  seed: 5,
  mood: 'oldcity',
  time: ['dusk', 'night'],
  layers: {
    sky: ['stars', { item: 'moon', x: 900 }, 'sun'],
    far: [{ item: 'hills' }, { item: 'skyline', kind: 'old' }],
    mid: [{ item: 'mosque', x: 1200 }],
    near: [
      { item: 'plains' },
      { item: 'house', kind: 'arab', count: 3, id: 'homes' },
      { item: 'lanterns', from: 200, to: 1000, y: 420 },
      { item: 'person', id: 'p', x: 200 },
      { item: 'camel', id: 'c', x: 100 },
      { item: 'tree', kind: 'palm', id: 'palm', x: 1500 },
    ],
  },
  beats: [
    { label: 'start', dur: 3 },
    { label: 'walk', camera: 0.5, walk: { p: 1100, c: 1000 }, grow: ['palm'], dur: 5 },
    { label: 'night', time: 'night', lights: 'on', state: { p: 'wave' }, dur: 4, still: true },
  ],
};

describe('s.lib.mural', () => {
  it('exposes its vocabulary, moods, times and depths', () => {
    expect(M.version).toBe('1.0.0');
    expect(M.items['sky']).toEqual(
      expect.arrayContaining([
        'gradient',
        'sun',
        'moon',
        'stars',
        'clouds',
        'aurora',
        'rain',
        'snow',
      ]),
    );
    expect(M.moods).toEqual(
      expect.arrayContaining(['meadow', 'desert', 'winter', 'oldcity', 'reef', 'space']),
    );
    expect(M.times).toEqual(['dawn', 'day', 'golden', 'dusk', 'night']);
    expect(M.depths).toEqual(['sky', 'far', 'mid', 'near', 'front']);
    expect(M.kinds['tree']).toEqual([
      'round',
      'pine',
      'palm',
      'olive',
      'cypress',
      'blossom',
      'bare',
    ]);
    expect(M.validate({ layers: { near: ['tre'] } })).toEqual([
      'near: unknown item "tre" skipped — did you mean "tree"?',
    ]);
  });

  it.each(Object.values(M.items).flat())('draws %s alone, in RTL too, without throwing', (name) => {
    for (const dir of [1, -1] as const) {
      const { s, world } = scene({ dir });
      const drawn = M.item(s, world, name, { seed: 3, kind: M.kinds[name]?.[1] });
      expect(drawn?.view).toBeDefined();
      expect(marks(world).join('').length).toBeGreaterThan(0);
      if (
        dir === -1 &&
        ![
          'gradient',
          'stars',
          'clouds',
          'aurora',
          'rain',
          'snow',
          'hills',
          'mountains',
          'dunes',
          'plains',
          'sea',
          'waves',
          'underwater',
          'bubbles',
          'grass',
          'flowers',
          'skyline',
          'arches',
          'lanterns',
          'fence',
          'fireflies',
          'sparkles',
        ].includes(name)
      ) {
        expect(drawn?.view.scale.x).toBeLessThan(0);
      }
    }
  });

  it('returns undefined for an unknown item', () => {
    const { s, world } = scene();
    expect(M.item(s, world, 'unicorn-spaceship')).toBeUndefined();
  });

  it('composes a spec into five panning layers with no warnings', () => {
    const { s, world } = scene();
    const m = M.compose(s, SPEC);
    expect(m.warnings).toEqual([]);
    expect(world.children).toHaveLength(1);
    expect(m.get('homes')).toHaveLength(3);
    expect(m.get('p')).toHaveLength(1);
    expect(m.duration).toBeCloseTo(12, 5);
    expect(m.layer('near')).toBeDefined();
    expect(m.layer('nope')).toBe(m.layer('near'));
  });

  it('draws the same marks for the same seed and others for another seed', () => {
    const draw = (seed: number) => {
      const { world } = (() => {
        const made = scene();
        M.compose(made.s, { ...SPEC, seed });
        return made;
      })();
      return marks(world).join('|');
    };
    expect(draw(5)).toBe(draw(5));
    expect(draw(6)).not.toBe(draw(5));
  });

  it('mirrors the whole mural in RTL around the design width', () => {
    const { s } = scene({ dir: -1 });
    const m = M.compose(s, SPEC);
    expect(m.root.scale.x).toBe(-1);
    expect(m.root.x).toBe(1280);
  });

  it('plays the beats on one timeline: the camera pans, the cast walks, lights come on', () => {
    const { s, step } = scene();
    const m = M.compose(s, SPEC);
    const [person] = m.get('p');
    const lights = m.lights('near');
    expect(m.camera.pan).toBe(0);
    step(1);
    expect(m.timeline?.time()).toBeGreaterThan(0.9);
    step(6);
    expect(m.camera.pan).toBeGreaterThan(0.3);
    expect(person?.x).toBeGreaterThan(400);
    step(4);
    // Lit marks in the near layer's light container are on at night.
    const lit = (lights as unknown as Node).children
      .flatMap((child) => child.children)
      .filter((child) => child.alpha > 0.9);
    expect(lit.length).toBeGreaterThan(0);
  });

  it('holds the strongest beat as the still frame in the editor', () => {
    const { s, step } = scene({ editor: true });
    const m = M.compose(s, SPEC);
    // The night beat (marked still) ends at 12 s: the still sits inside it, clear of the veil.
    expect(m.still).toBeGreaterThan(8 / 12);
    expect(m.still).toBeLessThanOrEqual(1);
    const at = m.timeline?.time();
    step(2);
    expect(m.timeline?.time()).toBe(at);
    expect(m.camera.pan).toBeCloseTo(0.5, 5);
  });

  it('holds a still frame under reduced motion too', () => {
    const { s, step } = scene({ reducedMotion: true });
    const m = M.compose(s, SPEC);
    const at = m.timeline?.time();
    step(1);
    expect(m.timeline?.time()).toBe(at);
  });

  it('scrubs with s.scroll in scrub mode', () => {
    const { s, step } = scene();
    const m = M.compose(s, { ...SPEC, mode: 'scrub' });
    step(1);
    expect(m.timeline?.time()).toBe(0);
    s.scroll.progress = 1;
    step(3);
    expect(m.timeline?.progress()).toBeGreaterThan(0.9);
  });

  it('draws without anim and says how to animate', () => {
    const { s } = scene({ anim: false });
    const m = M.compose(s, SPEC);
    expect(m.timeline).toBeUndefined();
    expect(m.warnings.join('\n')).toContain("add 'anim' to libs");
  });

  it('releases everything with the scene, once', () => {
    const { s, world, end, step } = scene();
    const m = M.compose(s, SPEC);
    end();
    expect(m.disposed).toBe(true);
    expect(world.children).toHaveLength(0);
    expect(() => {
      m.dispose();
      step(1);
    }).not.toThrow();
  });

  it('never throws on a broken spec and still returns a usable handle', () => {
    const { s } = scene();
    for (const spec of [null, 'x', { layers: { near: [{ item: 42 }] } }, { beats: [null, 1] }]) {
      const m = M.compose(s, spec);
      expect(m.warnings.length).toBeGreaterThan(0);
      expect(typeof m.dispose).toBe('function');
    }
  });
});
