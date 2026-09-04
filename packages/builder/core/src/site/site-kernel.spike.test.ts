import { describe, expect, it } from 'vitest';

import {
  defaultDesignSystem,
  LATEST_SITE_VERSION,
  type BuilderSite,
  type SitePage,
} from '@craftkit/builder-schema';

import type { BuilderKernel } from '../kernel/create-builder';
import { fixedClock, seededIds } from '../testing/fixed-ports';
import { fixtureBlocks, landingFixture } from '../testing/fixtures';
import { changedPageNodes, createSiteKernelSpike } from './site-kernel.spike';

/**
 * SPIKE S1 — the exit gate for the plan's riskiest assumption.
 *
 * Each test is one falsifiable claim. If any of them cannot be made to pass,
 * the plan reverts to N page kernels AND admits in writing that cross-page
 * atomicity is not guaranteed, rewriting SC-010/SC-011 to page scope.
 */

function page(id: string, address: string): SitePage {
  return {
    id,
    address,
    title: id,
    purpose: 'spike',
    audience: 'spike',
    document: landingFixture(),
    regions: [],
  };
}

function twoPageSite(): BuilderSite {
  return {
    siteVersion: LATEST_SITE_VERSION,
    dir: 'ltr',
    pages: [page('home', '/'), page('about', '/about')],
    sharedRegions: {},
    designSystem: defaultDesignSystem(),
    assets: {},
  };
}

function siteKernel() {
  return createSiteKernelSpike({
    site: twoPageSite(),
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(), ids: seededIds('spike') },
  });
}

describe('S1 — a page lens over one site kernel', () => {
  it('satisfies the whole BuilderKernel surface', () => {
    const site = siteKernel();
    /*
      The compiler is the assertion: `page()` is typed to return the REAL
      `BuilderKernel`, so a missing member is a build error, not a runtime
      surprise. This runtime check only guards against a member being present
      as a non-callable, which structural typing alone would not catch.
    */
    const lens: BuilderKernel = site.page('home');
    const callable = [
      'dispatch',
      'dispatchGroup',
      'registerExtension',
      'undo',
      'redo',
      'canUndo',
      'canRedo',
      'getDocument',
      'validate',
      'setSelection',
      'clearSelection',
      'focusElement',
      'clearElementFocus',
      'transactions',
      'flush',
    ] as const;
    for (const member of callable) {
      expect(typeof lens[member], member).toBe('function');
    }
    expect(lens.context).toBeDefined();
    expect(lens.extensions).toBeDefined();
  });

  it('keeps the store facade to exactly the four sealed keys (Law S)', () => {
    const facade = siteKernel().page('home').context.store as unknown as Record<string, unknown>;
    expect(facade['setState']).toBeUndefined();
    expect(Object.keys(facade).sort()).toEqual([
      'getState',
      'select',
      'subscribe',
      'subscribeNode',
    ]);
  });

  it('makes a group across TWO pages one transaction and one undo', () => {
    const site = siteKernel();
    const before = JSON.stringify(site.getSite());

    const tx = site.dispatchGroup(
      [
        { pageId: 'home', command: 'setProp', args: { id: 'p1', key: 'content', value: 'Home' } },
        { pageId: 'about', command: 'setProp', args: { id: 'p1', key: 'content', value: 'About' } },
      ],
      { author: 'ai', label: 'AI: two pages at once' },
    );

    // The claim, stated three ways.
    expect(site.transactions()).toHaveLength(1);
    expect(tx.author).toBe('ai');
    expect(tx.command).toBe('AI: two pages at once');
    expect(site.page('home').getDocument().nodes['p1']?.props['content']).toBe('Home');
    expect(site.page('about').getDocument().nodes['p1']?.props['content']).toBe('About');

    expect(site.undo()).toBe(true);
    expect(JSON.stringify(site.getSite())).toBe(before);
  });

  it('undoes a group of ARRAY inserts exactly, not approximately', () => {
    const site = siteKernel();
    const before = JSON.stringify(site.getSite());

    /*
      The test that earns the "one produce" claim. Two inserts into the same
      slot append to an ARRAY, and array patches carry positional indices. An
      implementation that produced once PER STEP would record each inverse
      against an intermediate site, and replaying those inverses forward would
      remove the wrong positions — passing every other test in this file while
      corrupting the document on undo. A single produce records one coherent
      inverse for the whole group, which is why this is the shape that must
      round-trip.
    */
    site.dispatchGroup([
      { pageId: 'home', command: 'insertNode', args: { type: 'text', parentId: 'sec1' } },
      { pageId: 'home', command: 'insertNode', args: { type: 'text', parentId: 'sec1' } },
      { pageId: 'about', command: 'insertNode', args: { type: 'text', parentId: 'sec1' } },
    ]);
    expect(site.transactions()).toHaveLength(1);

    expect(site.undo()).toBe(true);
    expect(JSON.stringify(site.getSite())).toBe(before);
  });

  it('leaves the site untouched when any step in a group is refused', () => {
    const site = siteKernel();
    const before = JSON.stringify(site.getSite());

    expect(() =>
      site.dispatchGroup([
        { pageId: 'home', command: 'setProp', args: { id: 'p1', key: 'content', value: 'kept?' } },
        { pageId: 'about', command: 'setProp', args: { id: 'ghost', key: 'content', value: 'no' } },
      ]),
    ).toThrow();

    // Atomicity is the whole point: a refusal writes nothing, anywhere.
    expect(JSON.stringify(site.getSite())).toBe(before);
    expect(site.transactions()).toHaveLength(0);
  });

  it('scopes node subscriptions to their own page', () => {
    const site = siteKernel();
    let homeHits = 0;
    let aboutHits = 0;
    site.page('home').context.store.subscribeNode('p1', () => {
      homeHits += 1;
    });
    site.page('about').context.store.subscribeNode('p1', () => {
      aboutHits += 1;
    });

    site.page('home').dispatch('setProp', { id: 'p1', key: 'content', value: 'Only home' });

    // Same node id on both pages: the path, not the id, decides who hears it.
    expect(homeHits).toBe(1);
    expect(aboutHits).toBe(0);
  });

  it('routes a lens dispatch to its own page and no other', () => {
    const site = siteKernel();
    site.page('about').dispatch('setProp', { id: 'p1', key: 'content', value: 'About only' });

    expect(site.page('about').getDocument().nodes['p1']?.props['content']).toBe('About only');
    expect(site.page('home').getDocument().nodes['p1']?.props['content']).toBe('Welcome aboard.');
  });

  it('gives a lens for another page an empty selection rather than borrowing one', () => {
    const site = siteKernel();
    site.page('home').setSelection(['p1']);

    expect(site.page('home').context.store.getState().selection).toEqual(['p1']);
    expect(site.page('about').context.store.getState().selection).toEqual([]);
  });

  it('emits site-rooted patches that name the page they changed', () => {
    const site = siteKernel();
    const tx = site.page('about').dispatch('setProp', {
      id: 'p1',
      key: 'content',
      value: 'Pathed',
    });

    // This shape is what makes page-scoped notification possible at all.
    expect(tx.patches).toEqual([
      {
        op: 'replace',
        path: ['pages', 1, 'document', 'nodes', 'p1', 'props', 'content'],
        value: 'Pathed',
      },
    ]);
  });

  it('declares a moved page list as structural, so nobody is left unwoken', () => {
    /*
      The defect an adversarial review found, and the honest way to test it
      here. immer coalesces an insert or a reorder ahead of an edited page into
      WHOLE-ELEMENT patches — `replace ['pages',0]`, `replace ['pages',1]`,
      `add ['pages',2]` — and the fine-grained node path disappears entirely.
      A key set built from node paths alone therefore came back EMPTY, and every
      node subscriber in the site stayed silent while the document under it
      moved.

      This asserts the function directly, on the patch shape probed from the
      real immer, because the spike has no command that reorders `pages`: an
      end-to-end version needs `addPage`/`reorderPage` and belongs to D2. A test
      that dispatched two node edits and called that "structural" would pass
      without the branch existing at all — which is exactly what a first attempt
      at this test did.
    */
    const site = twoPageSite();
    const coalesced = changedPageNodes(site, [
      { op: 'replace', path: ['pages', 0], value: site.pages[1] },
      { op: 'add', path: ['pages', 2], value: site.pages[0] },
    ]);
    expect(coalesced.structural).toBe(true);

    // An ordinary node edit stays precise: one key, no site-wide wake.
    const precise = changedPageNodes(site, [
      { op: 'replace', path: ['pages', 1, 'document', 'nodes', 'p1', 'props', 'content'], value: 'x' },
    ]);
    expect(precise.structural).toBe(false);
    expect([...precise.keys]).toEqual(['about::p1']);
  });

  it('wakes subscribers again when a change is UNDONE', () => {
    const site = siteKernel();
    site.page('home').dispatch('setProp', { id: 'p1', key: 'content', value: 'Changed' });

    let seen: unknown;
    let hits = 0;
    site.page('home').context.store.subscribeNode('p1', (node) => {
      hits += 1;
      seen = node;
    });

    /*
      Undo is a write like any other and must notify like one. Without this the
      changed-key argument in `applyHistory` could be replaced with an empty set
      and nothing in the suite would move: the state half of "one undo" was
      proved, the notification half was not.
    */
    expect(site.undo()).toBe(true);

    expect(hits).toBe(1);
    expect((seen as { props: Record<string, unknown> } | undefined)?.props['content']).toBe(
      'Welcome aboard.',
    );
  });

  it('reports its own extension surface truthfully, not as a cast', () => {
    const site = siteKernel();
    const lens = site.page('home');

    /*
      `has` and `version` are called by shipped code (the renderer's subscribe,
      react's use-registry-version, the shell's Palette). The first version of
      this lens cast them away with `as unknown as`, which meant the compiler
      stopped counting members exactly where it mattered — while the test above
      still reported the surface as complete.
    */
    expect(lens.extensions.has('fixture-blocks')).toBe(true);
    expect(lens.extensions.has('never-registered')).toBe(false);
    expect(lens.extensions.version()).toBeGreaterThan(0);

    const before = lens.extensions.version();
    lens.registerExtension({ tier: 1, name: 'late', version: '0.0.0', contributes: {} });
    expect(lens.extensions.has('late')).toBe(true);
    expect(lens.extensions.version()).toBeGreaterThan(before);
  });

  it('keeps every page independently valid after a cross-page group', () => {
    const site = siteKernel();
    site.dispatchGroup([
      { pageId: 'home', command: 'insertNode', args: { type: 'text', parentId: 'sec1' } },
      { pageId: 'about', command: 'insertNode', args: { type: 'text', parentId: 'sec1' } },
    ]);

    for (const id of site.pages()) {
      expect(site.page(id).validate(), id).toEqual([]);
    }
  });
});
