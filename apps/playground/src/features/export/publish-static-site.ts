import {
  exportStaticSite,
  themeFromDesignSystem,
  type ArtifactFile,
  type BuilderDocument,
  type BuilderSite,
  type ExportStaticSiteOptions,
  type StaticSitePageInput,
} from '@craftkit/builder';

/**
 * Publish the site's kernel (customCode / block) pages as a static website.
 *
 * Code pages are not here: they publish through the code runtime's own
 * revision-pinned exporter ("Export files"). Everything else a person built
 * on the canvas — which, before this, had no way off the canvas at all —
 * becomes plain HTML with the full SEO head, sitemap.xml, robots.txt and a
 * 404 page, via the renderer's `exportStaticSite`.
 */

/** A page this exporter can publish: anything whose root is not a code page. */
export function isStaticPage(document: BuilderDocument): boolean {
  const root = document.nodes[document.rootId];
  return root !== undefined && root.type !== 'codePage';
}

export function hasStaticPages(site: Readonly<BuilderSite>): boolean {
  return site.pages.some((page) => isStaticPage(page.document));
}

/** The attribute `createLiveUtilities` stamps on the one stylesheet it writes. */
export const LIVE_UTILITIES_STYLE_SELECTOR = 'style[data-ck-live-utilities]';

/**
 * `compileCss` over the page's existing live Tailwind compiler.
 *
 * Deliberately not a second Tailwind instance: `useLiveUtilities` already
 * keeps one compiler in sync with every class in every custom-code tree of the
 * site (it `ensure`s on each site change) and writes the result into one
 * `<style>` element. That sheet is therefore already the CSS for every page,
 * scoped to custom-code regions exactly as it is on the canvas.
 */
export function liveUtilitiesCompileCss(
  host: Pick<Document, 'querySelector'> = document,
): (document: BuilderDocument) => Promise<string> {
  return () =>
    Promise.resolve(host.querySelector(LIVE_UTILITIES_STYLE_SELECTOR)?.textContent ?? '');
}

export interface PublishStaticSiteDeps {
  readonly blocks: ExportStaticSiteOptions['blocks'];
  readonly compileCss: ExportStaticSiteOptions['compileCss'];
  /** CSS for exactly these rendered classes: the `compileFor` fallback (see `exportCompilers`). */
  readonly compileClasses?: ExportStaticSiteOptions['compileClasses'];
  /** The published https origin (EXPORT_SITE_ORIGIN / VITE_EXPORT_SITE_ORIGIN). */
  readonly origin?: string | undefined;
  readonly now?: Date;
}

/** Shared header/footer documents a page shows, in site order. */
function regionDocuments(
  site: Readonly<BuilderSite>,
  regions: readonly string[],
  kind: 'header' | 'footer',
): BuilderDocument[] {
  return regions.flatMap((id) => {
    const region = site.sharedRegions[id];
    return region?.kind === kind ? [region.document] : [];
  });
}

export function staticSiteOptions(
  site: Readonly<BuilderSite>,
  deps: PublishStaticSiteDeps,
): ExportStaticSiteOptions {
  const pages: StaticSitePageInput[] = site.pages
    .filter((page) => isStaticPage(page.document))
    .map((page) => ({
      pageId: page.id,
      address: page.address,
      document: page.document,
      title: page.title,
      description: page.purpose,
      before: regionDocuments(site, page.regions, 'header'),
      after: regionDocuments(site, page.regions, 'footer'),
    }));
  const origin = deps.origin?.trim();
  return {
    pages,
    blocks: deps.blocks,
    theme: themeFromDesignSystem(site.designSystem),
    compileCss: deps.compileCss,
    // The site design library: palette variables, fonts, named styles, motion settings.
    ...(site.library === undefined ? {} : { library: site.library }),
    ...(deps.compileClasses === undefined ? {} : { compileClasses: deps.compileClasses }),
    ...(origin === undefined || origin === '' ? {} : { origin }),
    ...(deps.now === undefined ? {} : { now: deps.now }),
  };
}

/** Every file of the published site, in the shape `downloadArtifactFiles` zips. */
export async function publishStaticSite(
  site: Readonly<BuilderSite>,
  deps: PublishStaticSiteDeps,
): Promise<readonly ArtifactFile[]> {
  if (!hasStaticPages(site)) throw new Error('The site has no canvas pages to publish.');
  const { files } = await exportStaticSite(staticSiteOptions(site, deps));
  return files.map(({ path, content }) => ({ path, content }));
}
