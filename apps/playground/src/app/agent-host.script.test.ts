/**
 * The panel's site hand-off for code mode (agent-script DESIGN §A.9, §A.13): the app's
 * `pageOpener(siteKernel)` remembers the site, and an edit run on one of its page lenses
 * gets a `site` that maps the pages for `ck.pages()`, treats that lens's page as current
 * and dispatches through the site's one grouped door.
 */
import { createBuilder, createSiteBuilder, emptyDocument, type Transaction } from '@craftkit/builder';
import { fivePageSite, fixedClock, seededIds } from '@craftkit/builder/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  agentScriptSiteFor,
  forgetAgentSite,
  scriptRunLine,
} from '../features/agent/model/script-site';
import { pageOpener } from './agent-host';

function site(dir: 'ltr' | 'rtl' = 'ltr') {
  return createSiteBuilder({
    site: fivePageSite(dir),
    ports: { clock: fixedClock(), ids: seededIds('agent-host-script') },
  });
}

afterEach(() => {
  forgetAgentSite();
});

describe('agentScriptSiteFor (remembered by pageOpener)', () => {
  it('maps every page to {id, title, slug, lang, dir, current} with the run’s page current', () => {
    const siteKernel = site();
    pageOpener(siteKernel);
    const current = siteKernel.currentPage();
    const scriptSite = agentScriptSiteFor(siteKernel.page(current));

    expect(scriptSite).toBeDefined();
    expect(scriptSite?.currentPage()).toBe(current);
    expect(scriptSite?.pages()).toEqual(
      siteKernel.getSite().pages.map((page) => ({
        id: page.id,
        title: page.title,
        slug: page.address,
        lang: 'en',
        dir: 'ltr',
        current: page.id === current,
      })),
    );
    expect(scriptSite?.pages().find(({ id }) => id === 'pricing')).toMatchObject({
      title: 'Pricing',
      slug: '/pricing',
    });
    expect(scriptSite?.page('about')).toBe(siteKernel.page('about'));
  });

  it('reads an rtl site’s pages as Arabic', () => {
    const siteKernel = site('rtl');
    pageOpener(siteKernel);
    const pages = agentScriptSiteFor(siteKernel.page(siteKernel.currentPage()))?.pages() ?? [];
    expect(pages.length).toBe(5);
    expect(pages.every(({ lang, dir }) => lang === 'ar' && dir === 'rtl')).toBe(true);
  });

  it('treats the lens it is given as the current page, even when the site has moved on', () => {
    const siteKernel = site();
    pageOpener(siteKernel);
    const other = siteKernel.pages().find((id) => id !== siteKernel.currentPage()) ?? '';
    const scriptSite = agentScriptSiteFor(siteKernel.page(other));
    expect(scriptSite?.currentPage()).toBe(other);
    expect(scriptSite?.pages().filter(({ current }) => current).map(({ id }) => id)).toEqual([other]);
  });

  it('gives a kernel that is no page of the site no site at all', () => {
    const siteKernel = site();
    pageOpener(siteKernel);
    const stranger = createBuilder({
      document: emptyDocument('site'),
      ports: { clock: fixedClock(), ids: seededIds('stranger') },
    });
    expect(agentScriptSiteFor(stranger)).toBeUndefined();
  });

  it('has no site before the app opened one', () => {
    const siteKernel = site();
    expect(agentScriptSiteFor(siteKernel.page(siteKernel.currentPage()))).toBeUndefined();
  });

  it('dispatches a cross-page group through the site’s one door', () => {
    const siteKernel = site();
    pageOpener(siteKernel);
    const tx = { id: 'tx-1' } as unknown as Transaction;
    const door = vi.spyOn(siteKernel, 'dispatchGroup').mockReturnValue(tx);
    const scriptSite = agentScriptSiteFor(siteKernel.page(siteKernel.currentPage()));
    const steps = [
      { command: 'setProp', args: { id: 'root', key: 'title', value: 'A' }, pageId: 'home' },
      { command: 'setProp', args: { id: 'root', key: 'title', value: 'B' }, pageId: 'about' },
    ];
    expect(scriptSite?.dispatchGroup(steps, { author: 'ai', label: 'Rename' })).toBe(tx);
    expect(door).toHaveBeenCalledWith(steps, { author: 'ai', label: 'Rename' });
  });
});

describe('scriptRunLine', () => {
  it('says ms, calls, steps, notes and result on one line', () => {
    expect(
      scriptRunLine({ step: 0, ms: 12, calls: 3, steps: 2, notes: ['Round every button'], result: '14' }),
    ).toBe('[script] 12ms calls=3 steps=2 notes=["Round every button"] result=14');
    expect(scriptRunLine({ step: 0, ms: 4, calls: 1, steps: 1, notes: [] })).toBe(
      '[script] 4ms calls=1 steps=1',
    );
  });
});
