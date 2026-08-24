import type { ComponentType } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { isChunkLoadError, lazyWithRetry, loadWithRetry } from './lazy-with-retry';

function LazyFixture() {
  return <span>loaded</span>;
}

function createRuntime() {
  return {
    random: vi.fn(() => 0.5),
    reloadChunkOnce: vi.fn(() => true),
    sleep: vi.fn(async () => undefined),
    waitUntilOnline: vi.fn(async () => undefined),
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
    const importModule = vi.fn(async () => ({ default: LazyFixture }));

    await expect(loadWithRetry(importModule, { maxRetries: -1 }, runtime)).rejects.toThrow(
      /maxRetries/,
    );
    await expect(
      loadWithRetry(importModule, { baseDelayMs: Number.NaN }, runtime),
    ).rejects.toThrow(/baseDelayMs/);
    expect(importModule).not.toHaveBeenCalled();
  });
});

describe('lazyWithRetry', () => {
  it('deduplicates preload calls for the same module', async () => {
    const importModule = vi.fn(async () => ({ default: LazyFixture }));
    const component = lazyWithRetry(importModule, { maxRetries: 0 });

    await Promise.all([component.preload(), component.preload()]);

    expect(importModule).toHaveBeenCalledOnce();
  });
});

describe('isChunkLoadError', () => {
  it('recognizes deployment chunk failures only', () => {
    expect(isChunkLoadError(new Error('Failed to fetch dynamically imported module'))).toBe(true);
    expect(isChunkLoadError(Object.assign(new Error('chunk'), { name: 'ChunkLoadError' }))).toBe(
      true,
    );
    expect(isChunkLoadError(new Error('business error'))).toBe(false);
    expect(isChunkLoadError('failed to fetch')).toBe(false);
  });
});
