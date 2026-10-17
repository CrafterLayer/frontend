import { describe, expect, it, vi } from 'vitest';

import { ensureCkEngines, type CkEngineContext, type CkEnginesHost } from './ck-engines';

const noop = (): void => {
  /* a test double with nothing to do */
};

const ctx: CkEngineContext = { still: false, rtl: false, lang: 'en', onPlay: noop, onStop: noop };

describe('ensureCkEngines (DESIGN §2.3, scene side)', () => {
  it('creates the handshake once and returns the same object afterwards', () => {
    const host: CkEnginesHost = {};
    const first = ensureCkEngines(host);

    expect(first.engines).toEqual({});
    expect(first.queue).toEqual([]);
    expect(typeof first.ready).toBe('function');
    expect(ensureCkEngines(host)).toBe(first);
    expect(host.ckEngines).toBe(first);
  });

  it('ready() registers the engine and mounts only the unmounted entries of its kind', () => {
    const host: CkEnginesHost = {};
    const api = ensureCkEngines(host);
    const scene = document.createElement('div');
    const timeline = document.createElement('div');
    const alreadyMounted = vi.fn();
    api.queue.push(
      { kind: 'scene', el: scene, ctx },
      { kind: 'timeline', el: timeline, ctx },
      { kind: 'scene', el: document.createElement('div'), ctx, dispose: alreadyMounted },
    );
    const dispose = vi.fn();
    const engine = { mount: vi.fn(() => dispose) };

    api.ready('scene', engine);

    expect(api.engines.scene).toBe(engine);
    expect(engine.mount).toHaveBeenCalledTimes(1);
    expect(engine.mount).toHaveBeenCalledWith(scene, ctx);
    expect(api.queue[0]?.dispose).toBe(dispose);
    expect(api.queue[1]?.dispose).toBeUndefined();
    expect(api.queue[2]?.dispose).toBe(alreadyMounted);
  });

  it('a throwing mount marks its entry handled and does not stop the others', () => {
    const api = ensureCkEngines({});
    const ok = document.createElement('div');
    api.queue.push(
      { kind: 'scene', el: document.createElement('div'), ctx },
      { kind: 'scene', el: ok, ctx },
    );
    const engine = {
      mount: vi.fn((el: HTMLElement) => {
        if (el !== ok) {
          throw new Error('boom');
        }
        return noop;
      }),
    };

    api.ready('scene', engine);

    expect(engine.mount).toHaveBeenCalledTimes(2);
    expect(api.queue.every((entry) => typeof entry.dispose === 'function')).toBe(true);
  });
});
