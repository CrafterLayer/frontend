// @craftkit/builder-transforms — pure, headless, layer 2: no DOM, React, kernel,
// or registry implementation enters the codec.
export {
  CANONICAL_JSON_PROJECTION_ID,
  parseDocument,
  parseScope,
  projectDocument,
  projectScope,
  readDocumentText,
  type CodecPorts,
  type DocumentReadResult,
  type ParseResult,
  type ProjectionText,
} from './codec/document-codec';

export { type ParseError } from './codec/strict-parse';

export {
  SITE_MANIFEST_PROJECTION_ID,
  SITE_MANIFEST_VERSION,
  parseSite,
  parseSiteManifest,
  parseSitePage,
  parseSiteRegion,
  projectSite,
  projectSiteManifest,
  projectSitePage,
  projectSiteRegion,
  type SiteProjectionText,
} from './codec/site-codec';

export {
  projectPageRoutes,
  resolveDocumentPageLinks,
  resolvePageHref,
  resolvePageLinks,
  type ResolvedPageRoute,
} from './site/resolve-page-links';
export {
  projectSitemap,
  type ProjectSitemapOptions,
  type SitemapPageProjection,
  type SitemapProjection,
  type SitemapSharedReference,
  type SitemapThumbnail,
} from './site/project-sitemap';
