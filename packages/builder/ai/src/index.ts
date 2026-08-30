// @craftkit/builder-ai — headless layer 2. AI proposes validated kernel commands;
// it never constructs or replaces a BuilderDocument.

export {
  BUILDER_AI_CONTEXT_PROVIDERS,
  assembleAiContext,
  blockCatalogContextProvider,
  builderAiContextExtension,
  documentShapeContextProvider,
  estimateContextTokens,
  selectionContextProvider,
  type AssembleAiContextOptions,
} from './context';
export {
  AI_PLAN_WIRE_VERSION,
  LocalAiProviderError,
  RemoteAiProviderError,
  createLocalAiPlanProvider,
  createRemoteAiPlanProvider,
  type AiPlanWireAttempt,
  type AiPlanWireRequest,
  type AiPlanWireResponse,
  type AiPlanWireStatus,
  type RemoteAiPlanProviderOptions,
} from './provider';
export {
  AiPlanRejectedError,
  applyAiPlan,
  assertValidAiPlan,
  generateAiPlan,
  previewAiPlan,
  validateAiPlan,
  type AppliedAiPlan,
  type ApplyAiPlanOptions,
  type GenerateAiPlanOptions,
  type PreviewAiPlanOptions,
} from './plan';
export {
  type AiBlockContext,
  type AiBlockExampleContext,
  type AiBlockSlotContext,
  type AiDocumentContext,
  type AiDocumentNodeContext,
  type AiPlan,
  type AiPlanProvider,
  type AiPlanStep,
  type AiPlanValidationIssue,
  type AiPlanValidationResult,
  type AiProposeOptions,
  type AiSelectedNodeContext,
  type AiSelectionContext,
  type AiValidationPorts,
  type AssembledAiContext,
} from './types';
