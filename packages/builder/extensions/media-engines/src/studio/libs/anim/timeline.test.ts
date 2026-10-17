import { describe, expect, it } from 'vitest';

import { createAnimLibrary } from '../anim-entry';

/*
  Mural stories (2026-10-14): the GSAP-style timeline controls a scrubbed story needs — seek,
  progress and time (so s.scroll.progress can scrub it both ways), from / fromTo, stagger over an
  array, labels and relative positions, and yoyo repeats.
*/

const A = createAnimLibrary();

function dot(x = 0) {
  return { x, y: 0, alpha: 1 };
}

describe('timeline positions', () => {
  it("places '<', '>', labels and offsets like GSAP", () => {
    const anim = A.create();
    const a = dot();
    const b = dot();
    const c = dot();
    const d = dot();
    const tl = anim
      .timeline({ paused: true })
      .to(a, { x: 10 }, { duration: 2, ease: 'linear' })
      .label('turn', '-=0.5')
      .to(b, { x: 10 }, { duration: 1, ease: 'linear' }, '<0.5')
      .to(c, { x: 10 }, { duration: 1, ease: 'linear' }, '>')
      .to(d, { x: 10 }, { duration: 1, ease: 'linear' }, 'turn+=1');
    // a 0-2, label at 1.5, b 0.5-1.5, c 1.5-2.5, d 2.5-3.5
    expect(tl.duration).toBeCloseTo(3.5);
    tl.seek('turn');
    expect(tl.time()).toBeCloseTo(1.5);
    expect(a.x).toBeCloseTo(7.5);
    expect(b.x).toBeCloseTo(10);
    expect(c.x).toBe(0);
    tl.seek(3);
    expect(c.x).toBe(10);
    expect(d.x).toBeCloseTo(5);
  });

  it('falls back to the end for an unknown label or a malformed position', () => {
    const anim = A.create();
    const a = dot();
    const tl = anim
      .timeline()
      .to(a, { x: 1 }, { duration: 1 })
      .to(a, { y: 1 }, { duration: 1 }, 'nowhere')
      .to(a, { alpha: 0 }, { duration: 1 }, '?!');
    expect(tl.duration).toBeCloseTo(3);
  });
});

describe('timeline scrubbing', () => {
  it('progress(p) scrubs forward and back, unwinding a key tweened twice', () => {
    const anim = A.create();
    const a = dot();
    const tl = anim
      .timeline({ paused: true })
      .to(a, { x: 10 }, { duration: 1, ease: 'linear' })
      .to(a, { x: 30 }, { duration: 1, ease: 'linear' }, '+=1');
    expect(tl.duration).toBeCloseTo(3);
    tl.progress(1);
    expect(a.x).toBe(30);
    tl.progress(0.5);
    expect(a.x).toBeCloseTo(10);
    expect(tl.progress()).toBeCloseTo(0.5);
    tl.progress(1 / 6);
    expect(a.x).toBeCloseTo(5);
    tl.progress(0);
    expect(a.x).toBe(0);
    tl.progress(5);
    expect(a.x).toBe(30);
    // a paused timeline does not move on its own
    anim.update(0.5);
    expect(a.x).toBe(30);
  });

  it('fires calls once when passed, and again after scrubbing back before them', () => {
    const anim = A.create();
    const calls: number[] = [];
    const tl = anim
      .timeline({ paused: true })
      .wait(1)
      .call(() => calls.push(1));
    tl.seek(0.5);
    expect(calls).toEqual([]);
    tl.seek(1);
    tl.seek(1);
    expect(calls).toEqual([1]);
    tl.seek(0);
    tl.progress(1);
    expect(calls).toEqual([1, 1]);
  });

  it('resumes playing from where it was sought', () => {
    const anim = A.create();
    const a = dot();
    const tl = anim.timeline({ paused: true }).to(a, { x: 10 }, { duration: 2, ease: 'linear' });
    tl.seek(1);
    tl.resume();
    anim.update(0.5);
    expect(a.x).toBeCloseTo(7.5);
  });
});

describe('timeline from, fromTo and stagger', () => {
  it('shows from values at once and lands on the original values', () => {
    const anim = A.create();
    const a = { ...dot(), alpha: 1 };
    const tl = anim
      .timeline()
      .wait(1)
      .from(a, { alpha: 0, y: 20 }, { duration: 1, ease: 'linear' });
    expect(a.alpha).toBe(0);
    expect(a.y).toBe(20);
    // update() takes at most one second per call
    anim.update(0.75);
    anim.update(0.75);
    expect(a.alpha).toBeCloseTo(0.5);
    anim.update(1);
    expect(a).toMatchObject({ alpha: 1, y: 0 });
    expect(tl.done).toBe(true);
  });

  it('fromTo sets both ends and unwinds to its from value', () => {
    const anim = A.create();
    const a = dot(50);
    const tl = anim
      .timeline({ paused: true })
      .fromTo(a, { x: -10 }, { x: 10 }, { duration: 1, ease: 'linear' }, 1);
    expect(a.x).toBe(-10);
    tl.seek(1.5);
    expect(a.x).toBeCloseTo(0);
    tl.seek(0);
    expect(a.x).toBe(-10);
  });

  it('staggers an array of targets and places what follows after the last one', () => {
    const anim = A.create();
    const birds = [dot(), dot(), dot()];
    const after = dot();
    const tl = anim
      .timeline({ paused: true })
      .to(birds, { x: 10 }, { duration: 1, stagger: 0.5, ease: 'linear' })
      .to(after, { x: 10 }, { duration: 1, ease: 'linear' });
    expect(tl.duration).toBeCloseTo(3);
    tl.seek(1);
    expect(birds.map((bird) => bird.x)).toEqual([10, 5, 0]);
    expect(after.x).toBe(0);
    tl.seek(2.5);
    expect(after.x).toBeCloseTo(5);
  });

  it('caps entries at MAX_TWEENS', () => {
    const anim = A.create();
    const many = Array.from({ length: A.MAX_TWEENS + 1 }, () => dot());
    expect(() => anim.timeline().to(many, { x: 1 })).toThrow(RangeError);
  });
});

describe('timeline repeat and yoyo', () => {
  it('plays forward then back with yoyo, and finishes on the start', () => {
    const anim = A.create();
    const a = dot();
    const tl = anim
      .timeline({ repeat: 1, yoyo: true })
      .to(a, { x: 10 }, { duration: 1, ease: 'linear' });
    anim.update(0.5);
    expect(a.x).toBeCloseTo(5);
    anim.update(0.75);
    expect(a.x).toBeCloseTo(7.5);
    anim.update(0.5);
    expect(a.x).toBeCloseTo(2.5);
    anim.update(0.5);
    expect(a.x).toBe(0);
    expect(tl.done).toBe(true);
  });

  it('loops forever with repeat -1, firing its calls once per loop', () => {
    const anim = A.create();
    const a = dot();
    let calls = 0;
    const tl = anim
      .timeline({ repeat: -1 })
      .call(() => (calls += 1))
      .to(a, { x: 10 }, { duration: 1, ease: 'linear' });
    for (let i = 0; i < 10; i += 1) anim.update(0.25);
    expect(a.x).toBeCloseTo(5);
    expect(calls).toBe(3);
    expect(tl.done).toBe(false);
    tl.kill();
    expect(tl.done).toBe(true);
  });

  it('lands on the end values under reduced motion', () => {
    const anim = A.create({ reducedMotion: true });
    const a = dot();
    const tl = anim.timeline({ repeat: -1 }).to(a, { x: 10 }, { duration: 1 });
    anim.update(1 / 60);
    expect(a.x).toBe(10);
    expect(tl.done).toBe(true);
    expect(tl.progress()).toBe(1);
  });
});
