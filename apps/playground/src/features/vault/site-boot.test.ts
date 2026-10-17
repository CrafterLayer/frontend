import { describe, expect, it } from 'vitest';

import {
  createBuilder,
  emptyDocument,
  type BuilderDocument,
  type PersistedSession,
} from '@craftkit/builder';
import { fixedClock, fixtureBlocks, landingFixture, seededIds } from '@craftkit/builder/testing';

import { sessionKey } from './persistence';
import { seedSiteFrom, siteFromFixture } from './site-boot';
import { createMemoryVaultStore } from './store';

const DOC_ID = 'playground/landing';

function documentSession(
  doc: BuilderDocument,
  tail: PersistedSession['tail'] = [],
): PersistedSession {
  return { doc, seq: tail.length, tail };
}

describe('seedSiteFrom — a first site boot', () => {
  it('lifts a document the person already has, rather than replacing it', async () => {
    /*
      The failure this exists to prevent: someone has been building a page since
      before sites existed, opens the app after the upgrade, and finds a starter
      fixture where their work was.
    */
    const store = createMemoryVaultStore();
    const mine = landingFixture();
    await store.set(sessionKey(DOC_ID), documentSession(mine));

    const seeded = await seedSiteFrom(store, DOC_ID, () => siteFromFixture(emptyDocument()));

    expect(seeded.origin).toBe('lifted');
    expect(seeded.site.pages).toHaveLength(1);
    expect(seeded.site.pages[0]?.address).toBe('/');
    // Byte for byte, not "equivalent".
    expect(JSON.stringify(seeded.site.pages[0]?.document)).toBe(JSON.stringify(mine));
  });

  it('lifts the page as last SEEN — the tail, not the older snapshot', async () => {
    const store = createMemoryVaultStore();
    const kernel = createBuilder({
      document: landingFixture(),
      extensions: [fixtureBlocks],
      ports: { clock: fixedClock(), ids: seededIds('d') },
    });
    kernel.dispatch('setProp', { id: 'p1', key: 'content', value: 'the newest words' });
    await store.set(
      sessionKey(DOC_ID),
      documentSession(landingFixture(), [...kernel.transactions()]),
    );

    const seeded = await seedSiteFrom(store, DOC_ID, () => siteFromFixture(emptyDocument()));

    expect(seeded.site.pages[0]?.document.nodes['p1']?.props['content']).toBe('the newest words');
  });

  it('uses the fixture only when NOTHING is stored', async () => {
    const store = createMemoryVaultStore();

    const seeded = await seedSiteFrom(store, DOC_ID, () => siteFromFixture(landingFixture()));

    expect(seeded.origin).toBe('fixture');
    expect(JSON.stringify(seeded.site.pages[0]?.document)).toBe(JSON.stringify(landingFixture()));
  });

  it('leaves the document session in place — this reads, it does not migrate', async () => {
    const store = createMemoryVaultStore();
    const session = documentSession(landingFixture());
    await store.set(sessionKey(DOC_ID), session);

    await seedSiteFrom(store, DOC_ID, () => siteFromFixture(emptyDocument()));

    expect(await store.get(sessionKey(DOC_ID))).toEqual(session);
  });

  it('carries the direction of the document it lifted', async () => {
    const store = createMemoryVaultStore();
    const rtl: BuilderDocument = { ...landingFixture(), dir: 'rtl' };
    await store.set(sessionKey(DOC_ID), documentSession(rtl));

    const seeded = await seedSiteFrom(store, DOC_ID, () => siteFromFixture(emptyDocument()));

    expect(seeded.site.dir).toBe('rtl');
    expect(seeded.site.pages[0]?.document.dir).toBe('rtl');
  });
});
