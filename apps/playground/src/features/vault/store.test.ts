import { afterEach, describe, expect, it, vi } from 'vitest';

import { createIndexedDbVaultStore, createMemoryVaultStore } from './store';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createMemoryVaultStore', () => {
  it('round-trips a value and hands back a CLONE, never the caller’s object', async () => {
    const store = createMemoryVaultStore();
    const written = { nested: { count: 1 } };

    await store.set('doc/a', written);
    written.nested.count = 99;
    const read = await store.get<{ nested: { count: number } }>('doc/a');

    expect(read).toEqual({ nested: { count: 1 } });
    expect(read).not.toBe(written);
  });

  it('reports undefined for an unknown key and after a remove', async () => {
    const store = createMemoryVaultStore();

    expect(await store.get('missing')).toBeUndefined();

    await store.set('doc/a', 1);
    await store.remove('doc/a');
    expect(await store.get('doc/a')).toBeUndefined();
  });

  it('lists only the keys under a prefix, sorted', async () => {
    const store = createMemoryVaultStore();
    await store.set('shelf/b', 1);
    await store.set('shelf/a', 1);
    await store.set('session/a', 1);

    expect(await store.keys('shelf/')).toEqual(['shelf/a', 'shelf/b']);
    expect(await store.keys('')).toEqual(['session/a', 'shelf/a', 'shelf/b']);
  });
});

describe('createIndexedDbVaultStore', () => {
  it('degrades to memory with ONE warning when IndexedDB is absent, instead of throwing', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const store = createIndexedDbVaultStore('craftkit-vault-test');

    await store.set('doc/a', { n: 1 });
    expect(await store.get('doc/a')).toEqual({ n: 1 });
    expect(await store.keys('doc/')).toEqual(['doc/a']);
    await store.remove('doc/a');
    expect(await store.get('doc/a')).toBeUndefined();

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('degrades to memory when the database refuses to open, instead of rejecting', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('indexedDB', {
      open: () => {
        const request: {
          error: DOMException | null;
          onerror: (() => void) | null;
          onsuccess: (() => void) | null;
          onupgradeneeded: (() => void) | null;
          onblocked: (() => void) | null;
        } = {
          error: null,
          onerror: null,
          onsuccess: null,
          onupgradeneeded: null,
          onblocked: null,
        };
        queueMicrotask(() => {
          request.onerror?.();
        });
        return request;
      },
    });

    const store = createIndexedDbVaultStore('craftkit-vault-test');

    await store.set('doc/a', { n: 2 });
    expect(await store.get('doc/a')).toEqual({ n: 2 });
    expect(await store.keys('')).toEqual(['doc/a']);

    expect(warn).toHaveBeenCalledTimes(1);
  });
});
