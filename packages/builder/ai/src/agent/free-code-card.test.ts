import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  FREE_CODE_CARD,
  FREE_CODE_CARD_MAX_CHARS,
  FREE_CODE_OFF_HINT,
  freeCodeCardExamples,
} from './free-code-card';

/** The body of a `js` prop is the body of this: an async function of one parameter, `ck`. */
const AsyncFunction = (
  Object.getPrototypeOf(async function () {
    /* the constructor is all this needs */
  }) as { constructor: new (name: string, body: string) => (ck: unknown) => Promise<unknown> }
).constructor;

function compile(example: string): (ck: unknown) => Promise<unknown> {
  return new AsyncFunction('ck', example);
}

interface Ticked {
  x: number;
  y: number;
}

/** A PIXI stand-in: just the calls the card's example makes. */
function fakePixi() {
  const children: Ticked[] = [];
  const ticks: ((ticker: { deltaTime: number }) => void)[] = [];
  const resizes: (() => void)[] = [];
  class Graphics implements Ticked {
    x = 0;
    y = 0;
    roundRect() {
      return this;
    }
    circle() {
      return this;
    }
    fill() {
      return this;
    }
  }
  const app = {
    screen: { width: 800, height: 400 },
    renderer: {
      on(event: string, fn: () => void) {
        if (event === 'resize') resizes.push(fn);
      },
    },
    stage: {
      addChild(child: Ticked) {
        children.push(child);
      },
    },
    ticker: {
      add(fn: (ticker: { deltaTime: number }) => void) {
        ticks.push(fn);
      },
    },
  };
  return { children, ticks, resizes, Graphics, app };
}

function fakeCk(overrides: Record<string, unknown> = {}) {
  const disposers: (() => void)[] = [];
  const ck = {
    root: {},
    editor: false,
    reducedMotion: false,
    onDispose: (fn: () => void) => {
      disposers.push(fn);
    },
    ...overrides,
  };
  return { ck, disposers };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('FREE_CODE_CARD', () => {
  it('fits its budget', () => {
    expect(FREE_CODE_CARD.length).toBeLessThanOrEqual(FREE_CODE_CARD_MAX_CHARS);
    expect(FREE_CODE_CARD_MAX_CHARS).toBe(2800);
  });

  it('states the runtime API, where the code goes, and the rules', () => {
    for (const piece of [
      'FREE CODE MODE is ON',
      '"js" prop of a customCode block',
      '32000',
      // preview-fix (2026-10-12): a stage sized by width, laid out again when its region resizes.
      'never vh',
      'aspect-ratio:16/9',
      'position:relative;z-index:1',
      "app.renderer.on('resize',fn)",
      'BODY of an async function',
      'ck.root',
      'ck.editor',
      'ck.reducedMotion',
      'ck.onDispose(fn)',
      'await ck.pixi()',
      'pixi.js v8',
      'await ck.stage({background?,pointer?,resolution?})',
      '{PIXI,app,canvas}',
      'no eval, document.write, host localStorage',
      'network calls the person did not ask for',
      'Guard motion with ck.reducedMotion',
      'Hex colours are free',
      'Arabic page: keep text in the tree',
    ]) {
      expect(FREE_CODE_CARD, piece).toContain(piece);
    }
  });

  it('is page code, never the edit script', () => {
    expect(FREE_CODE_CARD).not.toContain('script.run');
    expect(FREE_CODE_CARD).not.toContain('ck.find');
  });

  it('has three examples that compile as the body of an async function of ck, in plain JavaScript', () => {
    const examples = freeCodeCardExamples();
    expect(examples).toHaveLength(3);
    for (const example of examples) {
      expect(() => compile(example)).not.toThrow();
      expect(example).not.toMatch(/:\s*(?:string|number|boolean|any|unknown)\b/u);
      expect(example).not.toMatch(/\b(?:interface|import|export|as const|eval)\b/u);
      expect(example).not.toContain('"');
      expect(example).not.toContain('document.write');
      expect(example).not.toContain('localStorage');
    }
  });

  it('runs the Pixi example: five characters, one ticker, they walk; with reduced motion they stand', async () => {
    const [pixi] = freeCodeCardExamples();
    if (pixi === undefined) throw new Error('no Pixi example');

    const moving = fakePixi();
    const live = fakeCk();
    await compile(pixi)({
      ...live.ck,
      stage: () => Promise.resolve({ PIXI: { Graphics: moving.Graphics }, app: moving.app, canvas: {} }),
    });
    expect(moving.children).toHaveLength(5);
    expect(moving.ticks).toHaveLength(1);
    expect(moving.children[1]?.y).toBeCloseTo(280);
    // The region grew (preview-fix 2026-10-12): the stage says so and the walkers follow.
    expect(moving.resizes).toHaveLength(1);
    moving.app.screen.height = 600;
    moving.resizes[0]?.();
    expect(moving.children[1]?.y).toBeCloseTo(420);
    const before = moving.children[0]?.x ?? 0;
    moving.ticks[0]?.({ deltaTime: 2 });
    expect(moving.children[0]?.x).toBeCloseTo(before + 3);
    // Past the right edge a character comes back round.
    const first = moving.children[0];
    if (first === undefined) throw new Error('no character');
    first.x = 859;
    moving.ticks[0]?.({ deltaTime: 2 });
    expect(first.x).toBeLessThan(10);

    const still = fakePixi();
    const calm = fakeCk({ reducedMotion: true });
    await compile(pixi)({
      ...calm.ck,
      stage: () => Promise.resolve({ PIXI: { Graphics: still.Graphics }, app: still.app, canvas: {} }),
    });
    expect(still.children).toHaveLength(5);
    expect(still.ticks).toHaveLength(0);
  });

  describe('the DOM example', () => {
    function domStubs() {
      const frames: ((time: number) => void)[] = [];
      let observed: ((entries: { isIntersecting: boolean }[]) => void) | undefined;
      const io = { disconnect: vi.fn(), observe: vi.fn() };
      class FakeObserver {
        constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
          observed = callback;
        }
        disconnect = io.disconnect;
        observe = io.observe;
      }
      vi.stubGlobal('IntersectionObserver', FakeObserver);
      vi.stubGlobal('requestAnimationFrame', (fn: (time: number) => void) => frames.push(fn));
      const cancel = vi.fn();
      vi.stubGlobal('cancelAnimationFrame', cancel);
      const el = { dataset: { count: '250' }, textContent: '' };
      const root = { querySelector: (selector: string) => (selector === '[data-count]' ? el : null) };
      return { frames, io, cancel, el, root, enter: () => observed?.([{ isIntersecting: true }]) };
    }

    it('waits for the element to scroll in, then counts up to the number and cleans up', async () => {
      const example = freeCodeCardExamples()[1];
      if (example === undefined) throw new Error('no DOM example');
      const stubs = domStubs();
      const { ck, disposers } = fakeCk({ root: stubs.root });

      await compile(example)(ck);
      expect(stubs.io.observe).toHaveBeenCalledWith(stubs.el);
      expect(stubs.frames).toHaveLength(0);

      stubs.enter();
      expect(stubs.io.disconnect).toHaveBeenCalled();
      const start = performance.now();
      // The first frame is drawn at once; the rest follow the animation clock.
      expect(stubs.el.textContent).toBe(0);
      for (let step = 0; step < 4 && stubs.frames.length > 0; step += 1) {
        stubs.frames.shift()?.(start + 400 * (step + 1));
      }
      expect(stubs.el.textContent).toBe(250);
      expect(disposers).toHaveLength(1);
      disposers[0]?.();
      expect(stubs.cancel).toHaveBeenCalled();
    });

    it('shows the final number at once under reduced motion', async () => {
      const example = freeCodeCardExamples()[1];
      if (example === undefined) throw new Error('no DOM example');
      const stubs = domStubs();
      const { ck } = fakeCk({ root: stubs.root, reducedMotion: true });

      await compile(example)(ck);
      stubs.enter();

      expect(stubs.el.textContent).toBe(250);
      expect(stubs.frames).toHaveLength(0);
    });

    it('does nothing when the region has no counter', async () => {
      const example = freeCodeCardExamples()[1];
      if (example === undefined) throw new Error('no DOM example');
      const stubs = domStubs();
      const { ck, disposers } = fakeCk({ root: { querySelector: () => null } });

      await compile(example)(ck);

      expect(stubs.io.observe).not.toHaveBeenCalled();
      expect(disposers).toHaveLength(0);
    });
  });

  it('runs the cleanup example: the resize listener it adds is the one onDispose removes', async () => {
    const example = freeCodeCardExamples()[2];
    if (example === undefined) throw new Error('no cleanup example');
    const added: unknown[] = [];
    const removed: unknown[] = [];
    vi.stubGlobal('innerWidth', 500);
    vi.stubGlobal('addEventListener', (_type: string, fn: unknown) => added.push(fn));
    vi.stubGlobal('removeEventListener', (_type: string, fn: unknown) => removed.push(fn));
    const toggle = vi.fn();
    const { ck, disposers } = fakeCk({ root: { classList: { toggle } } });

    await compile(example)(ck);
    expect(toggle).toHaveBeenCalledWith('narrow', true);
    expect(added).toHaveLength(1);
    disposers[0]?.();
    expect(removed).toEqual(added);
  });
});

describe('FREE_CODE_OFF_HINT', () => {
  it('sends the person to the switch by its name and keeps the model from refusing', () => {
    expect(FREE_CODE_OFF_HINT).toContain('«وضع الكود الحر»');
    expect(FREE_CODE_OFF_HINT).toContain('composer');
    expect(FREE_CODE_OFF_HINT).toContain('closed motion scene');
    expect(FREE_CODE_OFF_HINT).toContain('instead of refusing');
    expect(FREE_CODE_OFF_HINT.length).toBeLessThan(300);
  });
});
