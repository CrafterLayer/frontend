export {
  PAGE_PLAN_INTENTS,
  PAGE_PLAN_MAX_FACTS,
  PAGE_PLAN_MAX_IMAGES_PER_SECTION,
  PAGE_PLAN_MAX_NAV_ITEMS,
  PAGE_PLAN_MAX_SECTION_CLAIMS,
  PAGE_PLAN_MAX_SECTIONS,
  PAGE_PLAN_MIN_SECTIONS,
  PAGE_PLAN_BUSINESS_TYPES,
  PAGE_PLAN_RADII,
  PAGE_PLAN_SEO_KEYWORD_MAX,
  PAGE_PLAN_SEO_KINDS,
  SECTION_ROLES,
  type LandedSection,
  type LandedSections,
  type PagePlan,
  type PagePlanCandidate,
  type PagePlanFact,
  type PagePlanFont,
  type PagePlanIntent,
  type PagePlanIssue,
  type PagePlanLink,
  type PagePlanLocale,
  type PagePlanNavItem,
  type PagePlanBusinessType,
  type PagePlanRadius,
  type PagePlanSeo,
  type PagePlanSeoKind,
  type PagePlanTokens,
  type PagePlanValidationResult,
  type SectionCheckCode,
  type SectionCheckIssue,
  type SectionContract,
  type SectionImage,
  type SectionRole,
  type ValidatePagePlanOptions,
} from './types';
export { PAGE_PLAN_PALETTE_HEX } from './palette';
export { validatePagePlan } from './validate-page-plan';
export {
  PAGE_SKELETON_LABEL,
  skeletonFromPlan,
  type SkeletonFromPlanContext,
  type SkeletonFromPlanResult,
  type SkeletonRegion,
} from './skeleton-from-plan';
export { checkSection } from './check-section';
export { NEIGHBOUR_SUMMARY_MAX_CHARS, summarizeNeighbours } from './neighbours';
export { planAiPage } from './plan-ai-page';
// p5-plan-stream additions (2026-10-05): the streamed build's building blocks (DESIGN §5.3, §5.4, §6.1).
export {
  createPlanStreamReader,
  type PlanStreamEvent,
  type PlanStreamReader,
} from './plan-stream';
export {
  briefArrived,
  provisionalCandidate,
  reconcilePlans,
  sectionFingerprint,
  startPlanDraft,
  withBrief,
  type PlanDraft,
  type PlanReconciliation,
} from './plan-draft';
export {
  PAGE_SKELETON_FINISH_LABEL,
  skeletonFinish,
  type SkeletonFinishInput,
  type SkeletonFinishResult,
} from './skeleton-from-plan';
export { expandCompactPagePlan } from './compact-plan';
// end p5-plan-stream additions
