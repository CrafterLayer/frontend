import { describe, expect, it } from 'vitest';

import {
  emptyDocument,
  siteFromDocument,
  type BuilderDocument,
  type BuilderSite,
  type JsonValue,
  type SitePage,
} from '@craftkit/builder';

import { countInboundLinks, inboundLinkCounts } from './page-workspace.model';

/** The per-page walk `inboundLinkCounts` replaced (2026-10-12), kept as the oracle. */
function perPageWalk(site: BuilderSite, pageId: string): number {
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

function documentWith(
  props: Record<string, JsonValue>,
  responsive?: Record<string, JsonValue>,
): BuilderDocument {
  const document = emptyDocument('site', 'ltr');
  const root = document.nodes[document.rootId];
  if (root === undefined) throw new Error('empty document has no root');
  return {
    ...document,
    nodes: {
      ...document.nodes,
      [document.rootId]: {
        ...root,
        props: { ...root.props, ...props },
        ...(responsive === undefined ? {} : { responsive: { mobile: responsive } }),
      },
    },
  };
}

function page(id: string, document: BuilderDocument): SitePage {
  return { id, address: `/${id}`, title: id, purpose: '', audience: '', document, regions: [] };
}

function linkedSite(): BuilderSite {
  const site = siteFromDocument(
    documentWith({
      cta: { kind: 'page', pageId: 'about' },
      list: [
        { kind: 'page', pageId: 'pricing' },
        { kind: 'page', pageId: 'about' },
      ],
    }),
  );
  const home = site.pages[0]?.id ?? '';
  return {
    ...site,
    pages: [
      ...site.pages,
      page('about', documentWith({ self: { kind: 'page', pageId: 'about' } })),
      page(
        'pricing',
        documentWith(
          // A link inside a link: counted for its own target, never twice for the outer one.
          { card: { kind: 'page', pageId: 'about', back: { kind: 'page', pageId: home } } },
          { cta: { kind: 'page', pageId: 'about' } },
        ),
      ),
      page('orphan', documentWith({ gone: { kind: 'page', pageId: 'deleted' } })),
    ],
    sharedRegions: {
      header: {
        id: 'header',
        kind: 'header',
        document: documentWith({ nav: { kind: 'page', pageId: 'pricing' } }),
      },
    },
  };
}

describe('inboundLinkCounts', () => {
  it('counts every page’s inbound links in one walk, exactly as the per-page walk did', () => {
    const site = linkedSite();
    const counts = inboundLinkCounts(site);
    for (const id of [...site.pages.map((page) => page.id), 'deleted', 'nobody']) {
      expect(counts.get(id) ?? 0).toBe(perPageWalk(site, id));
      expect(countInboundLinks(site, id)).toBe(perPageWalk(site, id));
    }
    // about: home's cta + home's list + pricing's card + pricing's mobile cta; its own self-link is not counted.
    expect(counts.get('about')).toBe(4);
    // pricing: home's list + the shared header.
    expect(counts.get('pricing')).toBe(2);
  });
});
