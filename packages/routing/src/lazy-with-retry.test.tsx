import type { ComponentType } from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  isChunkLoadError,
  lazyWithRetry,
  loadWithRetry,
  reloadChunkOnce,
  sleep,
  waitUntilOnline,
} from './lazy-with-retry';

function LazyFixture() {
  return <span>loaded</span>;
}

function createRuntime() {
  return {
    random: vi.fn(() => 0.5),
    reloadChunkOnce: vi.fn(() => true),
    sleep: vi.fn(() => Promise.resolve()),
    waitUntilOnline: vi.fn(() => Promise.resolve()),
  };
}

describe('loadWithRetry', () => {
  it('retries transient imports with exponential delays', async () => {
    const runtime = createRuntime();
    const importModule = vi
      .fn<() => Promise<{ default: ComponentType }>>()
      .mockRejectedValueOnce(new Error('temporary one'))
      .mockRejectedValueOnce(new Error('temporary two'))
      .mockResolvedValueOnce({ default: LazyFixture });

    const module = await loadWithRetry(importModule, { baseDelayMs: 10, maxRetries: 2 }, runtime);

    expect(module.default).toBe(LazyFixture);
    expect(runtime.sleep.mock.calls).toEqual([[10], [20]]);
    expect(runtime.waitUntilOnline).toHaveBeenCalledTimes(2);
    expect(runtime.reloadChunkOnce).not.toHaveBeenCalled();
  });

  it('requests one guarded reload only after chunk retries are exhausted', async () => {
    const runtime = createRuntime();
    const error = new Error('Failed to fetch dynamically imported module');
    const importModule = vi.fn(() => Promise.reject(error));

    await expect(
      loadWithRetry(importModule, { baseDelayMs: 0, maxRetries: 1 }, runtime),
    ).rejects.toBe(error);

    expect(importModule).toHaveBeenCalledTimes(2);
    expect(runtime.reloadChunkOnce).toHaveBeenCalledOnce();
  });

  it('does not reload for a non-chunk failure', async () => {
    const runtime = createRuntime();
    const error = new Error('module initialization failed');

    await expect(
      loadWithRetry(() => Promise.reject(error), { maxRetries: 0 }, runtime),
    ).rejects.toBe(error);

    expect(runtime.reloadChunkOnce).not.toHaveBeenCalled();
  });

  it('validates retry options before importing', async () => {
    const runtime = createRuntime();
    const importModule = vi.fn(() => Promise.resolve({ default: LazyFixture }));

    await expect(loadWithRetry(importModule, { maxRetries: -1 }, runtime)).rejects.toThrow(
      /maxRetries/,
    );
    await expect(loadWithRetry(importModule, { baseDelayMs: Number.NaN }, runtime)).rejects.toThrow(
      /baseDelayMs/,
    );
    expect(importModule).not.toHaveBeenCalled();
  });

  it('supports a named-export resolver and rejects a module without a component', async () => {
    const runtime = createRuntime();

    const resolved = await loadWithRetry(
      () => Promise.resolve({ Fixture: LazyFixture }),
      { maxRetries: 0, resolveComponent: (module) => module.Fixture },
      runtime,
    );

    expect(resolved.default).toBe(LazyFixture);
    await expect(
      loadWithRetry(() => Promise.resolve({}), { maxRetries: 0 }, runtime),
    ).rejects.toThrow(/default component/);
  });
});

describe('lazyWithRetry', () => {
  it('deduplicates preload calls for the same module', async () => {
    const importModule = vi.fn(() => Promise.resolve({ default: LazyFixture }));
    const component = lazyWithRetry(importModule, { maxRetries: 0 });

    await Promise.all([component.preload(), component.preload()]);

    expect(importModule).toHaveBeenCalledOnce();
  });

  it('clears a rejected preload so a later intent can retry', async () => {
    const error = new Error('module initialization failed');
    const importModule = vi
      .fn<() => Promise<{ default: ComponentType }>>()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce({ default: LazyFixture });
    const component = lazyWithRetry(importModule, { maxRetries: 0 });

    await expect(component.preload()).rejects.toBe(error);
    await component.preload();

    expect(importModule).toHaveBeenCalledTimes(2);
  });
});

describe('isChunkLoadError', () => {
  it('recognizes deployment chunk failures only', () => {
    expect(isChunkLoadError(new Error('Failed to fetch dynamically imported module'))).toBe(true);
    expect(isChunkLoadError(new Error('Loading CSS chunk 42 failed'))).toBe(true);
    expect(isChunkLoadError(Object.assign(new Error('chunk'), { name: 'ChunkLoadError' }))).toBe(
      true,
    );
    expect(isChunkLoadError(new Error('business error'))).toBe(false);
    expect(isChunkLoadError('failed to fetch')).toBe(false);
  });
});

describe('browser lazy-import runtime', () => {
  it('sleeps for the requested delay', async () => {
    vi.useFakeTimers();
    const pending = sleep(25);

    await vi.advanceTimersByTimeAsync(25);
    await pending;
    vi.useRealTimers();
  });

  it('waits for the browser to come back online', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    const pending = waitUntilOnline();

    window.dispatchEvent(new Event('online'));
    await pending;

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    await expect(waitUntilOnline()).resolves.toBeUndefined();
  });

  it('guards reloads with a timestamp and survives unavailable storage', () => {
    const getItem = vi.fn<() => string | null>(() => null);
    const setItem = vi.fn();
    const reload = vi.fn();
    const environment = {
      now: () => 20_000,
      reload,
      storage: { getItem, setItem },
    };

    expect(reloadChunkOnce(new Error('chunk'), environment)).toBe(true);
    expect(setItem).toHaveBeenCalledWith('__craftkit_lazy_reload_timestamp', '20000');
    expect(reload).toHaveBeenCalledOnce();

    getItem.mockReturnValue('15000');
    expect(reloadChunkOnce(new Error('chunk'), environment)).toBe(false);

    getItem.mockImplementation(() => {
      throw new Error('storage disabled');
    });
    expect(reloadChunkOnce(new Error('chunk'), environment)).toBe(false);
  });

  it('uses browser session storage for the default reload guard', () => {
    window.sessionStorage.setItem('__craftkit_lazy_reload_timestamp', String(Date.now()));

    expect(reloadChunkOnce(new Error('chunk'))).toBe(false);

    window.sessionStorage.removeItem('__craftkit_lazy_reload_timestamp');
  });
});
