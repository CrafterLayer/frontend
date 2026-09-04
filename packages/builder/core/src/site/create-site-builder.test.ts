import { describe, expect, it, vi } from 'vitest';

import {
  BuilderError,
  defaultDesignSystem,
  LATEST_SITE_VERSION,
  type BuilderSite,
  type SitePage,
} from '@craftkit/builder-schema';

import { seededIds } from '../testing/fixed-ports';
import { fixedClock } from '../testing/fixed-ports';
import { fixtureBlocks, landingFixture } from '../testing/fixtures';
import { createSiteBuilder, type BuilderSiteKernel } from './create-site-builder';

/**
 * D2 — the site kernel, and the S1 claims re-asserted against SHIPPED code.
 *
 * A spike proves an approach is possible; it does not prove the delivery kept
 * the property. Every claim S1 made is stated again here against
 * `createSiteBuilder`, plus the things the spike deliberately did not have: site
 * commands, real extensions, selection pruning, and whole-site validation.
 */

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

function twoPageSite(overrides: Partial<BuilderSite> = {}): BuilderSite {
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

function kernel(site = twoPageSite()): BuilderSiteKernel {
  return createSiteBuilder({
    site,
    extensions: [fixtureBlocks],
    ports: { clock: fixedClock(), ids: seededIds('s') },
  });
}

describe('createSiteBuilder — construction', () => {
  it('refuses an invalid site instead of opening one (Law M, whole-site)', () => {
    /*
      Everything downstream — the dispatcher, every lens, every surface — is
      entitled to assume a valid site. A kernel that quietly accepted a broken
      one would push the failure to whichever caller happened to read the bad
      field, arbitrarily far from the cause.
    */
    const noHome = twoPageSite({ pages: [page('about', '/about')] });
    let caught: unknown;
    try {
      kernel(noHome);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(BuilderError);
    expect((caught as BuilderError).code).toBe('site/structural-violation');
    expect((caught as BuilderError).message).toMatch(/home page/);
  });

  it('opens on the first page, and lists what it holds', () => {
    const site = kernel();
    expect(site.pages()).toEqual(['home', 'about']);
    expect(site.currentPage()).toBe('home');
    expect(site.validate().ok).toBe(true);
  });

  it('refuses a page it does not have, rather than returning an empty lens', () => {
    expect(() => kernel().page('ghost')).toThrow(/No page "ghost"/);
  });
});

describe('createSiteBuilder — one production, one transaction, one undo (S1)', () => {
  it('lands a group touching TWO pages as ONE transaction', () => {
    const site = kernel();

    const tx = site.dispatchGroup(
      [
        { command: 'setProp', args: { id: 'p1', key: 'content', value: 'On home' }, pageId: 'home' },
        {
          command: 'setProp',
          args: { id: 'p1', key: 'content', value: 'On about' },
          pageId: 'about',
        },
      ],
      { author: 'ai', label: 'AI: two pages' },
    );

    expect(site.transactions()).toHaveLength(1);
    expect(tx.author).toBe('ai');
    expect(tx.command).toBe('AI: two pages');
    expect(site.page('home').getDocument().nodes['p1']?.props['content']).toBe('On home');
    expect(site.page('about').getDocument().nodes['p1']?.props['content']).toBe('On about');
  });

  it('reverses that group byte-for-byte with ONE undo', () => {
    const site = kernel();
    const before = JSON.stringify(site.getSite());

    site.dispatchGroup([
      { command: 'setProp', args: { id: 'p1', key: 'content', value: 'a' }, pageId: 'home' },
      { command: 'setProp', args: { id: 'p1', key: 'content', value: 'b' }, pageId: 'about' },
    ]);

    expect(site.undo()).toBe(true);
    expect(JSON.stringify(site.getSite())).toBe(before);
    expect(site.redo()).toBe(true);
    expect(site.page('about').getDocument().nodes['p1']?.props['content']).toBe('b');
  });

  it('mixes a SITE command and a PAGE command in one production', () => {
    /*
      The claim the whole arrangement exists for. `addPage` writes the site
      draft, `setProp` writes a page's document, and they are one immer
      production — so there is no ordering in which half of this can be
      observed, and one undo takes both back.
    */
    const site = kernel();

    site.dispatchGroup(
      [
        { command: 'addPage', args: { address: '/pricing', title: 'Pricing' } },
        { command: 'setProp', args: { id: 'p1', key: 'content', value: 'Edited' }, pageId: 'home' },
      ],
      { author: 'ai', label: 'AI: page + edit' },
    );

    expect(site.pages()).toEqual(['home', 'about', 's-0001']);
    expect(site.page('home').getDocument().nodes['p1']?.props['content']).toBe('Edited');
    expect(site.transactions()).toHaveLength(1);

    site.undo();
    expect(site.pages()).toEqual(['home', 'about']);
    expect(site.page('home').getDocument().nodes['p1']?.props['content']).not.toBe('Edited');
  });

  it('writes NOTHING when a later step in the group refuses', () => {
    const site = kernel();
    const before = JSON.stringify(site.getSite());

    expect(() =>
      site.dispatchGroup([
        { command: 'setProp', args: { id: 'p1', key: 'content', value: 'landed?' }, pageId: 'home' },
        // Refused: `/about` is taken.
        { command: 'addPage', args: { address: '/about', title: 'Clash' } },
      ]),
    ).toThrow(/already lives at/);

    expect(JSON.stringify(site.getSite())).toBe(before);
    expect(site.transactions()).toHaveLength(0);
    expect(site.canUndo()).toBe(false);
  });

  it('has the transaction in the log BEFORE it notifies (003 §15)', () => {
    /*
      The convergence-class rule, restated for the site door. React's
      `useSyncExternalStore` reads snapshots SYNCHRONOUSLY inside the
      notification, so a subscriber deriving from the log — `transactions()
      .length` is the canonical one — must already see this transaction. Record
      after the write and the change-check bails out, and the view lags one
      event behind for the life of the session.

      This test exists because a mutation that moved `log.append` and
      `history.record` to AFTER `store.write` passed every other test in this
      file.
    */
    const site = kernel();
    const seen: { count: number; canUndo: boolean }[] = [];
    site.page('home').context.store.subscribe(() => {
      seen.push({ count: site.transactions().length, canUndo: site.canUndo() });
    });

    site.dispatch('setProp', { id: 'p1', key: 'content', value: 'observed' });

    expect(seen).toEqual([{ count: 1, canUndo: true }]);
  });

  it('records no transaction for a group that changes nothing', () => {
    const site = kernel();
    const current = site.page('home').getDocument().nodes['p1']?.props['content'];

    site.dispatchGroup([
      { command: 'setProp', args: { id: 'p1', key: 'content', value: current }, pageId: 'home' },
    ]);

    expect(site.transactions()).toHaveLength(0);
  });
});

describe('page lenses', () => {
  it('is the same lens object for the same page', () => {
    const site = kernel();
    expect(site.page('home')).toBe(site.page('home'));
    expect(site.page('home')).not.toBe(site.page('about'));
  });

  it('dispatches through the lens onto ITS page, not the current one', () => {
    const site = kernel();
    expect(site.currentPage()).toBe('home');

    site.page('about').dispatch('setProp', { id: 'p1', key: 'content', value: 'via lens' });

    expect(site.page('about').getDocument().nodes['p1']?.props['content']).toBe('via lens');
    expect(site.page('home').getDocument().nodes['p1']?.props['content']).not.toBe('via lens');
  });

  it('wakes a node subscriber on ITS page only — same node id, two pages', () => {
    /*
      The property that makes ONE store legitimate. Both pages have a node
      called `p1`; an edit to one must not wake the other's subscriber, or
      every view in the site re-renders on every keystroke anywhere.
    */
    const site = kernel();
    const onHome = vi.fn();
    const onAbout = vi.fn();
    site.page('home').context.store.subscribeNode('p1', onHome);
    site.page('about').context.store.subscribeNode('p1', onAbout);

    site.page('home').dispatch('setProp', { id: 'p1', key: 'content', value: 'only home' });

    expect(onHome).toHaveBeenCalledTimes(1);
    expect(onAbout).not.toHaveBeenCalled();
  });

  it('wakes EVERY node subscriber on a structural change', () => {
    /*
      S1's recorded finding, now end-to-end with a real site command: immer
      coalesces a page insert into replacements of whole page elements, so the
      node path disappears and the change cannot be attributed. Waking too many
      is a re-render; waking nobody is a view that lies.
    */
    const site = kernel();
    const onHome = vi.fn();
    const onAbout = vi.fn();
    site.page('home').context.store.subscribeNode('p1', onHome);
    site.page('about').context.store.subscribeNode('p1', onAbout);

    site.dispatch('addPage', { address: '/new', title: 'New', index: 0 });

    expect(onHome).toHaveBeenCalled();
    expect(onAbout).toHaveBeenCalled();
  });

  it('reports an empty selection for a page that is not current', () => {
    const site = kernel();
    site.page('home').setSelection(['p1']);

    expect(site.page('home').context.store.getState().selection).toEqual(['p1']);
    expect(site.page('about').context.store.getState().selection).toEqual([]);
  });

  it('makes a page current by selecting in it', () => {
    const site = kernel();
    site.page('about').setSelection(['p1']);

    expect(site.currentPage()).toBe('about');
    expect(site.page('about').context.store.getState().selection).toEqual(['p1']);
  });

  it('validates its own page, and reads its own dir and surface', () => {
    const site = kernel();
    expect(site.page('about').validate()).toEqual([]);
    expect(site.page('about').context.dir).toBe('ltr');
    expect(site.page('about').context.surface).toBe('site');
  });

  it('shares ONE history: undo from a lens reverses a group made on the site', () => {
    const site = kernel();
    site.dispatchGroup([
      { command: 'setProp', args: { id: 'p1', key: 'content', value: 'x' }, pageId: 'home' },
      { command: 'setProp', args: { id: 'p1', key: 'content', value: 'y' }, pageId: 'about' },
    ]);

    expect(site.page('home').canUndo()).toBe(true);
    expect(site.page('home').undo()).toBe(true);
    expect(site.page('about').getDocument().nodes['p1']?.props['content']).not.toBe('y');
    // One log, seen identically from either seat.
    expect(site.page('about').transactions()).toEqual(site.transactions());
  });
});

describe('direction is a property of the SITE', () => {
  it('refuses a page that tries to turn on its own, and names the command that does', () => {
    /*
      `setDocMeta` is a legal page command, and through a lens it writes
      `pages[i].document.dir`. Inside a site that leaves the site and every
      other page pointing the other way — which `validateSite` reports as
      `page-direction-mismatch` on RELOAD. The editor would look fine for the
      whole session and refuse to open the next time, which is the worst shape a
      defect can take. Found by the playground's own vault test, not by this
      file: nothing here had reason to flip a page.
    */
    const site = kernel();
    const before = JSON.stringify(site.getSite());

    expect(() => site.page('home').dispatch('setDocMeta', { dir: 'rtl' })).toThrow(
      /use setSiteDirection/,
    );

    expect(JSON.stringify(site.getSite())).toBe(before);
    expect(site.transactions()).toHaveLength(0);
    expect(site.validate().ok).toBe(true);
  });

  it('still lets a page change a meta field that is NOT direction', () => {
    const site = kernel();

    site.page('home').dispatch('setDocMeta', { surface: 'email' });

    expect(site.page('home').getDocument().surface).toBe('email');
    expect(site.transactions()).toHaveLength(1);
  });

  it('turns the whole site through setSiteDirection, and stays valid', () => {
    const site = kernel();

    site.dispatch('setSiteDirection', { dir: 'rtl' });

    expect(site.page('home').getDocument().dir).toBe('rtl');
    expect(site.page('about').getDocument().dir).toBe('rtl');
    expect(site.validate().ok).toBe(true);
    expect(site.transactions()).toHaveLength(1);
  });
});

describe('selection pruning', () => {
  it('drops a selected node the site door removed', () => {
    const site = kernel();
    site.page('home').setSelection(['p1']);

    site.page('home').dispatch('removeNode', { id: 'p1' });

    expect(site.page('home').context.store.getState().selection).toEqual([]);
  });

  it('moves off a removed CURRENT page and drops its selection', () => {
    /*
      The invalidation a page kernel cannot have, and the one whose first test
      here was VACUOUS: it read the selection through the `home` lens, which
      reports `[]` for any non-current page whatever the store holds — so the
      assertion passed with the pruning removed. Reading it through the lens of
      the page the kernel is NOW on is what actually observes the prune.

      That vacuous test hid a real defect: `pageId` kept naming the removed
      page, so `currentPage()` returned a dead id and every lens reported an
      empty selection because none of them was "current".
    */
    const site = kernel();
    site.page('about').setSelection(['p1']);
    expect(site.currentPage()).toBe('about');

    site.dispatch('removePage', { pageId: 'about' });

    expect(site.getSite().pages.map((p) => p.id)).toEqual(['home']);
    // The kernel moved to a page that exists...
    expect(site.currentPage()).toBe('home');
    // ...and the selection that pointed into the removed page is gone.
    const state = site.page(site.currentPage()).context.store.getState();
    expect(state.selection).toEqual([]);
    expect(state.elementFocus).toBeNull();
  });

  it('keeps the current page when a DIFFERENT page is removed', () => {
    const site = kernel();
    site.page('home').setSelection(['p1']);

    site.dispatch('removePage', { pageId: 'about' });

    expect(site.currentPage()).toBe('home');
    // Untouched: a removal elsewhere is not a reason to lose the selection.
    expect(site.page('home').context.store.getState().selection).toEqual(['p1']);
  });

  it('lands on the neighbour, not always the first page', () => {
    const three = twoPageSite({
      pages: [page('home', '/'), page('about', '/about'), page('work', '/work')],
    });
    const site = kernel(three);
    site.setCurrentPage('work');

    site.dispatch('removePage', { pageId: 'work' });

    // The page that took its index — the editor's natural next page.
    expect(site.currentPage()).toBe('about');
  });

  it('keeps element focus only while its node stays selected', () => {
    const site = kernel();
    site.page('home').focusElement('p1', [0]);
    expect(site.page('home').context.store.getState().elementFocus).toEqual({
      id: 'p1',
      path: [0],
    });

    site.page('home').dispatch('removeNode', { id: 'p1' });

    expect(site.page('home').context.store.getState().elementFocus).toBeNull();
  });
});

describe('the current page', () => {
  it('moves, clearing selection with it', () => {
    const site = kernel();
    site.page('home').setSelection(['p1']);

    site.setCurrentPage('about');

    expect(site.currentPage()).toBe('about');
    expect(site.page('about').context.store.getState().selection).toEqual([]);
  });

  it('refuses an unknown page without changing anything', () => {
    const site = kernel();
    expect(() => {
      site.setCurrentPage('ghost');
    }).toThrow(/No page "ghost"/);
    expect(site.currentPage()).toBe('home');
  });
});

describe('extensions', () => {
  it('answers has/version truthfully — a real manager, not a stub', () => {
    const site = kernel();
    expect(site.extensions.has('fixture-blocks')).toBe(true);
    expect(site.extensions.has('never-registered')).toBe(false);
    // The same manager from either seat.
    expect(site.page('home').extensions.has('fixture-blocks')).toBe(true);
    expect(site.page('home').extensions.version()).toBe(site.extensions.version());
  });
});
