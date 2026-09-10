export {
  BUILDER_AI_CONTEXT_PROVIDERS,
  assembleAiContext,
  blockCatalogContextProvider,
  documentShapeContextProvider,
  estimateAssembledAiContextTokens,
  estimateContextTokens,
  selectionContextProvider,
  templateCatalogContextProvider,
  type AssembleAiContextOptions,
} from './assemble-context';
export {
  blockIsInCatalogScope,
  resolveAiCompositionPolicy,
  type AiCatalogMode,
  type AiCompositionPolicy,
  type ResolvedAiCompositionPolicy,
} from './composition-policy';
export { builderAiContextExtension } from './manifest';
export {
  AI_MEMORY_MAX_COMMAND_NAME_LENGTH,
  AI_MEMORY_MAX_COMMAND_NAMES,
  AI_MEMORY_MAX_RECORDS,
  AI_MEMORY_MAX_SUMMARY_LENGTH,
  AiMemoryContextError,
  createMemoryContextProvider,
  type AiMemoryRecordKind,
  type AiMemoryRecordV1,
  type MemoryContextProviderOptions,
} from './memory-provider';
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
} from './context-index';
