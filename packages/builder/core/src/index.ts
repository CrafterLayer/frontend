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

/*
  The SITE door (013, ق١). A separate map and a separate `define` because a site
  command's producer takes a `BuilderSite` and a page command's takes a
  `BuilderDocument`; `isSiteCommandName` is how the site dispatcher routes one
  grouped batch of both into a single production.
*/
/*
  The SITE KERNEL (013, ق١): one store, one transaction log, one history, and N
  page lenses. `page(id)` hands back a full `BuilderKernel`, so every surface
  that already speaks to a kernel works over a site without learning that sites
  exist. The store and its write path stay unexported, exactly as the page
  kernel's do (Law S).
*/
export {
  createSiteBuilder,
  SITE_PERSIST_COALESCE_EVERY,
  type BuilderSiteKernel,
  type CreateSiteBuilderOptions,
} from './site/create-site-builder';
export { liftDocumentSession, openSite, type OpenSiteOptions } from './site/open-site';
export type { SiteGroupStep } from './site/site-dispatcher';
export type { KernelSiteState } from './site/site-store';

export { defineSiteCommand } from './commands/define-site-command';
export type { CodeTransactionResult } from '@craftkit/builder-schema';
export {
  codeProjectCommands,
  applyCodeChangesArgsSchema,
  codeFileChangeSchema,
  prepareCodeChangesRebase,
  projectAfterChanges,
  type CodeProjectCommands,
  type ApplyCodeChangesArgs,
  type CodeFileChange,
} from './commands/code-project-commands';
export {
  pageCommands,
  pageLinkResolutionSchema,
  resolvePageLink,
  type PageCommands,
  type PageLinkResolution,
} from './commands/page-commands';
export {
  isSiteCommandName,
  siteCommands,
  type SiteCommandName,
  type SiteCommands,
} from './commands/site-commands';

export { applyPatchSet, applySitePatchSet } from './patches/apply';
export { applyOnePatch, type RootPatch } from './patches/apply-one-patch';
export { TYPING_MERGE_WINDOW_MS } from './history/history';

export { systemClock } from './ports/system-clock';
export { systemIds } from './ports/system-ids';
// ── P5-site-library (style-manager DESIGN.md) ──
// The site design library commands (§2), spread into `siteCommands`.
export {
  libraryCommands,
  type LibraryCommandName,
  type LibraryCommands,
} from './commands/library-commands';
// ── end P5-site-library ──
// ── P8-manual-editor (style-manager DESIGN.md) ──
// The undo stack's read view (§E, History panel): entries, position, jumpTo.
export {
  createKernelHistoryView,
  type KernelHistory,
} from './kernel/create-builder';
export type { HistoryEntry } from './history/history';
// ── end P8-manual-editor ──
