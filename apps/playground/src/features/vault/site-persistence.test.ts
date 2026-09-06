import { describe, expect, it } from 'vitest';

import {
  defaultDesignSystem,
  isBuilderError,
  LATEST_SCHEMA_VERSION,
  LATEST_SITE_VERSION,
  openSite,
  type BuilderSite,
  type SitePage,
  type Transaction,
} from '@craftkit/builder';
import { fixedClock, fixtureBlocks, seededIds } from '@craftkit/builder/testing';

import { createVaultSitePersistence, siteSessionKey } from './site-persistence';
import { createMemoryVaultStore, type VaultStore } from './store';

const SITE_ID = 'playground/site';

function page(id: string, address: string): SitePage {
  return {
    id,
    address,
    title: id,
    purpose: 'test',
    audience: 'test',
    document: {
      schemaVersion: LATEST_SCHEMA_VERSION,
      surface: 'site',
      dir: 'ltr',
      rootId: 'root',
      nodes: {
        root: { id: 'root', type: 'page', props: {}, slots: { default: ['p1'] } },
        p1: { id: 'p1', type: 'text', props: { content: 'seed' } },
      },
    },
    regions: [],
  };
}

function fixtureSite(): BuilderSite {
  return {
    siteVersion: LATEST_SITE_VERSION,
    dir: 'ltr',
    pages: [page('home', '/'), page('about', '/about')],
    sharedRegions: {},
    designSystem: defaultDesignSystem(),
    assets: {},
  };
}

function adapterOver(store: VaultStore) {
  return createVaultSitePersistence({ store, seed: () => fixtureSite() });
}

const opened = {
  extensions: [fixtureBlocks],
  ports: { clock: fixedClock(), ids: seededIds('s') },
};

describe('createVaultSitePersistence', () => {
  it('boots on the seed when nothing is stored, without writing anything', async () => {
    const store = createMemoryVaultStore();
    const adapter = adapterOver(store);

    const session = await adapter.load(SITE_ID);

    expect(session.seq).toBe(0);
    expect(session.tail).toEqual([]);
    // A read must not write: the first boot has not saved anything yet.
    expect(await store.get(siteSessionKey(SITE_ID))).toBeUndefined();
  });

  it('round-trips a site through a kernel and a fresh adapter', async () => {
    const store = createMemoryVaultStore();
    const kernel = await openSite(adapterOver(store), SITE_ID, opened);
    kernel.dispatch('addPage', { address: '/pricing', title: 'Pricing' });
    await kernel.flush();

    // A SECOND adapter over the same store: this is the check that catches a
    // kernel that saved into its own memory and called it persistence.
    const reopened = await openSite(adapterOver(store), SITE_ID, opened);

    expect(reopened.getSite().pages.map((p) => p.address)).toEqual(['/', '/about', '/pricing']);
  });

  it('rejects a stale position with persist/seq-conflict and writes nothing', async () => {
    const store = createMemoryVaultStore();
    const adapter = adapterOver(store);
    const tx: Transaction = {
      id: 't1',
      command: 'addPage',
      author: 'user',
      patches: [],
      inverse: [],
      ts: 0,
    };
    await adapter.append(SITE_ID, [tx], 0);
    const stored = await store.get(siteSessionKey(SITE_ID));

    let caught: unknown;
    try {
      await adapter.append(SITE_ID, [tx], 0);
    } catch (error) {
      caught = error;
    }

    expect(isBuilderError(caught)).toBe(true);
    expect(isBuilderError(caught) ? caught.code : '').toBe('persist/seq-conflict');
    // Byte-identical: nothing was written before the conflict check.
    expect(await store.get(siteSessionKey(SITE_ID))).toEqual(stored);
  });

  it('keeps serving after a conflict — a rejection must not poison the chain', async () => {
    const store = createMemoryVaultStore();
    const adapter = adapterOver(store);
    const tx = (id: string): Transaction => ({
      id,
      command: 'x',
      author: 'user',
      patches: [],
      inverse: [],
      ts: 0,
    });

    await adapter.append(SITE_ID, [tx('a')], 0);
    await expect(adapter.append(SITE_ID, [tx('b')], 0)).rejects.toThrow(/position 0/);

    // The next correctly-positioned append still works.
    await expect(adapter.append(SITE_ID, [tx('c')], 1)).resolves.toEqual({ seq: 2 });
  });

  it('compacts only AT the current position', async () => {
    const store = createMemoryVaultStore();
    const adapter = adapterOver(store);
    const tx: Transaction = {
      id: 't1',
      command: 'x',
      author: 'user',
      patches: [],
      inverse: [],
      ts: 0,
    };
    await adapter.append(SITE_ID, [tx], 0);

    // Wrong position: a no-op, exactly like the document adapter.
    await adapter.snapshot?.(SITE_ID, fixtureSite(), 99);
    expect((await adapter.load(SITE_ID)).tail).toHaveLength(1);

    await adapter.snapshot?.(SITE_ID, fixtureSite(), 1);
    const compacted = await adapter.load(SITE_ID);
    expect(compacted.tail).toEqual([]);
    expect(compacted.seq).toBe(1);
  });

  it('takeOverSite re-bases unconditionally, so a frozen-out session saves again', async () => {
    /*
      Two tabs. The second one appended, so the first can never append again —
      its position never moves, and a rejection is not an answer. `takeOverSite`
      is the answer: last-writer-wins, with one WHOLE valid site written, never
      a splice of both.
    */
    const store = createMemoryVaultStore();
    const first = await openSite(adapterOver(store), SITE_ID, opened);
    const second = await openSite(adapterOver(store), SITE_ID, opened);

    second.dispatch('addPage', { address: '/theirs', title: 'Theirs' });
    await second.flush();

    first.dispatch('addPage', { address: '/mine', title: 'Mine' });
    await expect(first.flush()).rejects.toThrow(/position 0/);

    const takeOver = adapterOver(store);
    await takeOver.takeOverSite(SITE_ID, first.getSite(), 0);

    const reopened = await openSite(adapterOver(store), SITE_ID, opened);
    const addresses = reopened.getSite().pages.map((p) => p.address);
    expect(addresses).toContain('/mine');
    expect(addresses).not.toContain('/theirs');
  });

  it('keeps a site and a document under different keys', async () => {
    /*
      A site and a document are different roots with different validators.
      Sharing a key space would let one be loaded as the other, and the failure
      would surface much later as a patch path that does not resolve.
    */
    const store = createMemoryVaultStore();
    await adapterOver(store).append(
      SITE_ID,
      [{ id: 't', command: 'x', author: 'user', patches: [], inverse: [], ts: 0 }],
      0,
    );

    expect(siteSessionKey(SITE_ID)).toBe(`vault/site/${SITE_ID}`);
    expect(await store.get(`vault/session/${SITE_ID}`)).toBeUndefined();
  });
});
