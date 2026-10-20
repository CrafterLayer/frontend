import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createScene } from './create-scene';
import { createSceneInput } from './input';
import { createFixedStep } from './fixed-step';
import { createStory } from './story';
import type { SceneApp, SceneHost, SceneTicker } from './types';
import { SCENE_MEMBERS } from './types';

afterEach(() => vi.restoreAllMocks());

function inputFixture(editor = false) {
  const root = document.createElement('section');
  const canvas = document.createElement('canvas');
  const field = document.createElement('input');
  root.append(canvas, field);
  document.body.append(root);
  const input = createSceneInput(root, canvas, editor);
  return { root, canvas, field, input };
}

describe('scene input', () => {
  it('activates lazily, captures only a focused canvas, and ignores text editing', () => {
    const { root, canvas, field, input } = inputFixture();
    expect(canvas.hasAttribute('tabindex')).toBe(false);
    expect(input.down('ArrowLeft')).toBe(false);
    expect(canvas.tabIndex).toBe(0);
    canvas.focus();
    const key = new KeyboardEvent('keydown', {
      code: 'ArrowLeft',
      bubbles: true,
      cancelable: true,
    });
    canvas.dispatchEvent(key);
    expect(key.defaultPrevented).toBe(true);
    expect(input.axis(['ArrowLeft', 'KeyA'], ['ArrowRight', 'KeyD'])).toBe(-1);
    field.focus();
    expect(input.down('ArrowLeft')).toBe(false);
    const typing = new KeyboardEvent('keydown', { code: 'KeyA', bubbles: true, cancelable: true });
    field.dispatchEvent(typing);
    expect(typing.defaultPrevented).toBe(false);
    expect(input.down('KeyA')).toBe(false);
    input.dispose();
    expect(canvas.hasAttribute('tabindex')).toBe(false);
    root.remove();
  });

  it('keeps native/virtual sources independent and clears stuck keys on blur and disposal', () => {
    const { root, canvas, input } = inputFixture();
    input.down('KeyD');
    canvas.focus();
    canvas.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', bubbles: true }));
    input.set('KeyD', true);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' }));
    expect(input.down('KeyD')).toBe(true);
    input.set('KeyD', false);
    expect(input.down('KeyD')).toBe(false);
    input.set('ArrowRight', true);
    window.dispatchEvent(new Event('blur'));
    expect(input.axis(['ArrowLeft'], ['ArrowRight'])).toBe(0);
    input.dispose();
    input.set('KeyA', true);
    expect(input.down('KeyA')).toBe(false);
    root.remove();
  });

  it('clears virtual-only input on window blur without needing a render tick', () => {
    const { input, root } = inputFixture();
    input.set('ArrowUp', true);
    window.dispatchEvent(new Event('blur'));
    expect(input.down('ArrowUp')).toBe(false);
    input.dispose();
    root.remove();
  });

  it('never makes the editor canvas focusable or intercepts input', () => {
    const { root, canvas, input } = inputFixture(true);
    input.set('KeyA', true);
    expect(input.down('KeyA')).toBe(false);
    expect(canvas.hasAttribute('tabindex')).toBe(false);
    const key = new KeyboardEvent('keydown', {
      code: 'ArrowLeft',
      bubbles: true,
      cancelable: true,
    });
    canvas.dispatchEvent(key);
    expect(key.defaultPrevented).toBe(false);
    input.dispose();
    root.remove();
  });
});

describe('fixed-step simulation', () => {
  it('runs the same steps at different render frame rates', () => {
    const slow = vi.fn();
    const fast = vi.fn();
    const a = createFixedStep(slow);
    const b = createFixedStep(fast);
    for (let n = 0; n < 30; n++) a.advance(1 / 30);
    for (let n = 0; n < 120; n++) b.advance(1 / 120);
    expect(slow).toHaveBeenCalledTimes(60);
    expect(fast).toHaveBeenCalledTimes(60);
    expect(slow).toHaveBeenLastCalledWith(1 / 60);
  });

  it('bounds catch-up and ignores bad deltas; unsubscribe is final', () => {
    const fn = vi.fn();
    const loop = createFixedStep(fn, { step: 1 / 120, maxSteps: 3 });
    loop.advance(20);
    expect(fn).toHaveBeenCalledTimes(3);
    loop.advance(Number.NaN);
    loop.advance(-1);
    loop.advance(0);
    expect(fn).toHaveBeenCalledTimes(3);
    loop.dispose();
    loop.advance(1);
    expect(fn).toHaveBeenCalledTimes(3);
    expect(() => createFixedStep(fn, { step: 0 })).toThrow();
    expect(() => createFixedStep(fn, { maxSteps: 100 })).toThrow();
  });
});

describe('manual chapter stories', () => {
  it('enters once, transitions explicitly, never wraps and resets to the chosen initial chapter', () => {
    const log: string[] = [];
    const chapters = ['intro', 'river', 'end'].map((id) => ({
      id,
      enter: () => log.push(`enter:${id}`),
      leave: () => log.push(`leave:${id}`),
    }));
    const story = createStory(chapters, 'river');
    expect(story.current).toBe('river');
    expect(story.go('missing')).toBe(false);
    expect(story.go('river')).toBe(false);
    expect(story.next()).toBe(true);
    expect(story.next()).toBe(false);
    expect(story.back()).toBe(true);
    expect(story.back()).toBe(true);
    expect(story.back()).toBe(false);
    expect(story.reset()).toBe(true);
    expect(story.current).toBe('river');
    story.dispose();
    story.dispose();
    expect(story.next()).toBe(false);
    expect(log).toEqual([
      'enter:river',
      'leave:river',
      'enter:end',
      'leave:end',
      'enter:river',
      'leave:river',
      'enter:intro',
      'leave:intro',
      'enter:river',
      'leave:river',
    ]);
  });

  it('rejects invalid/duplicate chapter ids and reentrant transitions', () => {
    expect(() => createStory([])).toThrow();
    expect(() => createStory([{ id: 'a' }, { id: 'a' }])).toThrow();
    expect(() => createStory([{ id: 'a' }], 'missing')).toThrow();
    const nested = vi.fn();
    const story = createStory([
      { id: 'a' },
      {
        id: 'b',
        enter: () => {
          nested(story.back());
        },
      },
    ]);
    expect(story.next()).toBe(true);
    expect(nested).toHaveBeenCalledWith(false);
    expect(story.current).toBe('b');
  });
});

function sceneFixture(reducedMotion = false, editor = false) {
  const callbacks = new Set<(ticker: SceneTicker) => void>();
  const ticker: SceneTicker = {
    deltaMS: 1000 / 60,
    started: false,
    maxFPS: 60,
    add(fn) {
      callbacks.add(fn);
    },
    remove(fn) {
      callbacks.delete(fn);
    },
    start() {
      Object.assign(this, { started: true });
    },
    stop() {
      Object.assign(this, { started: false });
    },
  };
  const root = document.createElement('section');
  const canvas = document.createElement('canvas');
  root.append(canvas);
  document.body.append(root);
  const cleanup: (() => void)[] = [];
  const host: SceneHost = {
    root,
    reducedMotion,
    editor,
    onDispose: (fn) => cleanup.push(fn),
    reportError: vi.fn(),
  };
  const renderSpy = vi.fn<() => void>();
  const app: SceneApp = {
    ticker,
    stage: {},
    screen: { width: 600, height: 400 },
    renderer: { resolution: 1 },
    render: renderSpy,
  };
  const scene = createScene(host, {}, app, canvas);
  return {
    scene,
    root,
    app,
    renderSpy,
    tick: () => {
      for (const fn of callbacks) fn(ticker);
    },
    dispose: () => {
      for (const fn of cleanup) fn();
      root.remove();
    },
    callbacks,
  };
}

describe('creative scene integration', () => {
  it.each([
    [true, false],
    [false, true],
  ])('keeps calm/editor scroll scenes compact (%s, %s)', (calm, editor) => {
    const { scene, root, dispose } = sceneFixture(calm, editor);
    root.style.minHeight = '400px';
    scene.scroll.pin();
    expect(root.style.minHeight).toBe('400px');
    dispose();
  });

  it('keeps the authoritative completion reference in sync with every actual scene member', () => {
    const { scene, dispose } = sceneFixture();
    expect(Object.keys(scene).sort()).toEqual([...SCENE_MEMBERS].sort());
    // The owner deliberately aliases its schema import to the tiny sound runtime in tsconfig.
    // Inspect the authoritative data rather than importing the entire schema into engine builds.
    const reference = readFileSync(
      resolve(import.meta.dirname, '../../../../../schema/src/studio/api-reference.ts'),
      'utf8',
    );
    expect(
      [...reference.matchAll(/member\(\s*'s\.([^']+)'/gu)].map((match) => match[1]).sort(),
    ).toEqual([...SCENE_MEMBERS].sort());
    dispose();
  });

  it('does not skip the next subscriber when one unsubscribes itself', () => {
    const { scene, tick, dispose } = sceneFixture();
    let unsubscribe = () => {
      /* replaced before the first tick */
    };
    unsubscribe = scene.fixedTick(() => {
      unsubscribe();
    });
    const second = vi.fn();
    scene.fixedTick(second);
    tick();
    expect(second).toHaveBeenCalledTimes(1);
    dispose();
  });

  it('pauses hidden simulation and clears held input', () => {
    const { scene, app, dispose } = sceneFixture();
    scene.input.set('KeyW', true);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(scene.input.down('KeyW')).toBe(false);
    expect(app.ticker.started).toBe(false);
    dispose();
  });

  it('renders manual chapter changes even with reduced motion and no running ticker', async () => {
    const { scene, app, dispose, renderSpy } = sceneFixture(true);
    await Promise.resolve();
    const story = scene.story([{ id: 'intro' }, { id: 'end' }]);
    renderSpy.mockClear();
    expect(story.next()).toBe(true);
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(app.ticker.started).toBe(false);
    dispose();
  });
  it('owns subscriptions, input and story lifecycle', () => {
    const { scene, tick, dispose, callbacks } = sceneFixture();
    const step = vi.fn();
    const leave = vi.fn();
    const unsubscribe = scene.fixedTick(step);
    const story = scene.story([{ id: 'intro', leave }, { id: 'end' }]);
    tick();
    expect(step).toHaveBeenCalledTimes(1);
    unsubscribe();
    tick();
    expect(step).toHaveBeenCalledTimes(1);
    scene.input.set('KeyA', true);
    dispose();
    expect(scene.input.down('KeyA')).toBe(false);
    expect(story.next()).toBe(false);
    expect(leave).toHaveBeenCalledTimes(1);
    expect(callbacks.size).toBe(0);
  });

  it.each([
    [true, false],
    [false, true],
  ])('does not simulate under reducedMotion=%s editor=%s', async (reduced, editor) => {
    const { scene, dispose, tick } = sceneFixture(reduced, editor);
    const fn = vi.fn();
    scene.fixedTick(fn);
    await Promise.resolve();
    tick();
    expect(fn).not.toHaveBeenCalled();
    const enter = vi.fn();
    scene.story([{ id: 'intro', enter }]);
    expect(enter).toHaveBeenCalledTimes(1);
    dispose();
  });
});
