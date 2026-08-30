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
    expect(site.designSystem).toEqual({ name: 'Default', tokens: {} });
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
