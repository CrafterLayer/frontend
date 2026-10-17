import {
  codePageReferenceSchema,
  isAssetRef,
  type BuilderSite,
  type JsonValue,
  type Node,
  type SitePage,
} from '@craftkit/builder-schema';

export interface SitemapThumbnail {
  readonly kind: 'provided' | 'seo' | 'asset' | 'fallback';
  readonly src?: string | undefined;
  readonly alt: string;
}

export interface SitemapSharedReference {
  readonly id: string;
  readonly label: string;
  readonly kind: 'region' | 'module';
}

export interface SitemapPageProjection {
  readonly id: string;
  readonly index: number;
  readonly title: string;
  readonly address: string;
  readonly isHome: boolean;
  readonly thumbnail: SitemapThumbnail;
  readonly sharedReferences: readonly SitemapSharedReference[];
}

export interface SitemapProjection {
  readonly pages: readonly SitemapPageProjection[];
  readonly sharedReferenceCount: number;
}

export interface ProjectSitemapOptions {
  readonly thumbnailByPageId?: Readonly<Record<string, string>> | undefined;
}

/** Project editor-ready sitemap cards from the same ordered state as the page list. */
export function projectSitemap(
  site: BuilderSite,
  options: ProjectSitemapOptions = {},
): SitemapProjection {
  const pages = site.pages.map((page, index): SitemapPageProjection => ({
    id: page.id,
    index,
    title: page.title,
    address: page.address,
    isHome: page.address === '/',
    thumbnail: projectThumbnail(site, page, options.thumbnailByPageId?.[page.id]),
    sharedReferences: projectSharedReferences(site, page),
  }));
  return {
    pages,
    sharedReferenceCount: new Set(
      pages.flatMap((page) =>
        page.sharedReferences.map((reference) => `${reference.kind}:${reference.id}`),
      ),
    ).size,
  };
}

function projectThumbnail(
  site: BuilderSite,
  page: SitePage,
  provided: string | undefined,
): SitemapThumbnail {
  if (provided !== undefined) {
    return { kind: 'provided', src: provided, alt: `${page.title} preview` };
  }

  const root = page.document.nodes[page.document.rootId];
  if (root?.type === 'codePage') {
    const reference = codePageReferenceSchema.safeParse(root.props);
    const image = reference.success ? reference.data.seo?.image : undefined;
    if (image !== undefined) return { kind: 'seo', src: image, alt: `${page.title} preview` };
  }

  for (const node of orderedNodes(page)) {
    const assetId = firstAssetId(node.props);
    const asset = assetId === undefined ? undefined : site.assets[assetId];
    if (asset !== undefined) return { kind: 'asset', src: asset.url, alt: asset.alt };
  }
  return { kind: 'fallback', alt: `No preview available for ${page.title}` };
}

function projectSharedReferences(
  site: BuilderSite,
  page: SitePage,
): readonly SitemapSharedReference[] {
  const references: SitemapSharedReference[] = page.regions.map((regionId) => ({
    id: regionId,
    label: site.sharedRegions[regionId]?.kind ?? regionId,
    kind: 'region',
  }));
  const root = page.document.nodes[page.document.rootId];
  if (root?.type !== 'codePage') return references;
  const reference = codePageReferenceSchema.safeParse(root.props);
  if (!reference.success) return references;
  const entry = site.codeProjects?.[reference.data.projectId]?.files[reference.data.entry];
  if (entry === undefined) return references;

  const seen = new Set<string>();
  for (const specifier of sharedModuleSpecifiers(entry.source)) {
    if (seen.has(specifier)) continue;
    seen.add(specifier);
    references.push({ id: specifier, label: moduleLabel(specifier), kind: 'module' });
  }
  return references;
}

function orderedNodes(page: SitePage): readonly Node[] {
  const output: Node[] = [];
  const seen = new Set<string>();
  const pending = [page.document.rootId];
  while (pending.length > 0) {
    const id = pending.shift();
    if (id === undefined || seen.has(id)) continue;
    seen.add(id);
    const node = page.document.nodes[id];
    if (node === undefined) continue;
    output.push(node);
    for (const children of Object.values(node.slots ?? {})) pending.push(...children);
  }
  return output;
}

/*
  `isAssetRef`, not a bare `assetRefSchema.safeParse` (2026-10-12). This walk
  visits every prop value of every page on every page-list render, and nearly
  every value fails the schema; a failing parse builds a ZodError. Measured on
  the dev server with a 20-page landing site: 1.5 s of the 1.6 s "Add page"
  render. `isAssetRef` rejects what cannot match before it asks the same schema.
*/
function firstAssetId(value: JsonValue): string | undefined {
  if (isAssetRef(value)) return value.assetId;
  if (value === null || typeof value !== 'object') return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const id = firstAssetId(item);
      if (id !== undefined) return id;
    }
    return undefined;
  }
  for (const item of Object.values(value)) {
    const id = firstAssetId(item);
    if (id !== undefined) return id;
  }
  return undefined;
}

function sharedModuleSpecifiers(source: string): readonly string[] {
  const matches = source.matchAll(/(?:from\s*|import\s*)['"]([^'"]*shared\/[^'"]+)['"]/g);
  return [...matches].map((match) => match[1] ?? '').filter(Boolean);
}

function moduleLabel(specifier: string): string {
  const name = specifier.split('/').at(-1) ?? specifier;
  return name.replace(/\.[cm]?[jt]sx?$/, '');
}
