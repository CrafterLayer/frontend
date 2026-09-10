import {
  pageLinkSchema,
  type BuilderDocument,
  type BuilderSite,
  type JsonValue,
  type Node,
  type PageLink,
  type SharedRegion,
} from '@craftkit/builder-schema';

export interface ResolvedPageRoute {
  readonly pageId: string;
  readonly address: string;
}

/** Resolve a stable page identity only at the preview/export boundary. */
export function resolvePageHref(site: BuilderSite, link: PageLink): string {
  const page = site.pages.find((candidate) => candidate.id === link.pageId);
  if (page === undefined) {
    throw new Error(`Cannot resolve internal link: page "${link.pageId}" does not exist.`);
  }
  return (
    page.address + (link.fragment === undefined ? '' : `#${encodeURIComponent(link.fragment)}`)
  );
}

/** Build the route table shared by preview and export. */
export function projectPageRoutes(site: BuilderSite): Readonly<Record<string, ResolvedPageRoute>> {
  const routes: Record<string, ResolvedPageRoute> = Object.create(null) as Record<
    string,
    ResolvedPageRoute
  >;
  for (const page of site.pages) routes[page.id] = { pageId: page.id, address: page.address };
  return routes;
}

/** Resolve every system page link in one document without mutating source. */
export function resolveDocumentPageLinks(
  site: BuilderSite,
  document: BuilderDocument,
): BuilderDocument {
  let changed = false;
  const nodes: Record<string, Node> = {};

  for (const [nodeId, node] of Object.entries(document.nodes)) {
    const props = resolveValue(site, node.props);
    let responsive = node.responsive;
    if (node.responsive !== undefined) {
      const tablet = node.responsive.tablet;
      const mobile = node.responsive.mobile;
      const nextTablet = tablet === undefined ? undefined : resolveValue(site, tablet);
      const nextMobile = mobile === undefined ? undefined : resolveValue(site, mobile);
      if (nextTablet !== tablet || nextMobile !== mobile) {
        responsive = {
          ...(nextTablet === undefined ? {} : { tablet: asRecord(nextTablet) }),
          ...(nextMobile === undefined ? {} : { mobile: asRecord(nextMobile) }),
        };
      }
    }

    if (props !== node.props || responsive !== node.responsive) {
      changed = true;
      nodes[nodeId] = {
        ...node,
        props: asRecord(props),
        ...(responsive === undefined ? {} : { responsive }),
      };
    } else {
      nodes[nodeId] = node;
    }
  }
  return changed ? { ...document, nodes } : document;
}

/**
 * Produce a render/export view whose internal links are current href strings.
 * Stored `{ kind: 'page', pageId }` values remain untouched.
 */
export function resolvePageLinks(site: BuilderSite): BuilderSite {
  const pages = site.pages.map((page) => {
    const document = resolveDocumentPageLinks(site, page.document);
    if (document === page.document) return page;
    return { ...page, document };
  });
  const sharedEntries: [string, SharedRegion][] = Object.entries(site.sharedRegions).map(
    ([regionId, region]) => {
      const document = resolveDocumentPageLinks(site, region.document);
      if (document === region.document) return [regionId, region];
      return [regionId, { ...region, document }];
    },
  );
  const sharedRegions = Object.fromEntries(sharedEntries);
  const changed =
    pages.some((page, index) => page !== site.pages[index]) ||
    sharedEntries.some(([regionId, region]) => region !== site.sharedRegions[regionId]);
  return changed ? { ...site, pages, sharedRegions } : site;
}

function resolveValue(site: BuilderSite, value: JsonValue): JsonValue {
  const parsed = pageLinkSchema.safeParse(value);
  if (parsed.success) return resolvePageHref(site, parsed.data);
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    const items = value.map((item) => resolveValue(site, item));
    const changed = items.some((item, index) => item !== value[index]);
    return changed ? items : value;
  }
  const entries = Object.entries(value).map(([key, item]) => {
    const next = resolveValue(site, item);
    return [key, next] as const;
  });
  const changed = entries.some(([key, item]) => item !== value[key]);
  return changed ? Object.fromEntries(entries) : value;
}

function asRecord(value: JsonValue): Record<string, JsonValue> {
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    throw new Error('A document property bag must stay an object after link resolution.');
  }
  return value;
}
