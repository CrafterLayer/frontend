import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { AssetEntry } from '../assets/types';
import type { BuilderDocument, ContentDirection } from '../document/types';
import type { JsonValue } from '../json/json-value';
import { defaultDesignSystem } from '../theme/default-theme';
import { parseSiteByMember } from './site-validation-memo';
import { builderSiteSchema, LATEST_SITE_VERSION, type BuilderSite, type SitePage } from './types';
import { validateSite } from './validate';

/*
  `validateSite` reuses per-page work for FROZEN pages it has seen (2026-10-12).
  These pin the contract that makes that safe: over sites built the way immer
  builds them — every untouched page the same frozen object as before — the
  answer is the one an unfrozen copy (nothing reusable) gets, issue for issue,
  including the cross-page rules an untouched page can newly break.
*/

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function document(props: Record<string, JsonValue> = {}, dir: ContentDirection = 'ltr') {
  const doc: BuilderDocument = {
    schemaVersion: 1,
    surface: 'site',
    dir,
    rootId: 'root',
    nodes: { root: { id: 'root', type: 'page', props } },
  };
  return doc;
}

function page(id: string, address: string, props: Record<string, JsonValue> = {}): SitePage {
  return {
    id,
    address,
    title: id,
    purpose: '',
    audience: '',
    document: document(props),
    regions: [],
  };
}

function asset(id: string): AssetEntry {
  return {
    id,
    url: `https://images.example/${id}.jpg`,
    description: id,
    mood: [],
    palette: [],
    alt: id,
    width: 10,
    height: 10,
  };
}

function baseSite(): BuilderSite {
  return deepFreeze({
    siteVersion: LATEST_SITE_VERSION,
    dir: 'ltr',
    pages: [
      page('home', '/', { cta: { kind: 'page', pageId: 'about' } }),
      page('about', '/about'),
      page('contact', '/contact', { image: { assetId: 'studio' } }),
    ],
    sharedRegions: {},
    designSystem: defaultDesignSystem(),
    assets: { studio: asset('studio') },
  });
}

/** A frozen next site sharing every page `change` does not replace. */
function edit(site: BuilderSite, change: (draft: BuilderSite) => BuilderSite): BuilderSite {
  return deepFreeze(change({ ...site }));
}

function expectSameAsUnfrozen(site: BuilderSite): ReturnType<typeof validateSite> {
  const result = validateSite(site);
  expect(result).toEqual(validateSite(structuredClone(site)));
  return result;
}

describe('validateSite over frozen, structurally shared sites', () => {
  it('still reports the cross-page rules an untouched page newly breaks', () => {
    const base = baseSite();
    expect(expectSameAsUnfrozen(base).ok).toBe(true);

    const withoutAbout = edit(base, (s) => ({
      ...s,
      pages: s.pages.filter((p) => p.id !== 'about'),
    }));
    expect(withoutAbout.pages[0]).toBe(base.pages[0]);
    const linkIssues = expectSameAsUnfrozen(withoutAbout);
    expect(linkIssues.ok ? [] : linkIssues.issues.map((i) => [i.code, i.at])).toEqual([
      ['unresolved-page-link', { pageId: 'home' }],
    ]);

    const withoutAsset = edit(base, (s) => ({ ...s, assets: {} }));
    const assetIssues = expectSameAsUnfrozen(withoutAsset);
    expect(assetIssues.ok ? [] : assetIssues.issues.map((i) => [i.code, i.at])).toEqual([
      ['unresolved-asset-reference', { pageId: 'contact' }],
    ]);

    const turned = edit(base, (s) => ({ ...s, dir: 'rtl' }));
    const directionIssues = expectSameAsUnfrozen(turned);
    expect(directionIssues.ok ? [] : directionIssues.issues.map((i) => i.code)).toEqual([
      'page-direction-mismatch',
      'page-direction-mismatch',
      'page-direction-mismatch',
    ]);

    const twoAbouts = edit(base, (s) => ({ ...s, pages: [...s.pages, page('again', '/about')] }));
    const addressIssues = expectSameAsUnfrozen(twoAbouts);
    expect(addressIssues.ok ? [] : addressIssues.issues.map((i) => i.code)).toEqual([
      'duplicate-page-address',
    ]);
  });

  it('answers a malformed page with Zod’s own issues, exactly as before', () => {
    const base = baseSite();
    validateSite(base);
    const malformed = edit(base, (s) => ({
      ...s,
      pages: [...s.pages, { ...page('bad', '/bad'), extra: true } as unknown as SitePage],
    }));
    const result = expectSameAsUnfrozen(malformed);
    expect(result.ok ? [] : result.issues.map((i) => i.code)).toEqual(['malformed-site']);
  });

  it('does not parse an unchanged frozen page again', () => {
    let reads = 0;
    const counted = page('counted', '/counted');
    Object.defineProperty(counted, 'title', {
      enumerable: true,
      get: () => {
        reads += 1;
        return 'Counted';
      },
    });
    const base = baseSite();
    const first = edit(base, (s) => ({ ...s, pages: [...s.pages, counted] }));
    expect(validateSite(first).ok).toBe(true);
    const afterFirst = reads;
    expect(afterFirst).toBeGreaterThan(0);

    // A new site (one more page) that shares the counted page object.
    const second = edit(first, (s) => ({ ...s, pages: [...s.pages, page('more', '/more')] }));
    expect(validateSite(second).ok).toBe(true);
    expect(reads).toBe(afterFirst);
  });

  it('agrees with the unfrozen answer over random edit sequences', () => {
    const pageIds = ['home', 'about', 'contact', 'blog', 'ghost'];
    const editArb = fc.oneof(
      fc.record({
        kind: fc.constant('add' as const),
        id: fc.constantFrom(...pageIds),
        slot: fc.nat(3),
      }),
      fc.record({ kind: fc.constant('remove' as const), index: fc.nat(5) }),
      fc.record({
        kind: fc.constant('dir' as const),
        dir: fc.constantFrom('ltr' as const, 'rtl' as const),
      }),
      fc.record({
        kind: fc.constant('link' as const),
        index: fc.nat(5),
        to: fc.constantFrom(...pageIds),
      }),
      fc.record({ kind: fc.constant('asset' as const), present: fc.boolean() }),
    );
    fc.assert(
      fc.property(fc.array(editArb, { maxLength: 12 }), (edits) => {
        let site = baseSite();
        expectSameAsUnfrozen(site);
        for (const step of edits) {
          site = edit(site, (s) => {
            const at = (index: number) => index % Math.max(s.pages.length, 1);
            switch (step.kind) {
              case 'add':
                return {
                  ...s,
                  pages: [
                    ...s.pages,
                    page(`${step.id}-${String(s.pages.length)}`, `/p${String(step.slot)}`),
                  ],
                };
              case 'remove':
                return s.pages.length < 2
                  ? s
                  : { ...s, pages: s.pages.filter((_, i) => i !== at(step.index)) };
              case 'dir':
                return { ...s, dir: step.dir };
              case 'link':
                return {
                  ...s,
                  pages: s.pages.map((p, i) =>
                    i === at(step.index)
                      ? {
                          ...p,
                          document: document(
                            { to: { kind: 'page', pageId: step.to } },
                            p.document.dir,
                          ),
                        }
                      : p,
                  ),
                };
              case 'asset':
                return { ...s, assets: step.present ? { studio: asset('studio') } : {} };
            }
          });
          expectSameAsUnfrozen(site);
        }
      }),
      { numRuns: 200 },
    );
  });
});

describe('parseSiteByMember', () => {
  const variants: [string, unknown][] = [
    ['valid', structuredClone(baseSite())],
    [
      'with a library and code projects absent',
      { ...structuredClone(baseSite()), library: undefined },
    ],
    ['an extra top-level key', { ...structuredClone(baseSite()), extra: 1 }],
    ['no assets', { ...structuredClone(baseSite()), assets: undefined }],
    ['pages not an array', { ...structuredClone(baseSite()), pages: {} }],
    ['not an object', 'site'],
  ];

  it.each(variants)('parses %s exactly as builderSiteSchema does', (_name, value) => {
    const whole = builderSiteSchema.safeParse(value);
    const byMember = parseSiteByMember(value);
    expect(byMember === undefined).toBe(!whole.success);
    if (whole.success) expect(JSON.stringify(byMember)).toBe(JSON.stringify(whole.data));
  });
});
