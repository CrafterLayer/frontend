/*
  The SITE pipeline: five stages, validated between each, producing commands.

  It writes nothing. `generateSite` is handed no kernel and returns steps, which
  the caller sends through the same door a plan goes through — which is what
  makes "a failure at stage four leaves the workspace byte-identical" true by
  construction rather than by care.
*/

export {
  SITE_STAGES,
  SITE_STAGE_WIRE_VERSION,
  stageId,
  type AssemblyRequest,
  type AssemblyResponse,
  type ContentRequest,
  type ContentResponse,
  type ContentSection,
  type DesignSystemRequest,
  type DesignSystemResponse,
  type RequestFor,
  type ResponseFor,
  type SiteStage,
  type SitemapPage,
  type SitemapRequest,
  type SitemapResponse,
  type StageEnvelope,
  type StageLimits,
  type StageRequest,
  type StageResponse,
  type StructurePage,
  type StructureRequest,
  type StructureResponse,
  type StructureSection,
  type AssemblyStep,
} from './wire';
export type { SiteStageProvider, StageOptions } from './stage-provider';
export { StageRejectedError, isStageRejected } from './stages/errors';
export { validateSitemap } from './stages/sitemap';
export { validateStructure } from './stages/structure';
export { validateContent } from './stages/content';
export { validateStageDesignSystem } from './stages/design-system';
export { validateAssembly } from './stages/assembly';
export {
  createOfflineSiteStageProvider,
  type OfflineStageProviderOptions,
} from './offline/offline-stage-provider';
export {
  RemoteStageError,
  createRemoteSiteStageProvider,
  type RemoteStageProviderOptions,
} from './remote-stage-provider';
export {
  generateSite,
  type GenerateSiteOptions,
  type GeneratedSite,
  type StageEvent,
} from './generate-site';
/*
  The consuming half. `generateSite` writes nothing; these two are what turn its
  commands into a site — through the door, one command at a time into a draft,
  then onto the live site as ONE transaction.
*/
export {
  applySiteCommands,
  commitGeneratedSite,
  type AppliedSiteCommand,
  type ApplySiteCommandsOptions,
  type ApplySiteCommandsResult,
  type CommitGeneratedSiteOptions,
  type CommitGeneratedSiteResult,
  type SiteCommandRefusal,
} from './apply-site';
