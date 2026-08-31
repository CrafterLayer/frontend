// @craftkit/builder-core — the kernel implementation: sealed store, one validated
// dispatch door, deterministic ports, contribution catalogs. The raw store and its
// write path are deliberately NOT exported (Law S).

export {
  createBuilder,
  emptyDocument,
  GROUPED_DISPATCH_LABEL_MAX_LENGTH,
  PERSIST_COALESCE_EVERY,
  type BuilderKernel,
  type GroupedDispatchOptions,
  type GroupStep,
  type CreateBuilderOptions,
} from './kernel/create-builder';
export { openDocument, type OpenDocumentOptions } from './kernel/open-document';
export { type ExtensionManagerHandle } from './extensions/manager';

export { defineCommand } from './commands/define-command';
export {
  coreCommands,
  insertedNodeId,
  type CoreCommandName,
  type CoreCommands,
} from './commands/core-commands';

export { applyPatchSet } from './patches/apply';
export { TYPING_MERGE_WINDOW_MS } from './history/history';

export { systemClock } from './ports/system-clock';
export { systemIds } from './ports/system-ids';
