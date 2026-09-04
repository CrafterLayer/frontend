import { defaultDesignSystem } from '../theme/default-theme';
import { describe, expect, it } from 'vitest';

import type { BuilderDocument } from '../document/types';
import { migrateSite, siteFromDocument } from './migrations';
import { validateSite } from './validate';

const document: BuilderDocument = {
  schemaVersion: 1,
  surface: 'site',
  dir: 'rtl',
  rootId: 'root',
  nodes: { root: { id: 'root', type: 'page', props: { title: 'Original' } } },
};

describe('site migrations', () => {
  it('lifts a bare document into a one-page home site without changing the document', () => {
    const site = siteFromDocument(document);

    expect(site.pages).toHaveLength(1);
    expect(site.pages[0]?.address).toBe('/');
    expect(site.pages[0]?.document).toEqual(document);
    expect(site.pages[0]?.document).toBe(document);
    expect(site.dir).toBe(document.dir);
    expect(site.pages[0]?.regions).toEqual([]);
    expect(site.sharedRegions).toEqual({});
    /*
      A lifted page arrives with the REAL starter system, not an empty token
      map. The old expectation pinned `{ name: 'Default', tokens: {} }`, which
      is a system that resolves to no colour anywhere — and the line below,
      `validateSite(site).ok`, only passed because the contrast rule was still
      a written no-op. Now that the rule runs, the two assertions together are
      what they always claimed to be: a lifted page is renderable AND valid.
    */
    expect(site.designSystem).toEqual(defaultDesignSystem());
    expect(site.designSystem.tokens.text).toBe('#111827');
    expect(site.assets).toEqual({});
    expect(validateSite(site).ok).toBe(true);
  });

  it('accepts a current site through migrateSite', () => {
    const site = siteFromDocument(document);
    expect(migrateSite(site)).toBe(site);
  });

  it('rejects unsupported versions and invalid current sites', () => {
    const site = siteFromDocument(document);

    expect(() => migrateSite({ ...site, siteVersion: 0 })).toThrow(/No site migration/);
    expect(() => migrateSite({ ...site, siteVersion: 2 })).toThrow(/newer than the supported/);
    expect(() => migrateSite({ ...site, pages: [] })).toThrow(/missing-home-page/);
  });
});
