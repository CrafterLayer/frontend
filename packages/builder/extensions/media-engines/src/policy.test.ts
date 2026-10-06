import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CkEngineContext } from './ck-engines';
import {
  DENSITY_CAPS,
  DPR_CAP,
  attachPlaybackPolicy,
  densityCount,
  isConstrainedDevice,
  prefersReducedMotion,
  readDensity,
  rtlSign,
  sceneResolution,
  watchContextLoss,
  type PolicyWindow,
} from './policy';

/** A controllable IntersectionObserver: `fire(true|false)` reports the element in or out of view. */
function fakeIntersectionObserver() {
  const instances: {
    callback: IntersectionObserverCallback;
    disconnect: ReturnType<typeof vi.fn>;
  }[] = [];
  class FakeIO {
    readonly disconnect = vi.fn();
    readonly callback: IntersectionObserverCallback;
    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback;
      instances.push(this);
    }
    observe() {
      /* fired manually */
    }
    unobserve() {
      /* fired manually */
    }
    takeRecords() {
      return [];
    }
  }
  return {
    Impl: FakeIO as unknown as typeof IntersectionObserver,
    instances,
    fire(isIntersecting: boolean) {
      for (const instance of instances) {
        instance.callback(
          [{ isIntersecting } as IntersectionObserverEntry],
          instance as unknown as IntersectionObserver,
        );
      }
    },
  };
}

function fakeContext(still: boolean, rtl = false) {
  const play: (() => void)[] = [];
  const stop: (() => void)[] = [];
  const ctx: CkEngineContext = {
    still,
    rtl,
    lang: rtl ? 'ar' : 'en',
    onPlay: (cb) => play.push(cb),
    onStop: (cb) => stop.push(cb),
  };
  return {
    ctx,
    play: () => {
      play.forEach((cb) => {
        cb();
      });
    },
    stop: () => {
      stop.forEach((cb) => {
        cb();
      });
    },
  };
}

function fakeTicker() {
  return { start: vi.fn(), stop: vi.fn() };
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

afterEach(() => {
  setHidden(false);
  document.body.replaceChildren();
});

describe('attachPlaybackPolicy', () => {
  it('runs a live scene, pauses it off-screen and resumes it in view', () => {
    const io = fakeIntersectionObserver();
    const ticker = fakeTicker();
    const renderOnce = vi.fn();
    const el = document.createElement('div');
    const policy = attachPlaybackPolicy({
      el,
      ctx: fakeContext(false).ctx,
      ticker,
      renderOnce,
      IntersectionObserverImpl: io.Impl,
    });

    expect(renderOnce).toHaveBeenCalledTimes(1);
    expect(policy.running).toBe(true);
    expect(ticker.start).toHaveBeenCalledTimes(1);

    io.fire(false);
    expect(policy.running).toBe(false);
    expect(ticker.stop).toHaveBeenCalledTimes(2); // the initial freeze + the pause

    io.fire(true);
    expect(policy.running).toBe(true);
    expect(ticker.start).toHaveBeenCalledTimes(2);

    policy.dispose();
    expect(io.instances[0]?.disconnect).toHaveBeenCalled();
    expect(policy.running).toBe(false);
  });

  it('pauses on a hidden tab and resumes when the tab returns', () => {
    const ticker = fakeTicker();
    const policy = attachPlaybackPolicy({
      el: document.createElement('div'),
      ctx: fakeContext(false).ctx,
      ticker,
      renderOnce: vi.fn(),
      IntersectionObserverImpl: undefined,
    });
    expect(policy.running).toBe(true);

    setHidden(true);
    expect(policy.running).toBe(false);

    setHidden(false);
    expect(policy.running).toBe(true);

    policy.dispose();
    setHidden(true);
    setHidden(false);
    expect(ticker.start).toHaveBeenCalledTimes(2);
  });

  it('on the still editor canvas renders exactly one frame and never starts the ticker until Preview', () => {
    const io = fakeIntersectionObserver();
    const ticker = fakeTicker();
    const renderOnce = vi.fn();
    const { ctx, play, stop } = fakeContext(true);
    const policy = attachPlaybackPolicy({
      el: document.createElement('div'),
      ctx,
      ticker,
      renderOnce,
      IntersectionObserverImpl: io.Impl,
    });

    expect(renderOnce).toHaveBeenCalledTimes(1);
    expect(ticker.start).not.toHaveBeenCalled();
    expect(policy.running).toBe(false);

    io.fire(true);
    expect(ticker.start).not.toHaveBeenCalled();

    play();
    expect(policy.running).toBe(true);
    expect(ticker.start).toHaveBeenCalledTimes(1);

    stop();
    expect(policy.running).toBe(false);
    expect(renderOnce).toHaveBeenCalledTimes(1);

    policy.dispose();
    play();
    expect(ticker.start).toHaveBeenCalledTimes(1);
  });
});

describe('device policy', () => {
  it('caps the resolution at DPR 2 and never goes below 1', () => {
    expect(DPR_CAP).toBe(2);
    expect(sceneResolution({ devicePixelRatio: 3 })).toBe(2);
    expect(sceneResolution({ devicePixelRatio: 1.5 })).toBe(1.5);
    expect(sceneResolution({ devicePixelRatio: 0.5 })).toBe(1);
    expect(sceneResolution({})).toBe(1);
  });

  it('flips horizontal velocity under RTL', () => {
    expect(rtlSign({ rtl: false })).toBe(1);
    expect(rtlSign({ rtl: true })).toBe(-1);
    expect(4 * rtlSign({ rtl: true })).toBe(-4);
  });

  it('reads prefers-reduced-motion and survives a missing matchMedia', () => {
    const reduce: PolicyWindow = { matchMedia: (q) => ({ matches: q.includes('reduce') }) };
    expect(prefersReducedMotion(reduce)).toBe(true);
    expect(prefersReducedMotion({})).toBe(false);
    expect(
      prefersReducedMotion({
        matchMedia: () => {
          throw new Error('no media');
        },
      }),
    ).toBe(false);
  });
});

describe('density', () => {
  const strong: PolicyWindow = {
    navigator: { hardwareConcurrency: 8 },
    matchMedia: () => ({ matches: false }),
  };

  it('maps the closed vocabulary to capped counts, defaulting to medium', () => {
    const el = document.createElement('div');
    expect(readDensity(el)).toBe('medium');
    el.setAttribute('data-ck-density', 'high');
    expect(readDensity(el)).toBe('high');
    el.setAttribute('data-ck-density', 'ultra');
    expect(readDensity(el)).toBe('medium');

    expect(densityCount('low', strong)).toBe(DENSITY_CAPS.low);
    expect(densityCount('medium', strong)).toBe(DENSITY_CAPS.medium);
    expect(densityCount('high', strong)).toBe(DENSITY_CAPS.high);
    expect(DENSITY_CAPS.low).toBeLessThan(DENSITY_CAPS.medium);
    expect(DENSITY_CAPS.high).toBeLessThanOrEqual(120);
  });

  it('halves every count on a coarse pointer or four cores or fewer', () => {
    const coarse: PolicyWindow = {
      navigator: { hardwareConcurrency: 8 },
      matchMedia: (q) => ({ matches: q === '(pointer: coarse)' }),
    };
    const fewCores: PolicyWindow = {
      navigator: { hardwareConcurrency: 4 },
      matchMedia: () => ({ matches: false }),
    };

    expect(isConstrainedDevice(strong)).toBe(false);
    expect(isConstrainedDevice(coarse)).toBe(true);
    expect(isConstrainedDevice(fewCores)).toBe(true);
    expect(densityCount('high', coarse)).toBe(DENSITY_CAPS.high / 2);
    expect(densityCount('medium', fewCores)).toBe(DENSITY_CAPS.medium / 2);
  });
});

describe('watchContextLoss', () => {
  it('tears the scene down once when the WebGL context is lost', () => {
    const canvas = document.createElement('canvas');
    const onLost = vi.fn();
    const stopWatching = watchContextLoss(canvas, onLost);

    canvas.dispatchEvent(new Event('webglcontextlost'));
    canvas.dispatchEvent(new Event('webglcontextlost'));
    expect(onLost).toHaveBeenCalledTimes(1);

    stopWatching();
  });
});
