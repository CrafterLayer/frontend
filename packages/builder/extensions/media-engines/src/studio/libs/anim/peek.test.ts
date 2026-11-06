import { describe, expect, it } from 'vitest';

import { createAnimLibrary } from '../anim-entry';

// A Pixi stand-in: display objects with transforms and a chainable drawing log.
class FakeContainer {
  x = 0;
  y = 0;
  rotation = 0;
  scale = { x: 1, y: 1 };
  mask: unknown = undefined;
  children: unknown[] = [];
  addChild(...children: unknown[]) {
    this.children.push(...children);
    return children[0];
  }
}

class FakeGraphics extends FakeContainer {
  ops: string[] = [];
  private log(op: string) {
    this.ops.push(op);
    return this;
  }
  rect() {
    return this.log('rect');
  }
  circle() {
    return this.log('circle');
  }
  ellipse() {
    return this.log('ellipse');
  }
  poly() {
    return this.log('poly');
  }
  moveTo() {
    return this.log('moveTo');
  }
  lineTo() {
    return this.log('lineTo');
  }
  quadraticCurveTo() {
    return this.log('quad');
  }
  fill() {
    return this.log('fill');
  }
  stroke() {
    return this.log('stroke');
  }
}

class FakeSprite extends FakeContainer {
  width = 200;
  height = 240;
  anchor = { set: () => undefined };
  constructor(readonly texture: unknown) {
    super();
  }
}

const PIXI = { Container: FakeContainer, Graphics: FakeGraphics, Sprite: FakeSprite };

function scene(random = () => 0.5) {
  return { PIXI, random, pointer: { x: 0, y: 0 } };
}

interface PeekView {
  x: number;
  y: number;
  rotation: number;
  children: [FakeGraphics, FakeContainer];
}

function parts(view: unknown) {
  const v = view as PeekView;
  const [mask, rig] = v.children;
  return { mask, rig };
}

function run(anim: { update(dt: number): void }, seconds: number) {
  for (let t = 0; t < seconds; t += 1 / 60) anim.update(1 / 60);
}

describe('anim.peek', () => {
  const A = createAnimLibrary();

  it('lists the character vocabulary', () => {
    expect(A.peekEars).toEqual(['cat', 'fox', 'bear', 'bunny', 'none']);
    expect(A.peekModes).toEqual(['loop', 'up']);
  });

  it('starts raised with the eyes above the edge and masks the far side', () => {
    const anim = A.create();
    const p = anim.peek(scene(), { x: 300, y: 400, size: 100 });
    const view = p.view as PeekView;
    const { mask, rig } = parts(p.view);
    expect([view.x, view.y]).toEqual([300, 400]);
    expect(rig.mask).toBe(mask);
    expect(p.lift).toBe(1);
    // The head's centre sits above the edge (y < 0) and the eyes clear it.
    expect(rig.y).toBeLessThan(-0.04 * 100);
  });

  it('ducks under the edge, waits, and peeks again', () => {
    const anim = A.create();
    const p = anim.peek(scene(), { size: 100, hold: 0.5, interval: [1, 1] });
    run(anim, 1.2);
    expect(p.lift).toBeLessThan(0.05);
    const { rig } = parts(p.view);
    // Hidden: even the ear tips are below the edge.
    expect(rig.y).toBeGreaterThan(50);
    // Waits its 1 s, then springs up (and holds 0.5 s before the next duck).
    run(anim, 1);
    expect(p.lift).toBeGreaterThan(0.9);
  });

  it("stays raised in 'up' mode", () => {
    const anim = A.create();
    const p = anim.peek(scene(), { mode: 'up', hold: 0.2 });
    run(anim, 3);
    expect(p.lift).toBeGreaterThan(0.95);
    expect(p.setMode('loop')).toBe(true);
    expect(p.setMode('sideways' as never)).toBe(false);
  });

  it('blinks while up', () => {
    const anim = A.create();
    const p = anim.peek(scene(), { mode: 'up' });
    p.blink();
    anim.update(0.07);
    const head = parts(p.view).rig.children[0] as FakeContainer;
    const lids = head.children.find(
      (child) => child instanceof FakeContainer && !(child instanceof FakeGraphics),
    ) as FakeContainer;
    expect(lids.scale.y).toBeLessThan(0.5);
    anim.update(0.2);
    expect(lids.scale.y).toBeCloseTo(1, 5);
  });

  it('hangs upside down from a bottom edge', () => {
    const anim = A.create();
    const p = anim.peek(scene(), { side: 'bottom' });
    expect((p.view as PeekView).rotation).toBeCloseTo(Math.PI);
  });

  it('draws different ears from data', () => {
    const anim = A.create();
    const ears = (character: object) => {
      const head = parts(anim.peek(scene(), { character }).view).rig.children[0] as FakeContainer;
      return (head.children[0] as FakeGraphics).ops;
    };
    expect(ears({ ears: 'cat' })).toContain('poly');
    expect(ears({ ears: 'bear' })).toContain('circle');
    expect(ears({ ears: 'bunny' })).toContain('ellipse');
  });

  it('uses a texture (a peeps face) instead of the drawn head', () => {
    const anim = A.create();
    const texture = { id: 'peep' };
    const p = anim.peek(scene(), { texture, size: 100 });
    const head = parts(p.view).rig.children[0] as FakeContainer;
    const sprite = head.children[0] as FakeSprite;
    expect(sprite.texture).toBe(texture);
    expect(sprite.width).toBe(100);
    expect(sprite.height).toBe(120);
  });

  it('settles calls at once under reduced motion', () => {
    const anim = A.create({ reducedMotion: true });
    const p = anim.peek(scene());
    p.down();
    expect(p.lift).toBe(0);
    p.up();
    expect(p.lift).toBe(1);
  });

  it('clamps malformed options from authored code', () => {
    const anim = A.create();
    const p = anim.peek(scene(), {
      size: 1e9,
      reveal: -3,
      interval: 'soon' as never,
      character: { ears: 'dragon' as never, fur: { bad: true } as never },
    });
    expect(p.mode).toBe('loop');
    expect(() => anim.peek({}, {})).toThrow(TypeError);
  });
});
