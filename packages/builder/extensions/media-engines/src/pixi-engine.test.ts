import { describe, expect, it, vi } from 'vitest';

import { ensureCkEngines, type CkEngineContext, type CkEnginesHost } from './ck-engines';
import { createPixiEngine, installPixiEngine } from './pixi-engine';

const noop = (): void => {
  /* a test double with nothing to do */
};

function ctx(provide?: (namespace: unknown) => void): CkEngineContext {
  return {
    still: false,
    rtl: false,
    lang: 'en',
    onPlay: noop,
    onStop: noop,
    ...(provide === undefined ? {} : { provide }),
  };
}

const NAMESPACE = { Application: Map, Graphics: Set };

describe('the full pixi.js engine (free-code mode, 2026-10-09)', () => {
  it('mount() hands the namespace to whoever queued the entry, and returns a disposer', () => {
    const provide = vi.fn();
    const dispose = createPixiEngine(NAMESPACE).mount(document.createElement('div'), ctx(provide));

    expect(provide).toHaveBeenCalledExactlyOnceWith(NAMESPACE);
    expect(typeof dispose).toBe('function');
    expect(() => {
      dispose();
    }).not.toThrow();
  });

  it('mount() tolerates a context with no receiver', () => {
    expect(() =>
      createPixiEngine(NAMESPACE).mount(document.createElement('div'), ctx()),
    ).not.toThrow();
  });

  it('install registers the engine and delivers to every region script already waiting', () => {
    const host: CkEnginesHost = {};
    const api = ensureCkEngines(host);
    const first = vi.fn();
    const second = vi.fn();
    const scene = vi.fn();
    const el = (): HTMLElement => {
      const node = document.createElement('div');
      document.body.appendChild(node);
      return node;
    };
    api.queue.push(
      { kind: 'pixi', el: el(), ctx: ctx(first) },
      { kind: 'scene', el: el(), ctx: ctx(scene) },
      { kind: 'pixi', el: el(), ctx: ctx(second) },
    );

    const engine = installPixiEngine(host, NAMESPACE);

    expect(api.engines.pixi).toBe(engine);
    expect(first).toHaveBeenCalledExactlyOnceWith(NAMESPACE);
    expect(second).toHaveBeenCalledExactlyOnceWith(NAMESPACE);
    expect(scene).not.toHaveBeenCalled();
    document.body.innerHTML = '';
  });

  it('install first, ask later: a script that arrives after the bundle gets it at once', () => {
    const host: CkEnginesHost = {};
    installPixiEngine(host, NAMESPACE);
    const provide = vi.fn();

    ensureCkEngines(host).engines.pixi?.mount(document.createElement('div'), ctx(provide));

    expect(provide).toHaveBeenCalledExactlyOnceWith(NAMESPACE);
  });

  it('writes no global: the only way to the library is ck.pixi()', () => {
    const host: CkEnginesHost = {};
    installPixiEngine(host, NAMESPACE);
    expect(Object.keys(host)).toEqual(['ckEngines']);
  });
});
