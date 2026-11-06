import { describe, expect, it } from 'vitest';

import { createRig } from '../anim/character';
import { createAnimator } from '../anim/tween';
import { createAnimLibrary } from '../anim-entry';
import { createCreaturesLibrary } from '../creatures-entry';
import { buildCreature } from './build';
import { numberToLch, parseColor } from './color';
import { CREATURE_KINDS, CREATURE_MOODS, RECIPES, defineCreature } from './define';
import { FRAME, bounds, type Part } from './shapes';
import { creatureTexture } from './texture';

// A Pixi stand-in: display objects with transforms and a chainable drawing log.
class FakeContainer {
  x = 0;
  y = 0;
  rotation = 0;
  alpha = 1;
  label = '';
  scale = { x: 1, y: 1 };
  children: unknown[] = [];
  destroyed = false;
  addChild(...children: unknown[]) {
    this.children.push(...children);
    return children[0];
  }
  removeChildren() {
    return this.children.splice(0);
  }
  destroy() {
    this.destroyed = true;
  }
}

class FakeGraphics extends FakeContainer {
  ops = 0;
  private log() {
    this.ops += 1;
    return this;
  }
  ellipse() {
    return this.log();
  }
  moveTo() {
    return this.log();
  }
  lineTo() {
    return this.log();
  }
  quadraticCurveTo() {
    return this.log();
  }
  bezierCurveTo() {
    return this.log();
  }
  closePath() {
    return this.log();
  }
  fill() {
    return this.log();
  }
  stroke() {
    return this.log();
  }
}

const PIXI = { Container: FakeContainer, Graphics: FakeGraphics };
const C = createCreaturesLibrary();

function scene(extra: Record<string, unknown> = {}) {
  return { PIXI, random: () => 0.5, world: new FakeContainer(), ...extra };
}

function run(anim: { update(dt: number): void }, seconds: number) {
  for (let t = 0; t < seconds; t += 1 / 60) anim.update(1 / 60);
}

function hash(root: Part): string {
  const text = JSON.stringify(root);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

describe('creatures.define', () => {
  it('lists fifteen original kinds and eight moods, and no pig', () => {
    expect(C.kinds).toHaveLength(15);
    expect(C.moods).toEqual([
      'happy',
      'calm',
      'surprised',
      'sad',
      'sleepy',
      'excited',
      'shy',
      'grumpy',
    ]);
    expect(C.kinds as readonly string[]).not.toContain('pig');
    expect(Object.keys(RECIPES)).not.toContain('pig');
    for (let seed = 0; seed < 200; seed += 1) expect(C.random(seed).kind).not.toBe('pig');
    expect(C.define({ kind: 'pig', name: 'Babe' }).kind).not.toBe('pig');
  });

  it('fills every field, drops unknown ones and replaces bad values', () => {
    const d = C.define({
      kind: 'Dragon',
      name: '  Zahra  ',
      ears: 'banana',
      wings: 'fairy',
      mood: 'cross',
      palette: { body: '#7ec8a0', ink: 'nope' },
      outline: false,
      evil: true,
    } as never);
    expect(d.kind).toBe('dragon');
    expect(d.name).toBe('Zahra');
    expect(d.ears).toBe('fin');
    expect(d.wings).toBe('fairy');
    expect(d.mood).toBe('grumpy');
    expect(d.palette.body).toBe('#7ec8a0');
    expect(d.palette.ink).toMatch(/^#[0-9a-f]{6}$/u);
    expect(d.outline).toBe(false);
    expect('evil' in d).toBe(false);
    expect(Object.isFrozen(d)).toBe(true);
    // Nothing at all, or garbage, still gives a complete character.
    for (const input of [undefined, null, 42, 'whale', { kind: 7, mood: {}, palette: [] }]) {
      const x = C.define(input as never);
      expect(CREATURE_KINDS).toContain(x.kind);
      expect(CREATURE_MOODS).toContain(x.mood);
    }
    expect(C.define('whale').kind).toBe('sea');
    expect(C.define({ kind: 'bunny-sprite' }).kind).toBe('bunny');
  });

  it('round-trips: a definition defines to itself', () => {
    const d = C.random('Layla');
    expect(C.define(d)).toEqual(d);
  });

  it('keeps palettes harmonious: lighter belly, dark ink that is never black', () => {
    for (const kind of CREATURE_KINDS) {
      for (const name of ['a', 'b', 'c', 'd']) {
        const p = C.define({ kind, name }).palette;
        const body = numberToLch(parseColor(p.body) ?? 0);
        const belly = numberToLch(parseColor(p.belly) ?? 0);
        const ink = numberToLch(parseColor(p.ink) ?? 0);
        expect(belly.l).toBeGreaterThanOrEqual(body.l - 0.001);
        expect(ink.l).toBeLessThan(0.4);
        expect(p.ink).not.toBe('#000000');
      }
    }
  });
});

describe('creatures geometry', () => {
  it('is deterministic: the same name always draws the same character', () => {
    const a = buildCreature(defineCreature({ kind: 'fox', name: 'Noor' }));
    const b = buildCreature(defineCreature({ kind: 'fox', name: 'noor ' }));
    const c = buildCreature(defineCreature({ kind: 'fox', name: 'Sami' }));
    expect(hash(a.root)).toBe(hash(b.root));
    expect(hash(a.root)).not.toBe(hash(c.root));
    expect(C.random(7)).toEqual(C.random(7));
  });

  it('keeps every kind in every mood inside the frame', () => {
    for (const kind of CREATURE_KINDS) {
      for (const mood of CREATURE_MOODS) {
        const built = buildCreature(defineCreature({ kind, name: 'Bounds' }), mood);
        const box = bounds(built.root);
        const f = built.fit;
        expect(f).toBeGreaterThan(0.5);
        expect(f).toBeLessThanOrEqual(1);
        expect(box.minX * f).toBeGreaterThanOrEqual(FRAME.left);
        expect(box.maxX * f).toBeLessThanOrEqual(FRAME.left + FRAME.width);
        expect(box.minY * f).toBeGreaterThanOrEqual(FRAME.top);
        expect(box.maxY * f).toBeLessThanOrEqual(FRAME.top + FRAME.height);
      }
    }
  });

  it('stays inside the frame with every optional part piled on', () => {
    for (const kind of CREATURE_KINDS) {
      const built = buildCreature(
        defineCreature({
          kind,
          ears: 'long',
          horns: 'unicorn',
          wings: 'feather',
          tail: 'fluffy',
          spikes: 'plates',
          accessory: 'party-hat',
        }),
      );
      const box = bounds(built.root);
      expect(box.minY * built.fit).toBeGreaterThanOrEqual(FRAME.top);
      expect(Math.max(-box.minX, box.maxX) * built.fit).toBeLessThanOrEqual(-FRAME.left);
    }
  });
});

describe('creatures.svg', () => {
  it('is a well-formed SVG with a viewBox, for every kind', () => {
    for (const kind of CREATURE_KINDS) {
      const svg = C.svg({ kind, name: 'Svg' }, { size: 128, mood: 'shy' });
      expect(
        svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"'),
      ).toBe(true);
      expect(svg).toContain('viewBox="-60 -114 120 120"');
      const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
      expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
      expect(doc.documentElement.nodeName).toBe('svg');
      expect(svg).not.toMatch(/<script|href=|NaN|undefined/u);
    }
  });

  it('clamps the size and escapes the name', () => {
    expect(C.svg({ kind: 'bear', name: '<b>"x"</b>' }, { size: 99999 })).toContain('width="1024"');
    expect(C.svg({ kind: 'bear', name: '<b>' })).not.toContain('<b>');
    const url = C.dataUrl({ kind: 'ghost' }, { size: 64 });
    expect(url.startsWith('data:image/svg+xml,')).toBe(true);
    expect(url).not.toContain('#');
  });
});

describe('creatures.create', () => {
  it('builds named joints for anim.rig and adds the view to the world', () => {
    const s = scene();
    const c = C.create(s, { kind: 'dragon', name: 'Zahra' }, { size: 220, x: 300, y: 400 });
    expect(s.world.children).toContain(c.view);
    const v = c.view as FakeContainer;
    expect([v.x, v.y]).toEqual([300, 400]);
    for (const name of [
      'root',
      'body',
      'head',
      'armL',
      'armR',
      'legL',
      'legR',
      'tail',
      'eyes',
      'face',
      'wingL',
      'wingR',
    ]) {
      expect(c.parts[name], name).toBeInstanceOf(FakeContainer);
    }
    // anim.rig binds these joints directly and drives them without throwing.
    const animator = createAnimator();
    const rig = createRig(animator, c.parts, { state: 'walk', size: 96 });
    run(animator, 0.5);
    expect((c.parts['legL'] as FakeContainer).rotation).not.toBe(0);
    rig.stop();
  });

  it('plugs into s.lib.anim: c.rig(a, { state }) eases the big arm swings', () => {
    const a = createAnimLibrary().create();
    const c = C.create(scene(), { kind: 'bear', name: 'Bo' }, { size: 200, animator: a });
    const rig = c.rig(a, { state: 'wave' });
    expect(rig.state).toBe('wave');
    run(a, 0.4);
    const armR = c.parts['armR'] as FakeContainer;
    // The rig asks for ~2.5 rad; a chibi arm stops short so the hand stays beside the head.
    expect(armR.rotation).toBeGreaterThan(1);
    expect(armR.rotation).toBeLessThan(2.4);
    for (const state of [
      'idle',
      'walk',
      'run',
      'jump',
      'talk',
      'celebrate',
      'hurt',
      'think',
    ] as const) {
      expect(rig.set(state)).toBe(true);
      run(a, 0.2);
    }
    expect(() => c.rig({}, {})).toThrow(TypeError);
  });

  it('blinks, glances and moves its wings on the animator', () => {
    const a = createAnimLibrary().create();
    const c = C.create(scene(), { kind: 'dragon', name: 'Live' }, { animator: a });
    const wing = c.parts['wingL'] as FakeContainer;
    let blinked = false;
    for (let i = 0; i < 60 * 8; i += 1) {
      a.update(1 / 60);
      if ((c.parts['eyes'] as FakeContainer).scale.y < 0.5) blinked = true;
    }
    expect(blinked).toBe(true);
    expect(wing.rotation).not.toBe(0);
    c.face.blink();
    a.update(0.07);
    expect((c.parts['eyes'] as FakeContainer).scale.y).toBeLessThan(0.5);
  });

  it('stays still under reduced motion and in the editor', () => {
    for (const [s, reduced] of [
      [scene(), true],
      [scene({ editor: true }), false],
      [scene({ reducedMotion: true }), false],
    ] as const) {
      const a = createAnimLibrary().create({ reducedMotion: reduced });
      const c = C.create(s, { kind: 'ghost', name: 'Still', wings: 'fairy' }, { animator: a });
      const rig = c.rig(a, { state: 'idle' });
      run(a, 3);
      const eyes = c.parts['eyes'] as FakeContainer;
      const float = c.parts['float'] as FakeContainer;
      expect([eyes.x, eyes.y, eyes.scale.y]).toEqual([0, 0, 1]);
      expect([float.y, float.rotation]).toEqual([0, 0]);
      expect((c.parts['wingL'] as FakeContainer).scale.x).toBe(1);
      rig.stop();
    }
  });

  it('changes mood in place and ignores unknown words', () => {
    const c = C.create(scene(), { kind: 'bunny' }, { mood: 'calm' });
    expect(c.face.mood).toBe('calm');
    const face = c.parts['face'] as FakeContainer;
    const before = face.children.length;
    expect(c.face.set('sleepy')).toBe(true);
    expect(c.face.mood).toBe('sleepy');
    expect(face.children.length).toBe(before);
    expect(c.face.set('banana')).toBe(false);
    expect(c.face.mood).toBe('sleepy');
    c.face.lookAt(1000, 0);
    expect((c.parts['eyes'] as FakeContainer).x).toBeGreaterThan(0);
    c.face.lookAt(null);
    expect((c.parts['eyes'] as FakeContainer).x).toBe(0);
  });

  it('accepts s.PIXI or { PIXI }, refuses anything else, and disposes', () => {
    const c = C.create(PIXI, 'robot', { parent: null });
    expect(c.def.kind).toBe('robot');
    expect(() => C.create({}, 'robot')).toThrow(TypeError);
    c.dispose();
    expect((c.view as FakeContainer).destroyed).toBe(true);
  });
});

describe('creatures.texture', () => {
  it('rasterises the SVG at size × resolution through the injected environment', async () => {
    let drawn: number[] = [];
    let src = '';
    const env = {
      createImage: () => {
        const image = {
          onload: null as (() => void) | null,
          onerror: null as (() => void) | null,
          decoding: '',
          set src(value: string) {
            src = value;
            setTimeout(() => image.onload?.(), 0);
          },
        };
        return image as never;
      },
      createCanvas: (w: number, h: number) => ({
        width: w,
        height: h,
        getContext: () => ({
          drawImage: (_i: unknown, _x: number, _y: number, dw: number, dh: number) => {
            drawn = [dw, dh];
          },
        }),
      }),
    };
    const Texture = { from: (source: { resolution: number }) => ({ source }) };
    const texture = await creatureTexture(
      { Texture },
      { kind: 'star' },
      { size: 100, resolution: 2 },
      env,
    );
    expect(drawn).toEqual([200, 200]);
    expect(src.startsWith('data:image/svg+xml,')).toBe(true);
    expect((texture as { source: { resolution: number } }).source.resolution).toBe(2);
    await expect(creatureTexture({}, 'star', {}, env)).rejects.toThrow(TypeError);
  });
});
