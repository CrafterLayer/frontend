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
    expect(() => migrateSite({ ...site, siteVersion: 3 })).toThrow(/newer than the supported/);
    expect(() => migrateSite({ ...site, pages: [] })).toThrow(/missing-home-page/);
  });

  it('migrates v1 deterministically without rewriting pages, documents, assets or shared regions', () => {
    const current = siteFromDocument(document);
    delete current.codeProjects;
    const legacy = { ...current, siteVersion: 1 };
    const before = JSON.stringify(legacy);
    const migrated = migrateSite(legacy);
    expect(migrated.siteVersion).toBe(2);
    expect(migrated.codeProjects).toEqual({});
    expect(migrated.pages).toBe(legacy.pages);
    expect(migrated.pages[0]?.document).toBe(document);
    expect(migrated.sharedRegions).toBe(legacy.sharedRegions);
    expect(migrated.assets).toBe(legacy.assets);
    expect(JSON.stringify(legacy)).toBe(before);
    expect(migrateSite(JSON.parse(before))).toEqual(migrated);
  });

  it('keeps legacy route spelling instead of silently changing persisted links', () => {
    const current = siteFromDocument(document);
    delete current.codeProjects;
    const home = current.pages[0];
    if (!home) throw new Error('fixture home absent');
    const legacy = {
      ...current,
      siteVersion: 1,
      pages: [home, { ...home, id: 'about', address: '/about/' }],
    };
    expect(migrateSite(legacy).pages[1]?.address).toBe('/about/');
  });
});
