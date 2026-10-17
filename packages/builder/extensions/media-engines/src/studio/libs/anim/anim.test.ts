import { describe, expect, it } from 'vitest';

import { createAnimLibrary } from '../anim-entry';
import { EASINGS, mixColor } from './easing';
import { resolveProp } from './props';

function sprite() {
  return { x: 0, y: 0, alpha: 1, rotation: 0, tint: 0x000000, scale: { x: 1, y: 1 } };
}

describe('easing', () => {
  it.each(Object.keys(EASINGS))('%s maps 0 → 0 and 1 → 1', (name) => {
    const fn = EASINGS[name] as (t: number) => number;
    expect(fn(0)).toBeCloseTo(0, 6);
    expect(fn(1)).toBeCloseTo(1, 6);
  });

  it('mixes colours per channel', () => {
    expect(mixColor(0x000000, 0xffffff, 0.5)).toBe(0x808080);
    expect(mixColor(0xff0000, 0x0000ff, 1)).toBe(0x0000ff);
  });
});

describe('property paths', () => {
  it('reads dotted paths and refuses prototype walks', () => {
    const target = sprite();
    expect(resolveProp(target, 'scale.x')?.key).toBe('x');
    expect(resolveProp(target, '__proto__.x')).toBeUndefined();
    expect(resolveProp(target, 'constructor')).toBeUndefined();
    expect(resolveProp(target, 'a.b.c.d.e')).toBeUndefined();
  });
});

describe('anim tweens', () => {
  const A = createAnimLibrary();

  it('moves a property to its target and completes', async () => {
    const anim = A.create();
    const target = sprite();
    let completed = 0;
    const tween = anim.to(
      target,
      { x: 100, 'scale.x': 2 },
      { duration: 1, ease: 'linear', onComplete: () => (completed += 1) },
    );
    anim.update(0.5);
    expect(target.x).toBeCloseTo(50);
    expect(target.scale.x).toBeCloseTo(1.5);
    anim.update(0.25);
    anim.update(0.25);
    anim.update(0.01);
    expect(target.x).toBe(100);
    expect(tween.done).toBe(true);
    expect(completed).toBe(1);
    await expect(tween.finished).resolves.toBeUndefined();
    expect(anim.active).toBe(0);
  });

  it('honours delay, yoyo and repeat', () => {
    const anim = A.create();
    const target = sprite();
    anim.to(target, { x: 10 }, { duration: 1, delay: 0.5, ease: 'linear', repeat: 1, yoyo: true });
    anim.update(0.25);
    expect(target.x).toBe(0);
    for (let i = 0; i < 7; i += 1) anim.update(0.25);
    // first play ends at 1.5 s, the yoyo play is half way back at 2.0 s
    expect(target.x).toBeCloseTo(5);
    for (let i = 0; i < 3; i += 1) anim.update(0.25);
    expect(target.x).toBe(0);
    expect(anim.active).toBe(0);
  });

  it('interpolates listed colour keys', () => {
    const anim = A.create();
    const target = sprite();
    anim.to(target, { tint: 0xffffff }, { duration: 1, ease: 'linear', colors: ['tint'] });
    anim.update(0.5);
    expect(target.tint).toBe(0x808080);
  });

  it('from() shows the start values at once and lands on the original', () => {
    const anim = A.create();
    const target = { ...sprite(), alpha: 1 };
    anim.from(target, { alpha: 0, y: 40 }, { duration: 0.5 });
    expect(target.alpha).toBe(0);
    expect(target.y).toBe(40);
    for (let i = 0; i < 4; i += 1) anim.update(0.2);
    expect(target.alpha).toBe(1);
    expect(target.y).toBe(0);
  });

  it('lands everything immediately under reduced motion', () => {
    const anim = A.create({ reducedMotion: true });
    const target = sprite();
    const tween = anim.to(target, { x: 30 }, { duration: 5, repeat: -1 });
    expect(target.x).toBe(30);
    expect(tween.done).toBe(true);
    expect(anim.active).toBe(0);
  });

  it('rejects non-numeric props and caps live tweens', () => {
    const anim = A.create();
    expect(() => anim.to(sprite(), { x: Number.NaN })).toThrow(TypeError);
    for (let i = 0; i < A.MAX_TWEENS; i += 1) anim.to(sprite(), { x: 1 });
    expect(() => anim.to(sprite(), { x: 1 })).toThrow(RangeError);
    anim.dispose();
    expect(anim.active).toBe(0);
  });

  it('runs timelines in order with relative placement and calls', () => {
    const anim = A.create();
    const a = sprite();
    const b = sprite();
    const calls: string[] = [];
    const tl = anim
      .timeline()
      .to(a, { x: 10 }, { duration: 1, ease: 'linear' })
      .call(() => calls.push('mid'))
      .to(b, { x: 10 }, { duration: 1, ease: 'linear' }, '+=0.5');
    expect(tl.duration).toBeCloseTo(2.5);
    anim.update(0.5);
    expect(a.x).toBeCloseTo(5);
    expect(b.x).toBe(0);
    anim.update(0.6);
    expect(calls).toEqual(['mid']);
    anim.update(1);
    expect(b.x).toBeCloseTo(6);
    anim.update(1);
    expect(b.x).toBe(10);
    expect(tl.done).toBe(true);
  });

  it('springs settle on their goal', () => {
    const anim = A.create();
    const target = sprite();
    const spring = anim.spring(target, 'x', { stiffness: 200, damping: 20 });
    spring.to(50);
    for (let i = 0; i < 300; i += 1) anim.update(1 / 60);
    expect(target.x).toBeCloseTo(50, 1);
    expect(spring.settled).toBe(true);
  });

  it('shake restores the base position', () => {
    const anim = A.create();
    const target = { ...sprite(), x: 10, y: 20 };
    anim.shake(target, { intensity: 10, duration: 0.3 });
    anim.update(0.1);
    expect(target.x === 10 && target.y === 20).toBe(false);
    anim.update(0.3);
    expect(target).toMatchObject({ x: 10, y: 20 });
  });

  it('killOf stops only that target', () => {
    const anim = A.create();
    const a = sprite();
    const b = sprite();
    anim.to(a, { x: 10 }, { duration: 1 });
    anim.to(b, { x: 10 }, { duration: 1 });
    anim.killOf(a, true);
    expect(a.x).toBe(10);
    expect(anim.active).toBe(1);
  });
});

describe('anim characters', () => {
  const A = createAnimLibrary();

  it('steps sprite frames, ends one-shot states and follows next', () => {
    const anim = A.create();
    const view = { texture: '' as unknown };
    const ended: string[] = [];
    const states = anim.sprite(view, {
      states: {
        idle: { frames: ['i0', 'i1'], fps: 2 },
        jump: { frames: ['j0', 'j1'], fps: 4, loop: false, next: 'idle' },
      },
    });
    states.onEnd((name) => ended.push(name));
    expect(view.texture).toBe('i0');
    anim.update(0.5);
    expect(view.texture).toBe('i1');
    anim.update(0.5);
    expect(view.texture).toBe('i0');
    expect(states.play('jump')).toBe(true);
    expect(view.texture).toBe('j0');
    anim.update(0.25);
    expect(view.texture).toBe('j1');
    anim.update(0.25);
    expect(ended).toEqual(['jump']);
    expect(states.state).toBe('idle');
    expect(states.play('missing')).toBe(false);
  });

  it('validates sprite states', () => {
    const anim = A.create();
    expect(() => anim.sprite({}, { states: {} })).toThrow(RangeError);
    expect(() => anim.sprite({}, { states: { a: { frames: [1], next: 'b' } } })).toThrow(
      RangeError,
    );
  });

  it('poses a procedural rig, cross-fades and restores on stop', () => {
    const anim = A.create();
    const parts = {
      root: sprite(),
      body: sprite(),
      legL: sprite(),
      legR: sprite(),
      armR: sprite(),
    };
    const rig = anim.rig(parts, { state: 'idle', size: 80 });
    expect(rig.set('walk')).toBe(true);
    for (let i = 0; i < 20; i += 1) anim.update(1 / 60);
    expect(parts.legL.rotation).not.toBe(0);
    expect(Math.sign(parts.legL.rotation)).toBe(-Math.sign(parts.legR.rotation));
    rig.face(-1);
    expect(parts.root.scale.x).toBeLessThan(0);
    expect(rig.set('dance' as never)).toBe(false);
    parts.root.x = 120;
    for (let i = 0; i < 5; i += 1) anim.update(1 / 60);
    expect(parts.root.x).toBe(120);
    rig.stop();
    expect(parts.root.x).toBe(120);
    expect(parts.legL.rotation).toBe(0);
    expect(parts.root.scale.x).toBe(1);
  });

  it('refuses parts that are not display objects', () => {
    const anim = A.create();
    expect(() => anim.rig({ body: { x: 1 } })).toThrow(TypeError);
    expect(() => anim.rig({})).toThrow(RangeError);
  });
});
