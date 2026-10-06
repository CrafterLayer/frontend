import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  type CkEngine,
  type CkEngineContext,
  type CkEngineQueueEntry,
  ensureCkEngines,
} from './ck-engines-shim';
import {
  installLottieEngine,
  type LottieAnimationLike,
  type LottieLike,
  type LottieWindow,
} from './lottie-runner';

function nth<T>(list: readonly T[], index = 0): T {
  const value = list[index];
  if (value === undefined) throw new Error(`no item ${String(index)}`);
  return value;
}

class FakeAnimation implements LottieAnimationLike {
  calls: string[] = [];
  frames: number[] = [];
  listeners = new Map<string, () => void>();
  constructor(public params: Parameters<LottieLike['loadAnimation']>[0]) {}
  play(): void {
    this.calls.push('play');
  }
  pause(): void {
    this.calls.push('pause');
  }
  goToAndStop(value: number): void {
    this.frames.push(value);
  }
  addEventListener(name: string, cb: () => void): void {
    this.listeners.set(name, cb);
  }
  destroy(): void {
    this.calls.push('destroy');
  }
  emit(name: string): void {
    this.listeners.get(name)?.();
  }
}

function fakeWindow(): { win: LottieWindow & { lottie: LottieLike }; made: FakeAnimation[] } {
  const made: FakeAnimation[] = [];
  const lottie: LottieLike = {
    loadAnimation: (params) => {
      const animation = new FakeAnimation(params);
      made.push(animation);
      return animation;
    },
  };
  return { win: { lottie }, made };
}

function ctx(still: boolean): CkEngineContext & { play: () => void; stop: () => void } {
  let onPlay = (): void => undefined;
  let onStop = (): void => undefined;
  return {
    still,
    rtl: false,
    lang: 'ar',
    onPlay: (cb) => {
      onPlay = cb;
    },
    onStop: (cb) => {
      onStop = cb;
    },
    play: () => {
      onPlay();
    },
    stop: () => {
      onStop();
    },
  };
}

function lottieElement(src = 'https://assets.example.com/wave.json'): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-ck-lottie', '');
  el.setAttribute('data-ck-src', src);
  el.innerHTML = '<img alt="موجة" src="https://images.example.com/poster.jpg">';
  document.body.appendChild(el);
  return el;
}

function engineOf(win: LottieWindow): CkEngine {
  installLottieEngine(win);
  const engine = win.ckEngines?.engines.lottie;
  if (!engine) throw new Error('lottie engine not registered');
  return engine;
}

const restore: (() => void)[] = [];

afterEach(() => {
  for (const undo of restore.splice(0)) undo();
  document.body.innerHTML = '';
});

describe('installLottieEngine', () => {
  it('ready() drains the queued lottie entries and leaves the others', () => {
    const { win, made } = fakeWindow();
    const api = ensureCkEngines(win);
    const entry: CkEngineQueueEntry = { kind: 'lottie', el: lottieElement(), ctx: ctx(false) };
    api.queue.push(entry, { kind: 'timeline', el: lottieElement(), ctx: ctx(false) });
    installLottieEngine(win);
    expect(typeof entry.dispose).toBe('function');
    expect(made).toHaveLength(1);
    expect(api.queue.map((queued) => queued.kind)).toEqual(['timeline']);
  });

  it('loads data-ck-src into an aria-hidden SVG layer, not autoplaying, looping', () => {
    const { win, made } = fakeWindow();
    const el = lottieElement();
    engineOf(win).mount(el, ctx(false));
    const animation = nth(made);
    expect(animation.params).toMatchObject({
      renderer: 'svg',
      loop: true,
      autoplay: false,
      path: 'https://assets.example.com/wave.json',
    });
    const layer = el.querySelector('[data-ck-lottie-layer]');
    expect(animation.params.container).toBe(layer);
    expect(layer?.getAttribute('aria-hidden')).toBe('true');
    // The poster stays until something is drawn.
    expect(el.hasAttribute('data-ck-ready')).toBe(false);
    expect(el.querySelector('img')).not.toBeNull();
  });

  it('marks data-ck-ready on the first DOMLoaded, at frame 0', () => {
    const { win, made } = fakeWindow();
    const el = lottieElement();
    engineOf(win).mount(el, ctx(false));
    nth(made).emit('DOMLoaded');
    expect(el.hasAttribute('data-ck-ready')).toBe(true);
    expect(nth(made).frames).toEqual([0]);
  });

  it('plays in view, pauses off-screen and when the tab is hidden', () => {
    const seen: { cb: ((entries: { isIntersecting: boolean }[]) => void) | null } = { cb: null };
    const disconnect = vi.fn();
    // The runner reads the element's own window (document.defaultView), which jsdom gives no
    // IntersectionObserver; put a fake there.
    const view = document.defaultView as unknown as { IntersectionObserver?: unknown };
    const original = view.IntersectionObserver;
    view.IntersectionObserver = class {
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        seen.cb = cb;
      }
      observe(): void {
        /* the test drives the callback */
      }
      disconnect = disconnect;
    };
    restore.push(() => {
      view.IntersectionObserver = original;
    });
    const { win, made } = fakeWindow();
    const dispose = engineOf(win).mount(lottieElement(), ctx(false));
    const animation = nth(made);
    animation.emit('DOMLoaded');
    expect(animation.calls).toEqual(['pause']);
    seen.cb?.([{ isIntersecting: true }]);
    expect(animation.calls.at(-1)).toBe('play');
    seen.cb?.([{ isIntersecting: false }]);
    expect(animation.calls.at(-1)).toBe('pause');

    seen.cb?.([{ isIntersecting: true }]);
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(animation.calls.at(-1)).toBe('pause');
    visibility.mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(animation.calls.at(-1)).toBe('play');
    visibility.mockRestore();

    dispose();
    expect(disconnect).toHaveBeenCalled();
  });

  it('still (canvas): frame 0 and no play until Preview; stop returns to frame 0', () => {
    const { win, made } = fakeWindow();
    const c = ctx(true);
    engineOf(win).mount(lottieElement(), c);
    const animation = nth(made);
    animation.emit('DOMLoaded');
    expect(animation.frames).toEqual([0]);
    expect(animation.calls).not.toContain('play');
    c.play();
    expect(animation.calls.at(-1)).toBe('play');
    c.stop();
    expect(animation.frames).toEqual([0, 0]);
  });

  it('dispose destroys the animation and removes the layer and data-ck-ready', () => {
    const { win, made } = fakeWindow();
    const el = lottieElement();
    const dispose = engineOf(win).mount(el, ctx(false));
    nth(made).emit('DOMLoaded');
    dispose();
    expect(nth(made).calls).toContain('destroy');
    expect(el.querySelector('[data-ck-lottie-layer]')).toBeNull();
    expect(el.hasAttribute('data-ck-ready')).toBe(false);
    expect(el.querySelector('img')).not.toBeNull();
  });

  it('mounts nothing without a source', () => {
    const { win, made } = fakeWindow();
    const el = lottieElement('');
    engineOf(win).mount(el, ctx(false));
    expect(made).toHaveLength(0);
    expect(el.children).toHaveLength(1);
  });
});

describe('serialised runner', () => {
  it('evaluates alone in a fresh document and mounts there', () => {
    const frame = document.createElement('iframe');
    document.body.appendChild(frame);
    const frameWindow = frame.contentWindow as unknown as Window & LottieWindow;
    const { win, made } = fakeWindow();
    frameWindow.lottie = win.lottie;
    const script = `(${installLottieEngine.toString()})(window);`;
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- evaluating the serialised runner IS the test
    new Function('window', script)(frameWindow);
    const engine = frameWindow.ckEngines?.engines.lottie;
    expect(engine).toBeDefined();
    const doc = frame.contentDocument!;
    const el = doc.createElement('div');
    el.setAttribute('data-ck-src', 'https://assets.example.com/a.json');
    doc.body.appendChild(el);
    engine?.mount(el, ctx(false));
    expect(made).toHaveLength(1);
    expect(nth(made).params.container.ownerDocument).toBe(doc);
    frame.remove();
  });
});
