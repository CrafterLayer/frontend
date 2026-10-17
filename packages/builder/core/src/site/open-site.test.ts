import { describe, expect, it, vi } from 'vitest';

import {
  BuilderError,
  defaultDesignSystem,
  LATEST_SITE_VERSION,
  type BuilderSite,
  type PersistedSession,
  type PersistedSiteSession,
  type SitePage,
  type SitePersistenceAdapter,
  type Transaction,
} from '@craftkit/builder-schema';

import { createBuilder } from '../kernel/create-builder';
import { fixedClock, seededIds } from '../testing/fixed-ports';
import { fixtureBlocks, landingFixture } from '../testing/fixtures';
import { createSiteBuilder } from './create-site-builder';
import { liftDocumentSession, openSite } from './open-site';

/** An in-memory adapter with the real optimistic-concurrency contract. */
function memoryAdapter(initial: PersistedSiteSession): SitePersistenceAdapter & {
  readonly appends: number;
  readonly stored: PersistedSiteSession;
} {
  let stored: PersistedSiteSession = initial;
  let appends = 0;
  return {
    get appends() {
      return appends;
    },
    get stored() {
      return stored;
    },
    load: () => Promise.resolve(stored),
    append: (_siteId, txs, expectedSeq) => {
      if (expectedSeq !== stored.seq) {
        return Promise.reject(
          new BuilderError({
            code: 'persist/seq-conflict',
            message: `Expected seq ${String(expectedSeq)} but the store is at ${String(stored.seq)}.`,
          }),
        );
      }
      appends += 1;
      stored = { ...stored, seq: stored.seq + txs.length, tail: [...stored.tail, ...txs] };
      return Promise.resolve({ seq: stored.seq });
    },
  };
}

function page(id: string, address: string): SitePage {
  return {
    id,
    address,
    title: id,
    purpose: 'test',
    audience: 'test',
    document: landingFixture(),
    regions: [],
  };
}

function site(overrides: Partial<BuilderSite> = {}): BuilderSite {
  return {
    siteVersion: LATEST_SITE_VERSION,
    dir: 'ltr',
    pages: [page('home', '/'), page('about', '/about')],
    sharedRegions: {},
    designSystem: defaultDesignSystem(),
    assets: {},
    ...overrides,
  };
}

const opened = {
  extensions: [fixtureBlocks],
  ports: { clock: fixedClock(), ids: seededIds('s') },
};

describe('openSite', () => {
  it('replays the stored tail onto the snapshot before handing over', async () => {
    /*
      The snapshot is older than what the person last saw. A load that skipped
      the tail would silently show them an earlier version of their own site.
    */
    const base = site();
    const seed = createSiteBuilder({ site: base, ...opened });
    seed.dispatch('setProp', { id: 'p1', key: 'content', value: 'after the snapshot' });
    const tail = [...seed.transactions()];

    const adapter = memoryAdapter({ site: base, seq: tail.length, tail });
    const kernel = await openSite(adapter, 'site-1', opened);

    expect(kernel.page('home').getDocument().nodes['p1']?.props['content']).toBe(
      'after the snapshot',
    );
  });

  it('refuses a stored SNAPSHOT the migration rejects — no half-open kernel', async () => {
    const adapter = memoryAdapter({
      site: site({ pages: [page('about', '/about')] }),
      seq: 0,
      tail: [],
    });

    // `migrateSite` validates as its last step, so an invalid snapshot never
    // reaches the replay. The message names migration, which is where it failed.
    await expect(openSite(adapter, 'site-1', opened)).rejects.toThrow(
      /Migrated site is invalid: missing-home-page/,
    );
  });

  it('refuses a stored TAIL that replays into an invalid site', async () => {
    /*
      The reachable half of the load-path check, and the reason `openSite`
      validates AFTER the replay rather than trusting the migration. No live
      command can produce this — `renamePage` refuses to move the home page —
      so the transaction below is hand-written, exactly as a tail recorded by a
      version that did not yet have that refusal would look.
    */
    const base = site();
    const rogue: Transaction = {
      id: 'rogue',
      command: 'renamePage',
      author: 'user',
      patches: [{ op: 'replace', path: ['pages', 0, 'address'], value: '/start' }],
      inverse: [{ op: 'replace', path: ['pages', 0, 'address'], value: '/' }],
      ts: 0,
    };
    const adapter = memoryAdapter({ site: base, seq: 1, tail: [rogue] });

    await expect(openSite(adapter, 'site-1', opened)).rejects.toThrow(
      /Stored site "site-1" cannot be opened.*home page/,
    );
  });

  it('resumes at the stored position, so the first append is not a conflict', async () => {
    const base = site();
    const seed = createSiteBuilder({ site: base, ...opened });
    seed.dispatch('setProp', { id: 'p1', key: 'content', value: 'one' });
    const tail = [...seed.transactions()];
    const adapter = memoryAdapter({ site: base, seq: 7, tail });

    const kernel = await openSite(adapter, 'site-1', opened);
    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'two' });

    // Would reject with persist/seq-conflict if the kernel had opened at 0.
    await expect(kernel.flush()).resolves.toBe(8);
  });
});

describe('site persistence', () => {
  it('appends ONCE for a group that edited three pages', async () => {
    /*
      The reason there is one log and not one per page. With a log per page, a
      conflict on the third append — after the first two succeeded — is a torn
      write that `persist/seq-conflict` has no way to express.
    */
    const three = site({
      pages: [page('home', '/'), page('about', '/about'), page('work', '/work')],
    });
    const adapter = memoryAdapter({ site: three, seq: 0, tail: [] });
    const kernel = await openSite(adapter, 'site-1', opened);

    kernel.dispatchGroup([
      { command: 'setProp', args: { id: 'p1', key: 'content', value: 'a' }, pageId: 'home' },
      { command: 'setProp', args: { id: 'p1', key: 'content', value: 'b' }, pageId: 'about' },
      { command: 'setProp', args: { id: 'p1', key: 'content', value: 'c' }, pageId: 'work' },
    ]);
    await kernel.flush();

    expect(adapter.appends).toBe(1);
    expect(adapter.stored.tail).toHaveLength(1);
  });

  it('counts an edit made through a page LENS toward the flush', async () => {
    /*
      Surfaces only ever hold a lens. An earlier version wired the post-door
      hook onto the site kernel's own methods only, so every edit anyone
      actually made never counted toward a save.
    */
    const adapter = memoryAdapter({ site: site(), seq: 0, tail: [] });
    const kernel = await openSite(adapter, 'site-1', { ...opened, coalesceEvery: 2 });

    kernel.page('home').dispatch('setProp', { id: 'p1', key: 'content', value: 'one' });
    kernel.page('home').dispatch('setProp', { id: 'p1', key: 'content', value: 'two' });
    await vi.waitFor(() => {
      expect(adapter.appends).toBe(1);
    });
  });

  it('keeps saving after a refused write instead of going silent forever', async () => {
    /*
      `then(work)` alone skips its callback when the predecessor rejected, so
      one refused append would silence every later save for the life of the
      kernel — work on the screen that is not in storage, with nothing saying
      so. The chain the kernel keeps is settled-either-way.
    */
    const adapter = memoryAdapter({ site: site(), seq: 0, tail: [] });
    const kernel = await openSite(adapter, 'site-1', opened);
    const append = vi.spyOn(adapter, 'append');

    append.mockRejectedValueOnce(new Error('disk full'));
    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'one' });
    await expect(kernel.flush()).rejects.toThrow(/disk full/);

    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'two' });
    await expect(kernel.flush()).resolves.toBeGreaterThan(0);
    expect(adapter.stored.tail.length).toBeGreaterThan(0);
  });

  it('resolves the current seq when there is no adapter at all', async () => {
    const kernel = createSiteBuilder({ site: site(), ...opened });
    await expect(kernel.flush()).resolves.toBe(0);
  });
});

describe('liftDocumentSession (FR-007)', () => {
  function documentSession(tail: Transaction[] = []): PersistedSession {
    return { doc: landingFixture(), seq: tail.length, tail };
  }

  it('lifts a document into a one-page site, byte for byte', () => {
    const session = documentSession();
    const lifted = liftDocumentSession(session);

    expect(lifted.pages).toHaveLength(1);
    expect(lifted.pages[0]?.address).toBe('/');
    // The claim that matters: not "equivalent", IDENTICAL.
    expect(lifted.pages[0]?.document).toEqual(session.doc);
    expect(JSON.stringify(lifted.pages[0]?.document)).toBe(JSON.stringify(session.doc));
  });

  it('replays the document tail first, so the lift is what the person last saw', () => {
    /*
      A DOCUMENT kernel, not a site one. The first version of this test seeded
      the tail from a site kernel and immer refused the replay with "path
      doesn't resolve: pages/0/document/nodes/p1/props/content" — site-rooted
      patches cannot be applied to a document. That is the same trap S2 exists
      to mark, and it is worth the two extra lines to keep the demonstration.
    */
    const seedKernel = createBuilder({
      document: landingFixture(),
      extensions: [fixtureBlocks],
      ports: { clock: fixedClock(), ids: seededIds('d') },
    });
    seedKernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'latest' });
    const tail = [...seedKernel.transactions()];

    const lifted = liftDocumentSession(documentSession(tail));

    expect(lifted.pages[0]?.document.nodes['p1']?.props['content']).toBe('latest');
  });

  it('carries the document direction onto the site', () => {
    const rtl = { ...landingFixture(), dir: 'rtl' as const };
    const lifted = liftDocumentSession({ doc: rtl, seq: 0, tail: [] });

    expect(lifted.dir).toBe('rtl');
    // Or the site is invalid the moment it exists.
    expect(lifted.pages[0]?.document.dir).toBe('rtl');
  });

  it('arrives with a design system that passes the contrast rule', () => {
    // T311's fix, asserted from the consumer's side: a lifted page used to
    // carry `{ name: 'Default', tokens: {} }` and would now be invalid.
    const lifted = liftDocumentSession(documentSession());
    expect(lifted.designSystem.pairings.length).toBeGreaterThan(0);
    expect(() => createSiteBuilder({ site: lifted, ...opened })).not.toThrow();
  });
});
