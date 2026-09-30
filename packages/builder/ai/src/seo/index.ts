/*
  Agent SEO (DESIGN D.3): the checker, the safe auto-fix plan, alt text and
  the four seo.* agent tools. The pure core (meta widths, slugs, JSON-LD, the
  head, sitemap) lives in @craftkit/builder-schema.
*/
export {
  checkSeo,
  collectSeo,
  describedLinkText,
  effectiveLang,
  isSampleValue,
  type CheckSeoOptions,
  type CollectedSeoIssue,
  type SeoIssue,
  type SeoSitePage,
} from './check-seo';
export {
  SEO_AUTOFIX_LABEL,
  seoAutofixPlan,
  seoAutofixSteps,
  seoSafeEdits,
  type SeoAutofixOptions,
} from './autofix';
export { PHOTO_TOPIC_LABELS, altFor, catalogEntryFor, type AltImage } from './alt-text';
export { editsToSteps, type SeoEdit } from './fixes';
export { SEO_TOOLS, type SeoMetaToolInput, type SeoSchemaToolInput } from './tools';
