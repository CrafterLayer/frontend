import type {
  BuilderSiteKernel,
  JsonValue,
  SiteGroupStep,
  SitePage,
  SitemapPageProjection,
} from '@craftkit/builder';

import type { PageWorkspaceLabels } from './page-workspace.labels';

/*
  The page workspace's model: the settings draft a page edits, the site-kernel steps that
  save it, and the small reads the list and the delete flow need. Pure functions, no React;
  split from page-workspace.tsx (2026-10-12) so the component file holds the UI alone.
*/

/** A page's editable settings: identity, route, intent, SEO and the site's direction. */
export interface PageSettingsDraft {
  readonly pageId: string;
  readonly title: string;
  readonly address: string;
  readonly purpose: string;
  readonly audience: string;
  readonly direction: 'ltr' | 'rtl';
  readonly supportsSeo: boolean;
  readonly seoTitle: string;
  readonly seoDescription: string;
  readonly seoImage: string;
  readonly noIndex: boolean;
}

export function settingsFor(page: SitePage, direction: 'ltr' | 'rtl'): PageSettingsDraft {
  const root = page.document.nodes[page.document.rootId];
  const supportsSeo = root?.type === 'codePage';
  const seo = supportsSeo ? objectValue(root.props['seo']) : undefined;
  return {
    pageId: page.id,
    title: page.title,
    address: page.address,
    purpose: page.purpose,
    audience: page.audience,
    direction,
    supportsSeo,
    seoTitle: stringValue(seo?.['title']),
    seoDescription: stringValue(seo?.['description']),
    seoImage: stringValue(seo?.['image']),
    noIndex: seo?.['noIndex'] === true,
  };
}

export function pageSettingsSteps(
  currentDirection: 'ltr' | 'rtl',
  page: SitePage,
  pageIndex: number,
  settings: PageSettingsDraft,
): SiteGroupStep[] {
  const steps: SiteGroupStep[] = [];
  if (page.title !== settings.title || page.address !== settings.address) {
    steps.push({
      command: 'renamePage',
      args: {
        pageId: page.id,
        ...(page.title === settings.title ? {} : { title: settings.title }),
        ...(page.address === settings.address ? {} : { address: settings.address }),
      },
    });
  }
  const patches: {
    op: 'add' | 'replace' | 'remove';
    path: (string | number)[];
    value?: JsonValue;
  }[] = [];
  if (page.purpose !== settings.purpose)
    patches.push({ op: 'replace', path: ['pages', pageIndex, 'purpose'], value: settings.purpose });
  if (page.audience !== settings.audience)
    patches.push({
      op: 'replace',
      path: ['pages', pageIndex, 'audience'],
      value: settings.audience,
    });
  const root = page.document.nodes[page.document.rootId];
  if (settings.supportsSeo && root?.type === 'codePage') {
    const oldSeo = objectValue(root.props['seo']);
    const seo = compactSeo(settings);
    if (JSON.stringify(oldSeo ?? {}) !== JSON.stringify(seo)) {
      const path = ['pages', pageIndex, 'document', 'nodes', page.document.rootId, 'props', 'seo'];
      patches.push(
        Object.keys(seo).length === 0
          ? oldSeo === undefined
            ? { op: 'add', path, value: {} }
            : { op: 'remove', path }
          : { op: oldSeo === undefined ? 'add' : 'replace', path, value: seo },
      );
    }
  }
  if (patches.length > 0) steps.push({ command: 'applySitePatches', args: { patches } });
  if (currentDirection !== settings.direction) {
    steps.push({ command: 'setSiteDirection', args: { dir: settings.direction } });
  }
  return steps;
}

export function compactSeo(settings: PageSettingsDraft): Record<string, JsonValue> {
  return {
    ...(settings.seoTitle.trim() === '' ? {} : { title: settings.seoTitle.trim() }),
    ...(settings.seoDescription.trim() === ''
      ? {}
      : { description: settings.seoDescription.trim() }),
    ...(settings.seoImage.trim() === '' ? {} : { image: settings.seoImage.trim() }),
    ...(settings.noIndex ? { noIndex: true } : {}),
  };
}

export function objectValue(value: JsonValue | undefined): Record<string, JsonValue> | undefined {
  return value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)
    ? value
    : undefined;
}
export function stringValue(value: JsonValue | undefined): string {
  return typeof value === 'string' ? value : '';
}
export function firstReplacement(pages: readonly SitePage[], pageId: string): string | undefined {
  return pages.find((page) => page.id !== pageId)?.id;
}
export function firstReplacementTitle(
  pages: readonly SitePage[],
  pageId: string,
): string | undefined {
  return pages.find((page) => page.id !== pageId)?.title;
}
export function nextPageAddress(addresses: readonly string[]): string {
  let index = addresses.length + 1;
  while (addresses.includes(`/page-${String(index)}`)) index += 1;
  return `/page-${String(index)}`;
}
export function pageNumber(address: string): string {
  return address.split('-').at(-1) ?? '';
}
export function sharedSummary(page: SitemapPageProjection, labels: PageWorkspaceLabels): string {
  return page.sharedReferences.length === 0
    ? labels.privatePage
    : labels.sharedCount(page.sharedReferences.length);
}

export function countInboundLinks(
  site: ReturnType<BuilderSiteKernel['getSite']>,
  pageId: string,
): number {
  let count = 0;
  const visit = (value: JsonValue): void => {
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      value['kind'] === 'page' &&
      value['pageId'] === pageId
    ) {
      count += 1;
      return;
    }
    if (Array.isArray(value)) value.forEach(visit);
    else if (value !== null && typeof value === 'object') Object.values(value).forEach(visit);
  };
  for (const document of [
    ...site.pages.filter((page) => page.id !== pageId).map((page) => page.document),
    ...Object.values(site.sharedRegions).map((region) => region.document),
  ]) {
    for (const node of Object.values(document.nodes)) {
      visit(node.props);
      Object.values(node.responsive ?? {}).forEach(visit);
    }
  }
  return count;
}
