import { describe, expect, it, vi } from 'vitest';

import {
  type CkEngineContext,
  type CkEngineQueueEntry,
  type CkEnginesHost,
  ckEnginesShimOf,
  ensureCkEngines,
} from './ck-engines-shim';
import { installLottieEngine } from './lottie-runner';
import { installTimelineEngine } from './timeline-runner';

function context(): CkEngineContext {
  return { still: false, rtl: false, lang: 'en', onPlay: () => undefined, onStop: () => undefined };
}

describe('ensureCkEngines', () => {
  it('creates the structure once and returns the same one after', () => {
    const win: CkEnginesHost = {};
    const first = ensureCkEngines(win);
    expect(first.engines).toEqual({});
    expect(first.queue).toEqual([]);
    expect(win.ckEngines).toBe(first);
    expect(ensureCkEngines(win)).toBe(first);
  });

  it('ready() registers, mounts the queued entries of its kind, keeps the others', () => {
    const win: CkEnginesHost = {};
    const api = ensureCkEngines(win);
    const a = document.createElement('div');
    const b = document.createElement('div');
    const detached = document.createElement('div');
    document.body.append(a, b);
    const ctx = context();
    api.queue.push(
      { kind: 'timeline', el: a, ctx },
      { kind: 'scene', el: b, ctx },
      { kind: 'timeline', el: detached, ctx },
    );
    const disposeA = vi.fn();
    const mount = vi.fn(() => disposeA);
    api.ready('timeline', { mount });

    expect(api.engines.timeline).toEqual({ mount });
    expect(mount).toHaveBeenCalledTimes(1);
    expect(mount).toHaveBeenCalledWith(a, ctx);
    expect(api.queue.map((entry) => entry.kind)).toEqual(['scene']);
    a.remove();
    b.remove();
  });

  it('stores each disposer on its entry, and a throwing mount does not stop the rest', () => {
    const api = ensureCkEngines({});
    const ok = document.createElement('div');
    const bad = document.createElement('div');
    document.body.append(bad, ok);
    const first: CkEngineQueueEntry = { kind: 'lottie', el: bad, ctx: context() };
    const second: CkEngineQueueEntry = { kind: 'lottie', el: ok, ctx: context() };
    api.queue.push(first, second);
    const dispose = vi.fn();
    api.ready('lottie', {
      mount: (el) => {
        if (el === bad) throw new Error('boom');
        return dispose;
      },
    });
    expect(typeof first.dispose).toBe('function');
    expect(second.dispose).toBe(dispose);
    bad.remove();
    ok.remove();
  });
});

describe('ckEnginesShimOf (parity between the inline copies)', () => {
  const reference = ckEnginesShimOf(ensureCkEngines.toString());

  it('extracts the declaration from the reference', () => {
    expect(reference).not.toBeNull();
    expect(reference?.startsWith('functionensureCkEngines(')).toBe(true);
    expect(reference?.endsWith('}')).toBe(true);
  });

  it('the timeline runner embeds an identical copy', () => {
    expect(ckEnginesShimOf(installTimelineEngine.toString())).toBe(reference);
  });

  it('the lottie runner embeds an identical copy', () => {
    expect(ckEnginesShimOf(installLottieEngine.toString())).toBe(reference);
  });

  it('reports a missing copy as null', () => {
    expect(ckEnginesShimOf('function other() {}')).toBeNull();
  });
});
