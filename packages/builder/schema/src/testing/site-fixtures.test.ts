import { describe, expect, it } from 'vitest';

import { validateDocument } from '../document/validate';
import { validateSite } from '../site/validate';
import { fivePageSite, onePageSite, siteWithSharedRegions } from './site-fixtures';

const ALL = [
  ['onePageSite', onePageSite],
  ['fivePageSite', fivePageSite],
  ['siteWithSharedRegions', siteWithSharedRegions],
] as const;

describe('the site fixtures', () => {
  /*
    A fixture that does not validate is worse than no fixture: every test built
    on it then proves something about a site the product could never hold, and
    the first real bug it should have caught is the one it hides.
  */
  it.each(ALL)('%s is a valid site in both directions', (_name, make) => {
    for (const dir of ['ltr', 'rtl'] as const) {
      const result = validateSite(make(dir));
      expect(result.ok, result.ok ? '' : (result.issues[0]?.message ?? '')).toBe(true);
    }
  });

  it.each(ALL)('%s holds pages that are valid documents on their own', (_name, make) => {
    for (const page of make().pages) {
      expect(validateDocument(page.document)).toEqual([]);
    }
  });

  it.each(ALL)('%s hands every caller its own object graph', (_name, make) => {
    const first = make();
    const second = make();
    expect(second).not.toBe(first);
    expect(second.pages[0]).not.toBe(first.pages[0]);
    expect(second.designSystem).not.toBe(first.designSystem);
  });

  it('does not put the home page first, so a reorder bug cannot hide', () => {
    const site = fivePageSite();
    expect(site.pages).toHaveLength(5);
    expect(site.pages[0]?.address).not.toBe('/');
    expect(site.pages.filter((page) => page.address === '/')).toHaveLength(1);
  });

  it('wires the shared regions UNEVENLY, so opting out is observable', () => {
    const site = siteWithSharedRegions();
    const wiring = site.pages.map((page) => [...page.regions].sort().join(','));
    /*
      "The region reached every page" and "the region reached the pages that
      asked for it" are different contracts, and a fixture where every page
      carries every region cannot tell them apart.
    */
    expect(new Set(wiring).size).toBeGreaterThan(1);
    expect(Object.keys(site.sharedRegions).sort()).toEqual(['colophon', 'masthead']);
  });

  it('carries every page in the SITE direction, in both directions', () => {
    for (const dir of ['ltr', 'rtl'] as const) {
      for (const [, make] of ALL) {
        for (const page of make(dir).pages) {
          expect(page.document.dir).toBe(dir);
        }
      }
    }
  });
});
