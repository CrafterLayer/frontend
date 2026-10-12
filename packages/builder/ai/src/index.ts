// @craftkit/builder-ai — headless layer 2. AI proposes validated kernel commands;
// it never constructs or replaces a BuilderDocument.

export {
  DEFAULT_AI_BUILD_BUDGET_MS,
  DEFAULT_AI_BUILD_MAX_TASKS,
  DEFAULT_AI_BUILD_TASK_TIMEOUT_MS,
  runAiAgent,
  runAiBuild, SCENE_PROBE_TIMEOUT_MS, isProbedScene, sceneProbeIssues, type SceneProbe, type SceneProbeContext, type SceneProbeReport, // creative-power Phase 2 E
  type AiAgentEvent,
  type AiAgentEventBase,
  type AiAgentPolicy,
  type AiAgentRunResult,
  type AiAgentRunState,
  type AiBuildEvent,
  type AiBuildEventBase,
  type AiBuildOutcome,
  type AiBuildOwnEvent,
  type AiBuildRunResult,
  type AiBuildStopReason,
  type AiBuildPlannedTask,
  type AiBuildTask,
  type AiBuildTaskReport,
  type AiBuildTaskStatus,
  type AiBuildOutOfScopeStep,
  type AiBuildSectionKey,
  type AiBuildSectionLanding,
  type AiBuildSectionValues,
  type AiBuildUnfilledSection,
  AiBuildRevertError,
  REMOVE_UNFILLED_SECTIONS_LABEL,
  removeUnfilledSections,
  revertBuildSection,
  type AiBuildRevertErrorCode,
  type AiBuildUnfilledRemoval,
  classifyAiRunFailure,
  type AiRunFailure,
  type AiRunFailureCode,
  type AiRunFailureSource,
  type RunAiAgentOptions,
  type RunAiBuildOptions,
  /*
    The PAGE PLAN contract (agent-audit §3.2, 2026-09-28): one structured,
    editable design of a page that Plan mode shows, Ask approves and Build
    consumes verbatim. `validatePagePlan` is the only way to get a `PagePlan`;
    `skeletonFromPlan`, `checkSection`, `summarizeNeighbours` and `planAiPage`
    are the orchestration's steps T2, E, the writers' context and T1.
  */
  fillConcurrencyFor, createAiWriterPool, MAX_AI_BUILD_AUTO_FILL_CONCURRENCY, type AiBuildWriterOptions, type AiWriterPermit, type AiWriterPool, // T230: one writers' pool across a site's pages
  type AiBuildPlanAnswer,
  type AiBuildSectionCheck,
  type AiBuildSkipReasonCode,
  type AiBuildTaskFact,
  type AiPagePlanEvent,
  type PlanAiPage,
  type PlanAiPageOptions,
  type PlanAiPageResult, AI_SITE_MAX_PAGES, AI_SITE_MAX_REQUEST_LENGTH, AI_SITE_MAX_TITLE_LENGTH, AI_SITE_MIN_PAGES, planAiSite, sitePlanFromRequest, validateSitePlan, type AiSitePage, type AiSitePlan, type PlanAiSiteOptions, type SiteFromWordsOptions, type ValidateSitePlanResult, // T230: a site plan
  NEIGHBOUR_SUMMARY_MAX_CHARS,
  PAGE_PLAN_INTENTS,
  PAGE_PLAN_MAX_FACTS,
  PAGE_PLAN_MAX_IMAGES_PER_SECTION,
  PAGE_PLAN_MAX_NAV_ITEMS,
  PAGE_PLAN_MAX_SECTION_CLAIMS,
  PAGE_PLAN_MAX_SECTIONS,
  PAGE_PLAN_MIN_SECTIONS,
  PAGE_PLAN_PALETTE_HEX,
  PAGE_PLAN_RADII,
  PAGE_SKELETON_LABEL,
  SECTION_ROLES,
  checkSection,
  planAiPage,
  skeletonFromPlan,
  summarizeNeighbours,
  validatePagePlan,
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
  type PagePlanRadius,
  type PagePlanTokens,
  type PagePlanValidationResult,
  type SectionCheckCode,
  type SectionCheckIssue,
  type SectionContract,
  type SectionImage,
  type SectionRole,
  type SkeletonFromPlanContext,
  type SkeletonFromPlanResult,
  type SkeletonRegion,
  type ValidatePagePlanOptions,
} from './agent';
export {
  RUN_COORDINATOR_VERSION,
  RunCoordinatorError,
  createMemoryRunJournal,
  createRunCoordinator,
  type BeginRunUnitInput,
  type CompleteRunUnitInput,
  type CompletedUnitJournalInput,
  type CreateMemoryRunJournalOptions,
  type CreateRunCoordinatorOptions,
  type QueueRunRequestInput,
  type QueuedRunRequest,
  type RunCancellationScope,
  type RunCoordinator,
  type RunCoordinatorErrorCode,
  type RunJournalPort,
  type RunRevalidationInput,
  type RunRevalidationPort,
  type RunRevalidationResult,
  type RunUnitLease,
  type StartRunInput,
} from './agent/run-coordinator';
export {
  BUILDER_AI_CONTEXT_PROVIDERS,
  assembleAiContext,
  blockCatalogContextProvider,
  builderAiContextExtension,
  documentShapeContextProvider,
  AI_MEMORY_MAX_COMMAND_NAME_LENGTH,
  AI_MEMORY_MAX_COMMAND_NAMES,
  AI_MEMORY_MAX_RECORDS,
  AI_MEMORY_MAX_SUMMARY_LENGTH,
  AiMemoryContextError,
  blockIsInCatalogScope,
  createMemoryContextProvider,
  estimateAssembledAiContextTokens,
  estimateContextTokens,
  resolveAiCompositionPolicy,
  selectionContextProvider,
  templateCatalogContextProvider,
  type AiCatalogMode,
  type AiCompositionPolicy,
  type AssembleAiContextOptions,
  type ResolvedAiCompositionPolicy,
  type AiMemoryRecordKind,
  type AiMemoryRecordV1,
  type MemoryContextProviderOptions,
  PHOTO_CATALOG,
  PHOTO_CATALOG_FRAGMENT_TITLE,
  PHOTO_CATALOG_MAX_PHOTOS,
  PHOTO_CATALOG_PROVIDER_ID,
  PHOTO_CATALOG_VERIFIED_AT,
  PHOTO_TOPIC_KEYWORDS,
  PhotoCatalogError,
  createPhotoCatalogContextProvider,
  isCatalogPhotoUrl,
  selectCatalogPhotos,
  type CatalogPhoto,
  type PhotoCatalogContextProviderOptions,
  type PhotoCatalogEntry,
  type PhotoOrientation,
  type PhotoPeople,
  type PhotoTone,
  type PhotoTopic,
  type SelectCatalogPhotosOptions,
} from './context';
export {
  CONTEXT_INDEX_VERSION,
  ContextIndexError,
  buildProjectIndex,
  createContextIndex,
  type ContextIndex,
  type ContextIndexErrorCode,
  type CreateContextIndexInput,
  type IndexedSelectionContext,
  type ProjectIndex,
  type ProjectIndexFile,
  type ProjectIndexPage,
  type SelectionNodeContext,
  type SelectionSourceContext,
} from './context/context-index';
export {
  SITE_TOOL_NAMES,
  SITE_TOOL_PROTOCOL_VERSION,
  SiteToolValidationError,
  registerSiteTools,
  type ApplyModulePatchInput,
  type ApplyModulePatchOutput,
  type CommitDraftInput,
  type CommitDraftOutput,
  type CompilePreviewInput,
  type CompilePreviewOutput,
  type EditElementInput,
  type EditElementOutput,
  type GetProjectIndexInput,
  type GetSelectionContextInput,
  type InspectPreviewInput,
  type InspectPreviewOutput,
  type InsertSectionInput,
  type InsertSectionOutput,
  type ModuleFileChange,
  type PageOperationName,
  type PageOperationsInput,
  type PageOperationsOutput,
  type ResolveComponentInput,
  type ResolveComponentOutput,
  type SiteToolDefinition,
  type SiteToolExecutionContext,
  type SiteToolHandlers,
  type SiteToolInputMap,
  type SiteToolName,
  type SiteToolOutputMap,
  type SiteToolRegistry,
} from './tools';
export {
  AI_PLAN_WIRE_MAX_INVALID_OUTPUT_MESSAGE_LENGTH,
  AI_PLAN_WIRE_VERSION,
  LOCAL_AI_MAX_COLLECTION_ITEMS,
  AiProviderError,
  LocalAiProviderError,
  RemoteAiProviderError,
  createCachingAiPlanProvider,
  createDirectPlanProvider,
  createLocalAiPlanProvider,
  createRemoteAiPlanProvider,
  estimateAiPlanWireRequestTokens,
  isAiProviderError,
  boundAiPlanWireInvalidOutputMessage,
  type AiProviderErrorCode,
  type AiProviderErrorDetails,
  type CachingAiPlanProviderOptions,
  type DirectAiPlanCatalogEntry,
  type DirectAiPlanProviderOptions,
  type AiPlanWireAttempt,
  type AiPlanWireInvalidOutputResponse,
  type AiPlanWireRequest,
  type AiPlanWireResponse,
  type AiPlanWireStatus,
  type RemoteAiPlanProviderOptions,
} from './provider';
// The page-plan task on the same /plan endpoint (additive; absent `task` = today's plan).
export {
  readAiPagePlanWireResponse,
  type AiPagePlanWireAttempt,
  type AiPagePlanWireReading,
  type AiPagePlanWireResponse,
  type AiPagePlanWireResult,
  type AiPlanWireTask,
} from './provider/wire'; export { AI_SITE_PLAN_WIRE_MAX_PAGES, aiSitePlanWireRequest, readAiSitePlanWireResponse, type AiSitePlanWireReading, type AiSitePlanWireResponse, type AiSitePlanWireResult } from './provider/site-plan-wire'; // T230: the site-plan task
export {
  DEFAULT_AI_CONTEXT_TOKEN_BUDGET,
  AiContextBudgetError,
  AiPlanRejectedError,
  applyAiPlan,
  assertValidAiPlan,
  generateAiPlan,
  AI_PLAN_MODE_SKILL_ID,
  outlineAiPlan,
  previewAiPlan,
  salvageAiPlan,
  validateAiPlan,
  type DroppedAiPlanStep,
  type AiOutline,
  type OutlineAiPlanOptions,
  type SalvagedAiPlan,
  type AppliedAiPlan,
  type ApplyAiPlanCompatibilityOptions,
  type ApplyAiPlanOptions,
  type ApplyAiValidatedProposalOptions,
  type GenerateAiPlanOptions,
  type PreviewAiPlanOptions,
  type PreviewAiPlanCompatibilityOptions,
  type PreviewAiValidatedProposalOptions,
  AiValidatedProposalError,
  type AiPinnedCommandPolicy,
  type AiValidatedProposal,
  type AiValidatedProposalErrorCode,
} from './plan';
export {
  AI_SKILL_MAX_INSTRUCTION_BYTES,
  AI_SKILL_MAX_MANIFEST_METADATA_BYTES,
  AI_SKILL_MAX_METADATA_ENTRY_BYTES,
  AI_SKILL_MAX_REFERENCES,
  AI_SKILL_MAX_REFERENCE_BYTES,
  AI_SKILL_MAX_REGISTRY_SIZE,
  AI_SKILL_MAX_TOTAL_REFERENCE_BYTES,
  CRAFTKIT_AI_SKILL_DEFINITIONS, CRAFTKIT_DEFAULT_SKILLS,
  DEFAULT_AI_MAX_COMMANDS,
  DEFAULT_AI_MAX_OPERATIONS,
  DEFAULT_AI_SKILL_MAX_ACTIVE,
  DEFAULT_AI_SKILL_TOKEN_BUDGET,
  AiCommandPolicyError,
  AiSkillRegistryError,
  AiSkillResolutionError,
  createAiSkillRegistry,
  createCraftkitAiSkillRegistry,
  defineAiSkill,
  resolveAiCommandPolicy,
  resolveAiSkills,
  type AiActiveSkillContext,
  type AiCommandPolicy,
  type AiDefinedSkillV1,
  type AiEffectiveCommandPolicy,
  type AiPreparedSkillContext,
  type AiSkillActivation,
  type AiSkillActivationPin,
  type AiSkillActivationReason,
  type AiSkillDefinitionV1,
  type AiSkillManifestV1,
  type AiSkillOmission,
  type AiSkillOmissionCode,
  type AiSkillPrepareOptions,
  type AiSkillRegistry,
  type AiSkillSource,
  type AiSkillTrust,
  type ResolveAiCommandPolicyOptions,
} from './skills';
export {
  type AiBlockContext,
  type AiBlockExampleContext,
  type AiBlockPropertyIntentContext,
  type AiBlockSlotContext,
  type AiCommandContext,
  type AiContextOmission,
  type AiDocumentContext,
  type AiDocumentNodeContext,
  type AiPagePlanAttempt,
  type AiPagePlanProposal,
  type AiPlan,
  type AiPlanOutputContract,
  type AiPlanProvider,
  type AiProposePagePlanOptions, type AiProposeSitePlanOptions, type AiSitePlanProposal, type AiSitePlanProposalPage, // T230: the provider's site plan
  type AiPagePlanDraftEvent, // P3-client-wire addition (fast page build, DESIGN §5.2)
  type AiPlanStep,
  type AiChatTurn,
  type AiPlanValidationIssue,
  type AiPlanValidationResult,
  type AiProposeOptions,
  type AiProviderUsage,
  type AiSelectedNodeContext,
  type AiSelectionContext,
  type AiTemplateContext,
  type AiValidationPorts,
  type AssembledAiContext,
} from './types';

/*
  The two primitives a FINGERPRINT is made of, exported because more than this
  package needs to take one.

  The vault fingerprints a site at the start of a run so a stale commit can be
  refused before it writes; this package fingerprints a context and a proposal
  for the same reason at a different scale. Those must agree byte for byte —
  a second implementation of "canonical JSON" or "sha-256" is a second answer
  to the same question, and the day the two drifted a stale draft would land
  because two hashers disagreed about key order.
*/
export { canonicalJsonStringify } from './internal/canonical-json';
export { sha256Hex } from './skills/sha256';
export { DESIGN_LIBRARY_TEACHING, DESIGN_QUALITY_TEACHING } from './skills/design-libraries';
export { AUTHORED_DESIGN_TEACHING } from './skills/authored-design';
export {
  PIXI_CREATIVE_SKILLS,
  PIXI_GAME_EXAMPLE,
  PIXI_GAME_CONTROLS,
  PIXI_STORY_EXAMPLE,
  PIXI_STORY_CONTROLS,
  PIXI_MURAL_EXAMPLE,
} from './skills/creative/pixi-creative';
export { pixiSkillIdsFor } from './skills/creative/pixi-selection';
// creative agent (2026-10-12): engine playbooks, the planner and the story bible.
export {
  CREATIVE_ANIMATION_EXAMPLE,
  CREATIVE_DIALOGUE_EXAMPLE,
  CREATIVE_EFFECTS_EXAMPLE,
  CREATIVE_ENGINE_SKILLS,
  CREATIVE_INK_EXAMPLE,
  CREATIVE_TILEMAP_CONTROLS,
  CREATIVE_TILEMAP_EXAMPLE,
  CREATIVE_ANIMATION_CONTROLS,
  CREATIVE_EFFECTS_CONTROLS,
} from './skills/creative/creative-engines';
export * from './creative';

/*
  The quality gate's DOM-FREE half: one implementation, two callers.

  The playground runs these against a draft before a commit is allowed, and CI
  runs them over generated documents with fixed seeds. Overflow and overlap are
  NOT here — they need layout, so they live in the playground behind a hidden
  iframe at four widths.
*/
export {
  blocks,
  briefTerms,
  checkDocumentContrast,
  checkDocumentQuality,
  checkQuality,
  measureBriefRelevance,
  type BriefRelevance,
  type CheckDocumentOptions,
  type QualityCheck,
  type QualityIssue,
  type QualityReport,
  type QualitySeverity,
} from './quality';

/*
  The SITE pipeline: five stages, validated between each, producing COMMANDS.

  It writes nothing and is handed no kernel, which is what makes "a failure at
  stage four leaves the workspace byte-identical" true by construction. The
  caller sends its commands through the same door a plan goes through.
*/
export {
  SITE_STAGES,
  SITE_STAGE_WIRE_VERSION,
  RemoteStageError,
  StageRejectedError,
  applySiteCommands,
  commitGeneratedSite,
  createOfflineSiteStageProvider,
  createRemoteSiteStageProvider,
  generateSite,
  isStageRejected,
  stageId,
  validateAssembly,
  validateContent,
  validateSitemap,
  validateStageDesignSystem,
  validateStructure,
  type AppliedSiteCommand,
  type ApplySiteCommandsOptions,
  type ApplySiteCommandsResult,
  type AssemblyRequest,
  type AssetCatalogueEntry,
  type AssemblyResponse,
  type AssemblyStep,
  type CommitGeneratedSiteOptions,
  type CommitGeneratedSiteResult,
  type SiteCommandRefusal,
  type ContentRequest,
  type ContentResponse,
  type ContentSection,
  type DesignSystemRequest,
  type DesignSystemResponse,
  type GenerateSiteOptions,
  type GeneratedSite,
  type OfflineStageProviderOptions,
  type RemoteStageProviderOptions,
  type RequestFor,
  type ResponseFor,
  type SiteStage,
  type SiteStageProvider,
  type SitemapPage,
  type SitemapRequest,
  type SitemapResponse,
  type StageEnvelope,
  type StageEvent,
  type StageLimits,
  type StageOptions,
  type StageRequest,
  type StageResponse,
  type StructurePage,
  type StructureRequest,
  type StructureResponse,
  type StructureSection,
} from './pipeline';

/*
  REFINEMENT: a follow-up that changes its target and nothing else.

  There is no second write path in it. A page refinement is `runAiAgent`
  pointed at that page's lens — the identical machinery a generation uses — and
  a colour refinement goes through `setDesignToken`, the door that already owns
  legibility. Resolution is separate and pure, so a request naming a page the
  site does not have is refused before a model is asked anything at all.
*/
export {
  refineSite,
  type RefineAdjustment,
  type RefineSiteOptions,
  type RefineSiteResult,
} from './refine/refine-site';
export {
  resolveRefineTarget,
  type RefineTarget,
  type ResolveTargetResult,
} from './refine/resolve-target';

/*
  INTENT ROUTING: what a request is FOR — build a page, build a site, add a
  section, edit, or answer — decided by rules before any model is asked.

  Exported from the engine rather than the host because the decision belongs
  to the engine: it replaced the panel's keyword-substring routing, which sent
  8 of 12 measured edits into a full-page build and missed 14 of 17 page asks
  (agent-audit §2 P0-1 / P1-5, 2026-09-28). The router is pure and reads a
  page SUMMARY, so a host summarises its document once and routes with it.
*/
export {
  INTENT_KINDS,
  isBuildIntent,
  normalizeArabic,
  normalizeIntentText,
  routeIntent,
  summarizeDocumentForIntent,
  type IntentDocumentSummary,
  type IntentKind,
  type IntentRoute,
  type IntentTarget,
  type RouteIntentInput,
} from './intent';

/*
  ASSET SELECTION: which picture goes where, chosen from a library.

  Exported from the engine rather than the host because the rule it enforces is
  the engine's: an image position holds a real library asset or a labelled
  absence, and there is no path through it that produces an address a model
  wrote (FR-045).
*/
export {
  scoreAsset,
  selectAssets,
  type AssetChoice,
  type AssetPosition,
  type SelectAssetsRequest,
  type SelectAssetsResult,
} from './assets/select-assets';

// orchestration-2 additions
/*
  Why a build that tried a page plan fell back to the model-written skeleton
  (`AiBuildRunResult.planFallback`, and `fallback` on the second
  `build.scaffolding` event). From the module itself: the agent barrel is
  another owner's file.
*/
export type { AiBuildPlanFallback } from './agent/types';
// end orchestration-2 additions

// provider-chain additions
/*
  The page plan over the remote wire, and the prompt enhancer (2026-09-28).
  `planAiPage` above now resolves to the real Plan-mode run
  (agent/page-plan/plan-ai-page.ts re-exports agent/plan-page.ts); the stub it
  replaced rejected every call. `AiTaskUnsupportedError` is what a remote
  provider throws when its server predates the page-plan task or the enhance
  route. `enhanceRequest` rewrites a draft through `AiPlanProvider.enhancePrompt`
  when the provider has it (`canEnhance`), else tidies it deterministically.
*/
export {
  AiTaskUnsupportedError,
  isAiTaskUnsupportedError,
  type AiRemoteTask,
} from './provider/remote-provider';
export {
  AI_PROMPT_ENHANCE_MAX_CHANGES,
  AI_PROMPT_ENHANCE_MAX_CHOICES,
  AI_PROMPT_ENHANCE_MAX_QUESTIONS,
  AI_PROMPT_ENHANCE_MAX_SECTIONS,
  AI_PROMPT_ENHANCE_PATH,
  aiPromptEnhanceWireRequest,
  readAiPromptEnhanceWireResponse,
  type AiPromptEnhanceWireReading,
  type AiPromptEnhanceWireRequest,
  type AiPromptEnhanceWireResponse,
} from './provider/wire';
export type {
  AiEnhancePromptOptions,
  AiPromptEnhanceAnswer,
  AiPromptEnhanceInput,
  AiPromptEnhanceIntent,
  AiPromptEnhancePage,
  AiPromptEnhanceQuestion,
  AiPromptEnhancement,
  AiPromptLocale,
} from './types';
export {
  canEnhance,
  detectPromptLanguage,
  enhanceRequest,
  tidyRequest,
  tidyRequestText,
  type EnhanceRequestOptions,
  type EnhanceRequestSource,
  type EnhancedRequest,
  type TidiedRequest,
  type TidyFix,
} from './prompt-enhance';
// end provider-chain additions

// fast-edits additions
/*
  Small edits made instant and nearly free (2026-09-28: the owner's one-word
  CV title change showed "~11.3k tokens" and took 46 s). `tryDirectEdit` makes
  a small edit stated in full with no model (runAiAgent tries it first unless
  `directEdits: false`); `resolveDocumentFocus` is how a run picks the
  sections an edit sees whole (`AiCompositionPolicy.documentFocus`, declared
  in context/document-tree-mode.ts). From the modules themselves: the agent
  and context barrels are other owners' files.
*/
export {
  tryDirectEdit,
  type DirectEdit,
  type DirectEditChange,
  type DirectEditRole,
  type DirectEditTarget,
  type TryDirectEditOptions,
} from './plan/direct-edit';
export {
  namedSection,
  outlinePageSections,
  resolveDocumentFocus,
  type AiDocumentFocus,
  type PageSectionOutline,
} from './context/document-tree-mode';
export {
  assembleDirectEditContext,
  DOCUMENT_FOCUS_FRAGMENT_SOURCE,
} from './context/assemble-context';
export type {
  AiDirectEditReport,
  AiEditEffort,
  AiRunModelChoice,
  AiRunSource,
} from './agent/types';
// end fast-edits additions

// seo additions (2026-09-30): agent SEO (DESIGN D.3) — checkSeo (advisory
// quality issues with fixes), the one-transaction safe auto-fix plan, alt text
// from the photo catalog, and the seo.* agent tools.
export {
  SEO_AUTOFIX_LABEL,
  SEO_TOOLS,
  altFor,
  checkSeo,
  seoAutofixPlan,
  seoAutofixSteps,
  type CheckSeoOptions,
  type SeoAutofixOptions,
  type SeoIssue,
  type SeoSitePage,
} from './seo';
export { isSeoCheck } from './quality';
// end seo additions
// agent-tools additions (2026-09-30): tool steps inside the one plan, expanded before the door (DESIGN.md §A).
export {
  AGENT_TOOL_COMMAND,
  AGENT_TOOL_LANES,
  defineAgentTool,
  type AgentTool,
  type AgentToolContext,
  type AgentToolLane,
  type AgentToolParse,
  type AgentToolRun,
  type AgentToolStep,
} from './tools/agent/types';
export { AGENT_TOOLS, agentTool, agentToolsForLane } from './tools/agent/registry';
export {
  expandAgentTools,
  type AgentToolExpansion,
  type AgentToolExpansionOptions,
} from './tools/agent/expand';
export { AGENT_TOOL_PROMPT_MAX_CHARS, agentToolPrompt } from './tools/agent/catalog-prompt';
export { tryDirectTool, type DirectToolResult } from './tools/agent/direct-tool';
// end agent-tools additions
// section-kit additions (2026-09-30): the section kit (DESIGN.md §B) — kits vendored from HyperUI,
// Tailark and Meraki UI, filled from slots by code; kit.section / kit.swap / kit.insert tools.
export {
  KIT_INDEX_MAX_CHARS,
  SECTION_KITS,
  SECTION_KIT_ROLES,
  SECTION_KIT_TOOLS,
  checkKitSlots,
  defaultKitForVariant,
  instantiateKit,
  kitIdOfTree,
  kitIndex,
  readKitSlots,
  sectionKit,
  type InstantiateKitOptions,
  type InstantiateKitResult,
  type KitTree,
  type SectionKit,
  type SectionKitRole,
  type SectionKitSlot,
} from './section-kit';
// end section-kit additions
// ── P11-integration (style-manager DESIGN.md §D.3, §A.9) ──
// The style tools (registered into AGENT_TOOLS only after the colour-target
// agent agrees: tools/* is theirs) and "Convert to editable".
export { STYLE_AGENT_TOOLS } from './style-tools';
export {
  detachBlockToCustomCode,
  detachFidelity,
  getBlockMarkupRenderer,
  planBlockDetach,
  setBlockMarkupRenderer,
  type BlockMarkupRenderer,
  type DetachOptions,
  type DetachResult,
} from './editing';
// ── end P11-integration ──
// ── media-motion (2026-10-06): media.add, motion.add and their zero-token readings (DESIGN §F) ──
export {
  catalogImages,
  heroRegionId,
  MEDIA_AGENT_TOOLS,
  MEDIA_KINDS,
  mediaAddTool,
  motionAddTool,
  readMedia,
  resolveImages,
  resolveVideo,
  VIDEO_MODES,
  type MediaAddInput,
  type MediaKind,
  type MediaReading,
  type MotionAddInput,
  type VideoMode,
} from './media-tools';
// media-motion (2026-10-06, fix pass): the 0-token question a video with no link gets.
export {
  AiNeedsInputError,
  isAiNeedsInputError,
  type AiNeedsInputWords,
} from './agent/needs-input';
export { askMedia, type MediaQuestion } from './media-tools/direct-media';
export {
  AGENT_TOOL_PROMPT_LANE_MAX_CHARS,
  agentToolPromptMaxChars,
} from './tools/agent/catalog-prompt';
// ── end media-motion ──
// script-servers additions (2026-10-08): `editTree` expansion for a headless host that runs the
// editor's own pre-door order (script.run → tools → editTree), e.g. mcp-server craftkit_apply_plan.
export { EDIT_TREE_COMMAND, expandTreeEdits, type TreeEditExpansion } from './plan/tree-edits';
// end script-servers additions
// script-wiring additions (2026-10-08): code mode's cross-page sidecar and the run's site
// (agent-script DESIGN §A.9) — a script's writes to other pages ride beside the validated plan.
export {
  attachScriptCrossPage,
  planHasScriptStep,
  scriptCrossPage,
  scriptCrossPageFollowUp,
  scriptPagesTouched,
  type AiPlanSite,
  type ScriptCrossPage,
  type ScriptCrossPageStep,
  type ScriptCrossPageWrite,
} from './script/cross-page';
export type { AiAgentScriptSite } from './agent/types';
// end script-wiring additions
// script-host additions (2026-10-08): code mode (agent-script DESIGN §A) — the engine plus the host side:
// element index, call → tool-step mapping, coalescing, expandScriptSteps, SCRIPT_CARD, prefersScript, directScript.
export * from './script';
export * from './i18n-tools'; // i18n (2026-10-12): page.translate, language intent, language pages
// end script-host additions
// library-playground additions (2026-10-08): the page kit as data (agent-script DESIGN §B.5) — a
// host writes a Library section's page kit with the SAME function the skeleton writes it with.
export {
  hasKitBlock,
  readPageKit,
  writePageKit,
  type KitColours,
  type PageKitState,
} from './tools/agent/page-kit';
// end library-playground additions
// free-code additions (2026-10-09): free code mode — the card the model reads for a customCode block's `js` (the ai-server carries a verbatim copy), the line a request for code gets while the switch is off, the door's limit.
export {
  FREE_CODE_CARD,
  FREE_CODE_CARD_MAX_CHARS,
  FREE_CODE_OFF_HINT,
  freeCodeCardExamples,
} from './agent/free-code-card';
export { CUSTOM_CODE_JS_MAX_LENGTH } from './plan/validate-plan';
// end free-code additions
export * from './batch'; // background batches (2026-10-12): Message Batches jobs — runner, HTTP client, wire, store port
