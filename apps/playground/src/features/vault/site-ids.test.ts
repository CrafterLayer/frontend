import { describe, expect, it } from 'vitest';

import {
  createSiteBuilder,
  emptyDocument,
  siteFromDocument,
  type BuilderSiteKernel,
} from '@craftkit/builder';
import { fixedClock, seededIds } from '@craftkit/builder/testing';

import { siteHolds, siteSafePorts } from './site-ids';

/*
  The playground's ids restart at `pg-0001` on every boot. A reopened site that
  already holds the pages an earlier session added must not be handed one of
  their ids again: the door refuses a duplicate page id, so "Add page" failed
  after every reload (2026-10-12).
*/
describe('siteSafePorts', () => {
  it('lets a reopened site add a page after one added in an earlier session', () => {
    const first = createSiteBuilder({
      site: siteFromDocument(emptyDocument('site', 'ltr')),
      ports: { clock: fixedClock(), ids: seededIds('pg') },
    });
    first.dispatch('addPage', { address: '/page-2', title: 'Page 2' });
    const stored = first.getSite();
    expect(stored.pages.map((page) => page.id)).toContain('pg-0001');

    // The same seeded sequence, as a reload would start it.
    const unguarded = createSiteBuilder({
      site: stored,
      ports: { clock: fixedClock(), ids: seededIds('pg') },
    });
    expect(() => unguarded.dispatch('addPage', { address: '/page-3', title: 'Page 3' })).toThrow(
      /used more than once/,
    );

    // A box, not a `let`: the port reads the kernel it is being built for.
    const reopened: { kernel?: BuilderSiteKernel } = {};
    reopened.kernel = createSiteBuilder({
      site: stored,
      ports: siteSafePorts({ clock: fixedClock(), ids: seededIds('pg') }, () =>
        reopened.kernel?.getSite(),
      ),
    });
    reopened.kernel.dispatch('addPage', { address: '/page-3', title: 'Page 3' });
    const ids = reopened.kernel.getSite().pages.map((page) => page.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(3);
  });

  it('treats page ids and every page’s node ids as taken', () => {
    const site = siteFromDocument(emptyDocument('site', 'ltr'));
    const home = site.pages[0];
    if (home === undefined) throw new Error('a site has a home page');
    expect(siteHolds(site, home.id)).toBe(true);
    expect(siteHolds(site, home.document.rootId)).toBe(true);
    expect(siteHolds(site, 'pg-9999')).toBe(false);
  });
});
