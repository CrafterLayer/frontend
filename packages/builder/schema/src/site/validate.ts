import { validateAssetReferences } from '../assets';
import { LATEST_SCHEMA_VERSION, type BuilderDocument } from '../document/types';
import { validateDocument } from '../document/validate';
import { validateDesignSystem } from '../theme/validate';
import {
  builderSiteSchema,
  LATEST_SITE_VERSION,
  type BuilderSite,
  type PageId,
  type SharedRegionId,
  type SitePage,
} from './types';

interface ValidSiteValidationResult {
  ok: true;
  site: BuilderSite;
}

interface InvalidSiteValidationResult {
  ok: false;
  issues: readonly SiteValidationIssue[];
}

interface SiteShapeIssue {
  message: string;
  path: readonly PropertyKey[];
}

export type SiteValidationResult = ValidSiteValidationResult | InvalidSiteValidationResult;

export interface SiteValidationIssue {
  code:
    /*
      `malformed-site` was added during integration. The worker had to route
      every unreadable envelope through `unknown-site-version`, because the
      contract published no generic shape code — which meant a site whose
      `pages` was a string reported a VERSION problem, and the first person to
      read that message would go looking in entirely the wrong place.
    */
    | 'malformed-site'
    | 'unknown-site-version'
    | 'missing-home-page'
    | 'duplicate-page-address'
    | 'duplicate-page-id'
    | 'unknown-shared-region'
    | 'invalid-page-document'
    | 'page-direction-mismatch'
    | 'unresolved-asset-reference'
    | 'design-system-contrast-failure';
  message: string;
  at?: { pageId?: PageId; regionId?: SharedRegionId };
}

/** Whole-site validation. Page validity remains owned by validateDocument(). */
export function validateSite(value: unknown): SiteValidationResult {
  const parsed = builderSiteSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, issues: shapeIssues(value, parsed.error.issues) };
  }

  const site = parsed.data;
  const issues: SiteValidationIssue[] = [];

  if (site.siteVersion !== LATEST_SITE_VERSION) {
    issues.push({
      code: 'unknown-site-version',
      message: `Site format v${String(site.siteVersion)} is not supported; expected v${String(LATEST_SITE_VERSION)}.`,
    });
  }

  const homePages = site.pages.filter((page) => page.address === '/');
  if (homePages.length !== 1) {
    issues.push({
      code: 'missing-home-page',
      message: `A site must contain exactly one home page at "/"; found ${String(homePages.length)}.`,
    });
  }

  collectDuplicatePageIssues(site.pages, 'address', 'duplicate-page-address', issues);
  collectDuplicatePageIssues(site.pages, 'id', 'duplicate-page-id', issues);

  for (const page of site.pages) {
    for (const regionId of page.regions) {
      if (!Object.hasOwn(site.sharedRegions, regionId)) {
        issues.push({
          code: 'unknown-shared-region',
          message: `Page "${page.id}" references unknown shared region "${regionId}".`,
          at: { pageId: page.id },
        });
      }
    }

    collectDocumentIssues(page.document, `Page "${page.id}"`, { pageId: page.id }, issues);

    if (page.document.dir !== site.dir) {
      issues.push({
        code: 'page-direction-mismatch',
        message: `Page "${page.id}" direction "${page.document.dir}" does not match site direction "${site.dir}".`,
        at: { pageId: page.id },
      });
    }

    for (const assetIssue of validateAssetReferences(page.document.nodes, site.assets)) {
      issues.push({
        code: 'unresolved-asset-reference',
        message: assetIssue.message,
        at: { pageId: page.id },
      });
    }
  }

  for (const region of Object.values(site.sharedRegions)) {
    collectDocumentIssues(
      region.document,
      `Shared region "${region.id}"`,
      { regionId: region.id },
      issues,
    );

    for (const assetIssue of validateAssetReferences(region.document.nodes, site.assets)) {
      issues.push({
        code: 'unresolved-asset-reference',
        message: assetIssue.message,
        at: { regionId: region.id },
      });
    }
  }

  /*
    Rule 9 (FR-014): the design system's declared pairings must be legible.

    Delegated in full to `validateDesignSystem`, which owns the thresholds and
    the fail-closed behaviour on a colour it cannot parse. Nothing about
    contrast is computed here — a second implementation would be a second
    answer to one question, and the two would drift.

    This check was a written no-op until now. The issue code was public, the
    contract listed the rule, and a site whose body text was unreadable against
    its own background validated cleanly — which is the most expensive kind of
    gap, because everything downstream is entitled to believe the validator.
  */
  const designSystem = validateDesignSystem(site.designSystem);
  if (!designSystem.ok) {
    for (const issue of designSystem.issues) {
      /*
        Every design-system failure is reported under the contrast code, which
        is narrower than what it carries: the validator also rejects an unknown
        token, a missing one, a pairing naming a role that is not a colour, and
        a system with no seed. The site contract publishes exactly one code for
        this rule, so the CODE stays the contract's and the MESSAGE carries the
        real reason — a reader is told what is wrong even when the label is
        broader than the fault. Widening the union is a contract change and
        belongs in a spec revision, not in a validator.
      */
      issues.push({
        code: 'design-system-contrast-failure',
        message: `Design system "${site.designSystem.name}": ${issue.message}`,
      });
    }
  }

  return issues.length === 0 ? { ok: true, site } : { ok: false, issues };
}

function collectDocumentIssues(
  document: BuilderDocument,
  owner: string,
  at: NonNullable<SiteValidationIssue['at']>,
  issues: SiteValidationIssue[],
): void {
  if (document.schemaVersion !== LATEST_SCHEMA_VERSION) {
    issues.push({
      code: 'invalid-page-document',
      message: `${owner} document uses format v${String(document.schemaVersion)}; expected v${String(LATEST_SCHEMA_VERSION)}.`,
      at,
    });
  }

  for (const documentIssue of validateDocument(document)) {
    const path = documentIssue.path === undefined ? '' : ` at ${documentIssue.path.join('.')}`;
    issues.push({
      code: 'invalid-page-document',
      message: `${owner} document failed ${documentIssue.code}${path}: ${documentIssue.message}`,
      at,
    });
  }
}

function collectDuplicatePageIssues(
  pages: readonly SitePage[],
  field: 'address' | 'id',
  code: 'duplicate-page-address' | 'duplicate-page-id',
  issues: SiteValidationIssue[],
): void {
  const seen = new Set<string>();
  for (const page of pages) {
    const value = page[field];
    if (seen.has(value)) {
      issues.push({
        code,
        message: `Page ${field} "${value}" is used more than once.`,
        at: { pageId: page.id },
      });
      continue;
    }
    seen.add(value);
  }
}

/*
  An unreadable envelope reports `malformed-site`; a malformed nested page
  document keeps its dedicated code, so the message points at the page rather
  than at the site. The Zod path is narrowed because Zod 4 admits symbol
  segments and a public location here is JSON-addressable only.
*/
function shapeIssues(
  value: unknown,
  zodIssues: readonly SiteShapeIssue[],
): readonly SiteValidationIssue[] {
  return zodIssues.map((issue) => {
    const path = issue.path.filter(
      (segment): segment is string | number =>
        typeof segment === 'string' || typeof segment === 'number',
    );
    const at = locationFromRawSite(value, path);
    const isNestedDocument =
      (path[0] === 'pages' && path[2] === 'document') ||
      (path[0] === 'sharedRegions' && path[2] === 'document');

    return {
      code: isNestedDocument ? 'invalid-page-document' : 'malformed-site',
      message: `Site shape is invalid${path.length === 0 ? '' : ` at ${path.join('.')}`}: ${issue.message}`,
      ...(at === undefined ? {} : { at }),
    };
  });
}

function locationFromRawSite(
  value: unknown,
  path: readonly (string | number)[],
): SiteValidationIssue['at'] | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  if (path[0] === 'pages' && typeof path[1] === 'number') {
    /*
      `value` is the REJECTED input, so nothing about its shape is known —
      indexing it yields `any` unless the unknown is carried explicitly.
      Naming the type is what lets the guards below actually mean something.
    */
    const pages: unknown = value['pages'];
    const page: unknown = Array.isArray(pages) ? (pages as unknown[])[path[1]] : undefined;
    if (isRecord(page) && typeof page['id'] === 'string') {
      return { pageId: page['id'] };
    }
  }

  if (path[0] === 'sharedRegions' && typeof path[1] === 'string') {
    return { regionId: path[1] };
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
