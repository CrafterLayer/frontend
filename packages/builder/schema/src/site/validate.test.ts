import { validateDesignSystem } from '../theme/validate';
import { defaultDesignSystem } from '../theme/default-theme';
import { describe, expect, it } from 'vitest';

import type { BuilderDocument, ContentDirection } from '../document/types';
import type { JsonValue } from '../json/json-value';
import { LATEST_SITE_VERSION, type BuilderSite, type SitePage } from './types';
import { type SiteValidationIssue, validateSite } from './validate';

function document(
  dir: ContentDirection = 'ltr',
  props: Record<string, JsonValue> = {},
): BuilderDocument {
  return {
    schemaVersion: 1,
    surface: 'site',
    dir,
    rootId: 'root',
    nodes: { root: { id: 'root', type: 'page', props } },
  };
}

function page(id: string, address: string, dir: ContentDirection = 'ltr'): SitePage {
  return {
    id,
    address,
    title: id,
    purpose: `${id} purpose`,
    audience: `${id} audience`,
    document: document(dir),
    regions: [],
  };
}

function validSite(): BuilderSite {
  return {
    siteVersion: LATEST_SITE_VERSION,
    dir: 'ltr',
    pages: [page('home', '/')],
    sharedRegions: {},
    designSystem: defaultDesignSystem(),
    assets: {},
  };
}

function issuesOf(value: unknown): readonly SiteValidationIssue[] {
  const result = validateSite(value);
  return result.ok ? [] : result.issues;
}

describe('validateSite', () => {
  it('accepts a valid site with zero issues', () => {
    expect(issuesOf(validSite())).toEqual([]);
  });

  it('reports unknown-site-version', () => {
    for (const siteVersion of [0, LATEST_SITE_VERSION + 1]) {
      expect(issuesOf({ ...validSite(), siteVersion }).map((issue) => issue.code)).toContain(
        'unknown-site-version',
      );
    }
  });

  /*
    An unreadable envelope is its own failure. Reporting it as a VERSION
    problem — which the published contract's code list forced before
    `malformed-site` was added during integration — sends the first person to
    read the message looking in entirely the wrong place.
  */
  it('reports malformed-site for an unreadable envelope, not a version problem', () => {
    const codes = issuesOf({ ...validSite(), pages: 'not an array' }).map((issue) => issue.code);

    expect(codes).toContain('malformed-site');
    expect(codes).not.toContain('unknown-site-version');
  });

  it('reports missing-home-page unless exactly one page uses /', () => {
    const noHome = { ...validSite(), pages: [page('about', '/about')] };
    const twoHomes = { ...validSite(), pages: [page('home-a', '/'), page('home-b', '/')] };

    for (const site of [noHome, twoHomes]) {
      expect(issuesOf(site).map((issue) => issue.code)).toContain('missing-home-page');
    }
  });

  it('reports duplicate-page-address', () => {
    const site = {
      ...validSite(),
      pages: [page('home', '/'), page('about-a', '/about'), page('about-b', '/about')],
    };
    expect(issuesOf(site).map((issue) => issue.code)).toContain('duplicate-page-address');
  });

  it('reports duplicate-page-id', () => {
    const site = { ...validSite(), pages: [page('home', '/'), page('home', '/about')] };
    expect(issuesOf(site).map((issue) => issue.code)).toContain('duplicate-page-id');
  });

  it('reports unknown-shared-region', () => {
    const home = { ...page('home', '/'), regions: ['missing-region'] };
    const site = { ...validSite(), pages: [home] };
    expect(issuesOf(site).map((issue) => issue.code)).toContain('unknown-shared-region');
  });

  it('wraps the existing document validator as invalid-page-document', () => {
    const home = page('home', '/');
    const invalidDocument = { ...home.document, rootId: 'missing-root' };
    const site: BuilderSite = {
      ...validSite(),
      pages: [{ ...home, document: invalidDocument }],
      sharedRegions: {
        footer: {
          id: 'footer',
          kind: 'footer',
          document: { ...document(), rootId: 'missing-region-root' },
        },
      },
    };
    const issues = issuesOf(site).filter((issue) => issue.code === 'invalid-page-document');

    /*
      Asserted by BEHAVIOUR, not by count. `validateDocument` reports more than
      one problem for a broken root — a missing root and the nodes orphaned by
      it — and the exact number is its business, not this validator's. Pinning
      it here would make a site test fail every time the document validator got
      a better diagnostic, which is the wrong incentive entirely.
    */
    expect(issues.some((issue) => issue.message.includes('doc/root-missing'))).toBe(true);
    expect(issues.some((issue) => issue.at?.pageId === 'home')).toBe(true);
    expect(issues.some((issue) => issue.at?.regionId === 'footer')).toBe(true);
    // Every wrapped issue names where it came from; none is anonymous.
    expect(issues.every((issue) => issue.at !== undefined)).toBe(true);

    const futurePage = page('home', '/');
    futurePage.document.schemaVersion = 2;
    expect(issuesOf({ ...validSite(), pages: [futurePage] }).map((issue) => issue.code)).toContain(
      'invalid-page-document',
    );
  });

  it('reports page-direction-mismatch', () => {
    const site = { ...validSite(), pages: [page('home', '/', 'rtl')] };
    expect(issuesOf(site).map((issue) => issue.code)).toContain('page-direction-mismatch');
  });

  it('reports unresolved-asset-reference for both pages and shared regions', () => {
    const home = {
      ...page('home', '/'),
      document: document('ltr', { image: { assetId: 'missing-page' } }),
      regions: ['header'],
    };
    const site: BuilderSite = {
      ...validSite(),
      pages: [home],
      sharedRegions: {
        header: {
          id: 'header',
          kind: 'header',
          document: document('ltr', { image: { assetId: 'missing-region' } }),
        },
      },
    };
    const unresolved = issuesOf(site).filter(
      (issue) => issue.code === 'unresolved-asset-reference',
    );

    expect(unresolved.map((issue) => issue.code)).toEqual([
      'unresolved-asset-reference',
      'unresolved-asset-reference',
    ]);
    expect(unresolved.map((issue) => issue.at)).toEqual([
      { pageId: 'home' },
      { regionId: 'header' },
    ]);
  });

  it('clears the default design system — the starter is legible by measurement', () => {
    /*
      This test used to be named "reserves design-system-contrast-failure while
      the Wave 3 check is a no-op" and asserted only that a string equalled
      itself. The rule is real now (see the rule 9 block below), so what is
      worth asserting here is the opposite direction: the system every new site
      starts from passes the check it is now subject to. If a token edit ever
      pushes one of the seven declared pairings under 4.5:1, this goes red.
    */
    const reservedCode: SiteValidationIssue['code'] = 'design-system-contrast-failure';
    expect(issuesOf(validSite()).map((issue) => issue.code)).not.toContain(reservedCode);
  });
});

describe('validateSite — rule 9, the design system must be legible (FR-014)', () => {
  /*
    This rule was a WRITTEN NO-OP until now: the issue code was public, the
    contract listed the rule, and a site whose body text was invisible against
    its own background validated cleanly. These tests are what make the rule
    real, so they have to construct a failing system rather than assert that a
    passing one does not fail — which is all the previous test did.
  */
  it('rejects a pairing below the contrast threshold, and says which', () => {
    const site = validSite();
    const unreadable = {
      ...defaultDesignSystem(),
      tokens: { ...defaultDesignSystem().tokens, textMuted: '#f2f2f2' },
    };

    const result = validateSite({ ...site, designSystem: unreadable });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    const issue = result.issues.find((candidate) => candidate.code === 'design-system-contrast-failure');
    expect(issue).toBeDefined();
    // The message names the real fault; the code is the contract's single one.
    expect(issue?.message).toContain('textMuted');
  });

  it('rejects a design system that names a token the vocabulary does not have', () => {
    const site = validSite();
    const invented = {
      ...defaultDesignSystem(),
      tokens: { ...defaultDesignSystem().tokens, brandPurple: '#6d28d9' },
    };

    const result = validateSite({ ...site, designSystem: invented });

    expect(result.ok).toBe(false);
  });

  it('accepts the starter system, whose pairings were measured rather than assumed', () => {
    /*
      The guard on the other direction. `defaultDesignSystem()` is what every
      lifted page arrives with, so if it did not pass this rule, every migrated
      site would be invalid the moment the rule started running — the two fixes
      would have silently fought each other.
    */
    expect(validateSite(validSite()).ok).toBe(true);
    expect(validateDesignSystem(defaultDesignSystem()).ok).toBe(true);
  });
});
