// @craftkit/builder-ai — headless layer 2. AI proposes validated kernel commands;
// it never constructs or replaces a BuilderDocument.

export {
  DEFAULT_AI_BUILD_BUDGET_MS,
  DEFAULT_AI_BUILD_MAX_TASKS,
  DEFAULT_AI_BUILD_TASK_TIMEOUT_MS,
  runAiAgent,
  runAiBuild,
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
  classifyAiRunFailure,
  type AiRunFailure,
  type AiRunFailureCode,
  type AiRunFailureSource,
  type RunAiAgentOptions,
  type RunAiBuildOptions,
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
  CRAFTKIT_AI_SKILL_DEFINITIONS,
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
  type AiPlan,
  type AiPlanOutputContract,
  type AiPlanProvider,
  type AiPlanStep,
  type AiChatTurn,
  type AiPlanValidationIssue,
  type AiPlanValidationResult,
  type AiProposeOptions,
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
