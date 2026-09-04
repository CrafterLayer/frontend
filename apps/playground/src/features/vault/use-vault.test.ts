import { StrictMode } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createMemoryVaultStore, type VaultStore } from './store';
import { useVaultKernel, type VaultKernelState } from './use-vault';

/*
  The key `persistence.ts` stores a session under. A test that wants a CORRUPT
  save has to write one the way the adapter would, and the adapter offers no
  door for that — so the shape is restated here, deliberately and once.
*/
/*
  The keys, restated here on purpose so a change to either shape shows up as a
  failing test rather than as a silent agreement.

  `siteSessionKey` is what the playground boots from now: the app opens a SITE
  and hands each surface the current page as an ordinary kernel. `sessionKey`
  is still meaningful — it is the pre-site document a first boot LIFTS its home
  page from, and the one "start over" must also drop or the lift would bring the
  discarded work straight back.
*/
const sessionKey = (docId: string): string => `vault/session/${docId}`;
const siteSessionKey = (siteId: string): string => `vault/site/${siteId}`;

/** The home page of a stored site, where a stored document's `doc` used to be. */
interface StoredSiteShape {
  site: { pages: { document: { nodes: Record<string, { props: { label: string } }> } }[] };
}

/** Counts reads of one key, so "opened exactly once" is an observation. */
function countingStore(inner: VaultStore = createMemoryVaultStore()): {
  store: VaultStore;
  reads: (key: string) => number;
} {
  const counts = new Map<string, number>();
  const store: VaultStore = {
    get(key) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return inner.get(key);
    },
    set: (key, value) => inner.set(key, value),
    remove: (key) => inner.remove(key),
    keys: (prefix) => inner.keys(prefix),
  };
  return { store, reads: (key) => counts.get(key) ?? 0 };
}

/** A store whose reads park until the test releases them. */
function gatedStore(): { store: VaultStore; release: () => void } {
  const inner = createMemoryVaultStore();
  let open: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    open = resolve;
  });
  const store: VaultStore = {
    async get<T>(key: string): Promise<T | undefined> {
      await gate;
      return inner.get<T>(key);
    },
    set: (key, value) => inner.set(key, value),
    remove: (key) => inner.remove(key),
    keys: (prefix) => inner.keys(prefix),
  };
  return { store, release: open };
}

/** A store whose FIRST read rejects, the way a transient IndexedDB blip does. */
function oneBadReadStore(inner: VaultStore): VaultStore {
  let spent = false;
  return {
    get<T>(key: string): Promise<T | undefined> {
      if (!spent) {
        spent = true;
        return Promise.reject(new Error('IndexedDB read failed (transient)'));
      }
      return inner.get<T>(key);
    },
    set: (key, value) => inner.set(key, value),
    remove: (key) => inner.remove(key),
    keys: (prefix) => inner.keys(prefix),
  };
}

/** A store that accepts nothing: the full disk, the private window, the quota. */
function refusingWriteStore(inner: VaultStore): VaultStore {
  return {
    get: (key) => inner.get(key),
    set: () => Promise.reject(new Error('quota exceeded')),
    remove: (key) => inner.remove(key),
    keys: (prefix) => inner.keys(prefix),
  };
}

/** A page the store already holds, valid and worth keeping. */
const preciousSession = {
  doc: {
    schemaVersion: 1,
    surface: 'site',
    dir: 'rtl',
    rootId: 'root',
    nodes: { root: { id: 'root', type: 'page', props: {} } },
  },
  seq: 0,
  tail: [],
};

function failedBoot(state: VaultKernelState): Extract<VaultKernelState, { status: 'failed' }> {
  if (state.status !== 'failed') {
    throw new Error(`expected a failed vault boot, got "${state.status}"`);
  }
  return state;
}

function ready(state: VaultKernelState): Extract<VaultKernelState, { status: 'ready' }> {
  if (state.status !== 'ready') {
    throw new Error(`expected a ready vault kernel, got "${state.status}"`);
  }
  return state;
}

describe('useVaultKernel', () => {
  it('shows a real loading state, then hands over a kernel on the fixture', async () => {
    const store = createMemoryVaultStore();
    const { result } = renderHook(() => useVaultKernel('landing', { store }));

    // The whole point of the async door: there IS a moment with no kernel, and
    // the app has to be able to say so instead of pretending it has one.
    expect(result.current.status).toBe('loading');

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    const state = ready(result.current);
    expect(state.restored).toBe(false);
    expect(state.kernel.getDocument().nodes['root']?.type).toBe('page');
    expect(state.kernel.validate()).toEqual([]);
  });

  it('reopens what the previous session stored, and says it was restored', async () => {
    const store = createMemoryVaultStore();
    const first = renderHook(() => useVaultKernel('landing', { store }));
    await waitFor(() => {
      expect(first.result.current.status).toBe('ready');
    });

    /*
      Through the SITE, not the page. Direction belongs to the site: a page that
      turned on its own would store a site the next boot refuses to open, and the
      site kernel refuses it at the door for exactly that reason.
    */
    act(() => {
      ready(first.result.current).siteKernel.dispatch('setSiteDirection', { dir: 'rtl' });
    });
    // The session flushes on its own; waiting for the STORE to hold the change
    // is what proves the autosave exists rather than the test doing its job.
    await waitFor(async () => {
      expect(await store.get(siteSessionKey('playground/landing'))).toBeDefined();
    });
    first.unmount();

    const second = renderHook(() => useVaultKernel('landing', { store }));
    await waitFor(() => {
      expect(second.result.current.status).toBe('ready');
    });
    const reopened = ready(second.result.current);
    expect(reopened.restored).toBe(true);
    expect(reopened.kernel.getDocument().dir).toBe('rtl');
  });

  it('keeps one document per fixture, so a saved landing page never hijacks another', async () => {
    const store = createMemoryVaultStore();
    const landing = renderHook(() => useVaultKernel('landing', { store }));
    await waitFor(() => {
      expect(landing.result.current.status).toBe('ready');
    });
    act(() => {
      ready(landing.result.current).siteKernel.dispatch('setSiteDirection', { dir: 'rtl' });
    });
    await waitFor(async () => {
      expect(await store.get(siteSessionKey('playground/landing'))).toBeDefined();
    });
    landing.unmount();

    const empty = renderHook(() => useVaultKernel('empty', { store }));
    await waitFor(() => {
      expect(empty.result.current.status).toBe('ready');
    });
    const state = ready(empty.result.current);
    expect(state.restored).toBe(false);
    expect(state.kernel.getDocument().dir).toBe('ltr');
    // The empty fixture is the root alone — the landing page's blocks must not
    // have leaked across the picker.
    expect(Object.keys(state.kernel.getDocument().nodes)).toHaveLength(1);
  });

  it('lands on failed with a readable reason when the save is corrupt, and startOver recovers', async () => {
    const store = createMemoryVaultStore();
    await store.set(siteSessionKey('playground/landing'), {
      // A site whose home page names a root that is not there: `openSite`
      // migrates and validates before a kernel exists, so this throws on the
      // load path rather than producing a half-open editor.
      site: {
        siteVersion: 1,
        dir: 'ltr',
        pages: [
          {
            id: 'home',
            address: '/',
            title: 'Home',
            purpose: '',
            audience: '',
            document: { schemaVersion: 1, surface: 'site', dir: 'ltr', rootId: 'gone', nodes: {} },
            regions: [],
          },
        ],
        sharedRegions: {},
        designSystem: { name: 'Broken', tokens: {}, typography: {}, pairings: [], seed: 'x' },
        assets: {},
      },
      seq: 0,
      tail: [],
    });

    const { result } = renderHook(() => useVaultKernel('landing', { store }));
    await waitFor(() => {
      expect(result.current.status).toBe('failed');
    });
    const failed = result.current;
    if (failed.status !== 'failed') {
      throw new Error('unreachable');
    }
    expect(failed.reason.length).toBeGreaterThan(0);

    act(() => {
      failed.startOver();
    });
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    const state = ready(result.current);
    expect(state.restored).toBe(false);
    expect(state.kernel.getDocument().nodes['root']?.type).toBe('page');
  });

  it('opens the document exactly once under StrictMode', async () => {
    const { store, reads } = countingStore();
    const { result } = renderHook(() => useVaultKernel('empty', { store }), {
      wrapper: StrictMode,
    });
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    const first = ready(result.current).kernel;

    // React's development double-invoke runs the boot effect, tears it down and
    // runs it again. Without the per-boot cache that is two `openDocument`
    // calls racing to install two kernels over the same stored document.
    expect(reads(siteSessionKey('playground/empty'))).toBe(1);
    expect(ready(result.current).kernel).toBe(first);
  });

  it('never installs a kernel when the component went away mid-open', async () => {
    const { store, release } = gatedStore();
    const { result, unmount } = renderHook(() => useVaultKernel('empty', { store }));
    expect(result.current.status).toBe('loading');

    unmount();
    release();
    await act(async () => {
      await Promise.resolve();
    });

    // `result.current` holds the LAST state the hook rendered. A kernel
    // installed after the unmount would have overwritten it.
    expect(result.current.status).toBe('loading');
  });
});

describe('useVaultKernel — a save that fails is a save a person is told about', () => {
  it('says so, out loud, while every write is being refused', async () => {
    const store = refusingWriteStore(createMemoryVaultStore());
    const { result } = renderHook(() => useVaultKernel('landing', { store }));
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    act(() => {
      ready(result.current).kernel.dispatch('setProp', {
        id: 'cta-start',
        key: 'label',
        value: 'Not saved',
      });
    });

    // The one thing the vault owes a person whose work is not being kept: the
    // fact that it is not being kept. A green screen over an empty store is the
    // failure, not the storage error.
    await waitFor(() => {
      expect(ready(result.current).save.status).toBe('error');
    });
    expect(ready(result.current).save.reason).toBeTruthy();
  });

  it('recovers when storage comes back: the state returns to saved and the page is stored', async () => {
    const inner = createMemoryVaultStore();
    let refuse = true;
    const store: VaultStore = {
      get: (key) => inner.get(key),
      set: (key, value) =>
        refuse ? Promise.reject(new Error('quota exceeded')) : inner.set(key, value),
      remove: (key) => inner.remove(key),
      keys: (prefix) => inner.keys(prefix),
    };
    const { result } = renderHook(() => useVaultKernel('landing', { store }));
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    act(() => {
      ready(result.current).kernel.dispatch('setProp', {
        id: 'cta-start',
        key: 'label',
        value: 'One',
      });
    });
    await waitFor(() => {
      expect(ready(result.current).save.status).toBe('error');
    });

    refuse = false;
    act(() => {
      ready(result.current).kernel.dispatch('setProp', {
        id: 'cta-start',
        key: 'label',
        value: 'Two',
      });
    });
    await waitFor(() => {
      expect(ready(result.current).save.status).toBe('saved');
    });
    const stored = await inner.get<StoredSiteShape>(siteSessionKey('playground/landing'));
    expect(stored?.site.pages[0]?.document.nodes['cta-start']?.props.label).toBe('Two');
  });
});

describe('useVaultKernel — two sessions over one store', () => {
  it('keeps the second session\u2019s work and says the page is open elsewhere', async () => {
    const store = createMemoryVaultStore();
    const tabA = renderHook(() => useVaultKernel('landing', { store }));
    const tabB = renderHook(() => useVaultKernel('landing', { store }));
    await waitFor(() => {
      expect(tabA.result.current.status).toBe('ready');
      expect(tabB.result.current.status).toBe('ready');
    });

    act(() => {
      ready(tabA.result.current).kernel.dispatch('setProp', {
        id: 'cta-start',
        key: 'label',
        value: 'A-WORK',
      });
    });
    const read = async (): Promise<string | undefined> => {
      const stored = await store.get<StoredSiteShape>(siteSessionKey('playground/landing'));
      return stored?.site.pages[0]?.document.nodes['cta-start']?.props.label;
    };
    await waitFor(async () => {
      expect(await read()).toBe('A-WORK');
    });

    // Tab B's kernel is now behind the store. Every edit it makes conflicts —
    // and used to be dropped, forever, with tab B still reading "ready".
    act(() => {
      ready(tabB.result.current).kernel.dispatch('setProp', {
        id: 'cta-start',
        key: 'label',
        value: 'B-WORK',
      });
    });
    await waitFor(async () => {
      expect(await read()).toBe('B-WORK');
    });
    expect(ready(tabB.result.current).save.shared).toBe(true);
    expect(ready(tabB.result.current).save.status).toBe('saved');
  });
});

describe('useVaultKernel — a boot that failed is not a page to delete', () => {
  it('offers a retry that reopens the SAME stored page after a transient read error', async () => {
    const inner = createMemoryVaultStore();
    /*
      Stored under the DOCUMENT key, deliberately: this is a person who was
      building a page before sites existed. The retry has to find their work,
      which now means LIFTING it into the home page rather than opening it
      directly — `restored` and the direction below are the same assertions
      either way, which is the point of the lift being byte for byte.
    */
    await inner.set(sessionKey('playground/landing'), preciousSession);
    const store = oneBadReadStore(inner);

    const { result } = renderHook(() => useVaultKernel('landing', { store }));
    await waitFor(() => {
      expect(result.current.status).toBe('failed');
    });

    act(() => {
      failedBoot(result.current).retry();
    });
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    const state = ready(result.current);
    expect(state.restored).toBe(true);
    expect(state.kernel.getDocument().dir).toBe('rtl');
    expect(await inner.get(sessionKey('playground/landing'))).toBeDefined();
  });

  it('starting over deletes THIS document only, never one whose id merely begins the same way', async () => {
    const store = createMemoryVaultStore();
    // A SITE key this time: `vault/site/playground/landing-v2` begins with
    // `vault/site/playground/landing`, so a prefix sweep would take it.
    const neighbour = siteSessionKey('playground/landing-v2');
    await store.set(neighbour, preciousSession);

    const { result } = renderHook(() => useVaultKernel('landing', { store }));
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    act(() => {
      ready(result.current).kernel.dispatch('setProp', {
        id: 'cta-start',
        key: 'label',
        value: 'Doomed',
      });
    });
    await waitFor(async () => {
      expect(await store.get(siteSessionKey('playground/landing'))).toBeDefined();
    });

    act(() => {
      ready(result.current).startOver();
    });
    await waitFor(async () => {
      expect(await store.get(siteSessionKey('playground/landing'))).toBeUndefined();
    });
    expect(await store.get(neighbour)).toBeDefined();
  });
});

describe('useVaultKernel — a boot has an identity', () => {
  it('names each boot, so a panel kept mounted across one cannot outlive its kernel', async () => {
    const store = createMemoryVaultStore();
    const { result } = renderHook(() => useVaultKernel('landing', { store }));
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    const first = ready(result.current);

    act(() => {
      first.startOver();
    });
    await waitFor(() => {
      expect(ready(result.current).kernel).not.toBe(first.kernel);
    });
    // Starting over installs a NEW kernel for the same fixture. Anything the
    // host keeps mounted across rail destinations — the assistant, with its
    // conversation, its draft and its run — has to be told, and a changed
    // identity is what a `key` is made of.
    expect(ready(result.current).bootId).not.toBe(first.bootId);
  });
});
